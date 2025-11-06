import { NextResponse } from 'next/server'
import { generateImage } from '@/utils/comfyApi'
import { db } from '@/db'
import { siteStats, modelUsageStats, user } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { concurrencyManager } from '@/utils/concurrencyManager'
import { randomUUID, createHash } from 'crypto'

/**
 * 验证动态API token
 * 支持±1分钟时间窗口，处理时间边界问题
 * @param providedToken 客户端提供的token
 * @returns 验证是否通过
 */
function validateDynamicToken(providedToken: string): boolean {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (!apiKey) {
    return false
  }

  // 获取服务器当前时间
  const now = new Date()
  
  // 计算当前分钟和上一分钟的token
  const timeSlots = [
    now, // 当前分钟
    new Date(now.getTime() - 60 * 1000), // 上一分钟
  ]

  for (const timeSlot of timeSlots) {
    const year = timeSlot.getFullYear()
    const month = String(timeSlot.getMonth() + 1).padStart(2, '0')
    const day = String(timeSlot.getDate()).padStart(2, '0')
    const hour = String(timeSlot.getHours()).padStart(2, '0')
    const minute = String(timeSlot.getMinutes()).padStart(2, '0')
    
    const salt = `${year}${month}${day}${hour}${minute}`
    
    // 生成MD5哈希: MD5(密钥 + 盐值)
    const expectedToken = createHash('md5')
      .update(apiKey + salt)
      .digest('hex')
    
    // 如果匹配任一有效token，验证通过
    if (providedToken === expectedToken) {
      return true
    }
  }

  return false
}

export async function POST(request: Request) {
  let generationId: string | null = null;
  
  try {
    // 记录总开始时间（包含排队延迟）
    const totalStartTime = Date.now()
    
    // 验证认证头
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 检查用户是否已登录
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    // 如果用户已登录，检查并发限制和每日请求次数
    if (session?.user) {
      const userId = session.user.id;
      const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '2', 10);
      
      // 检查是否超过并发限制
      if (!concurrencyManager.canStart(userId, maxConcurrent)) {
        const currentCount = concurrencyManager.getCurrentCount(userId);
        return NextResponse.json({ 
          error: `您当前有 ${currentCount} 个生图任务正在进行，最多允许 ${maxConcurrent} 个任务同时进行。请等待其中一个完成后再试。`,
          code: 'CONCURRENCY_LIMIT_EXCEEDED',
          currentCount,
          maxConcurrent
        }, { status: 429 }) // 429 Too Many Requests
      }

      // 获取用户信息，检查每日请求次数限制
      // 使用数据库原子操作来确保并发安全
      const currentUser = await db.select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (currentUser.length > 0) {
        const userData = currentUser[0];
        const isAdmin = userData.isAdmin || false;
        const isPremium = userData.isPremium || false;

        // 检查是否需要重置每日计数（如果上次重置日期不是今天）
        const now = new Date();
        const lastResetDate = userData.lastRequestResetDate ? new Date(userData.lastRequestResetDate) : null;
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastResetDay = lastResetDate ? new Date(lastResetDate.getFullYear(), lastResetDate.getMonth(), lastResetDate.getDate()) : null;

        // 管理员不限次，其他用户检查次数限制
        if (!isAdmin) {
          // 先检查并重置（如果需要）
          let currentCount = userData.dailyRequestCount || 0;
          
          // 如果上次重置日期不是今天，重置计数
          if (!lastResetDay || lastResetDay.getTime() !== today.getTime()) {
            currentCount = 0;
            // 先重置计数
            await db
              .update(user)
              .set({
                dailyRequestCount: 0,
                lastRequestResetDate: now,
                updatedAt: now,
              })
              .where(eq(user.id, userId));
          }

          const maxDailyRequests = isPremium ? 500 : 200; // 优质用户500次，普通用户200次
          
          // 检查是否超过限制
          if (currentCount >= maxDailyRequests) {
            return NextResponse.json({ 
              error: `您今日的生图次数已达上限（${maxDailyRequests}次）。${isPremium ? '优质用户' : '普通用户'}每日可使用${maxDailyRequests}次生图功能。`,
              code: 'DAILY_LIMIT_EXCEEDED',
              dailyCount: currentCount,
              maxDailyRequests
            }, { status: 429 });
          }

          // 使用原子操作增加计数（每次请求+1，不管batch_size）
          // 这样可以确保并发请求时也能正确计数
          await db
            .update(user)
            .set({
              dailyRequestCount: sql`${user.dailyRequestCount} + 1`,
              lastRequestResetDate: (!lastResetDay || lastResetDay.getTime() !== today.getTime()) ? now : sql`${user.lastRequestResetDate}`,
              updatedAt: now,
            })
            .where(eq(user.id, userId));
        } else {
          // 管理员不计数，但更新重置日期（如果需要）
          if (!lastResetDay || lastResetDay.getTime() !== today.getTime()) {
            await db
              .update(user)
              .set({
                lastRequestResetDate: now,
                updatedAt: now,
              })
              .where(eq(user.id, userId));
          }
        }
      }
      
      // 开始跟踪这个生成请求
      generationId = concurrencyManager.start(userId);
    } else {
      // 如果用户未登录，添加延迟（未登录用户不受并发限制）
      // 这个延迟时间会被计入总响应时间
      const unauthDelay = parseInt(process.env.UNAUTHENTICATED_USER_DELAY || '20', 10)
      await new Promise(resolve => setTimeout(resolve, unauthDelay * 1000))
    }

    const body = await request.json()
    const { prompt, width, height, steps, seed, batch_size, model, images, negative_prompt } = body

    // 验证输入
    if (width < 64 || width > 1440 || height < 64 || height > 1440) {
      return NextResponse.json({ error: 'Invalid image dimensions' }, { status: 400 })
    }
    if (steps < 5 || steps > 32) {
      return NextResponse.json({ error: 'Invalid steps value' }, { status: 400 })
    }

    // 调用 ComfyUI API
    const imageUrl = await generateImage({
      prompt,
      width,
      height,
      steps,
      seed: seed ? parseInt(seed) : undefined,
      batch_size,
      model,
      images,
      negative_prompt,
    })

    // 计算总响应时间（秒），包含排队延迟
    const responseTime = (Date.now() - totalStartTime) / 1000

    // 获取客户端IP地址
    const getClientIP = (request: Request): string | null => {
      const forwarded = request.headers.get('x-forwarded-for')
      const realIP = request.headers.get('x-real-ip')
      const cfConnectingIP = request.headers.get('cf-connecting-ip') // Cloudflare
      
      let ip: string | null = null
      
      if (forwarded) {
        // x-forwarded-for 可能包含多个IP，取第一个
        ip = forwarded.split(',')[0].trim()
      } else if (realIP) {
        ip = realIP.trim()
      } else if (cfConnectingIP) {
        ip = cfConnectingIP.trim()
      }
      
      // 处理本地回环地址：将 IPv6 的 ::1 转换为 IPv4 的 127.0.0.1，便于统一显示
      if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        ip = '127.0.0.1'
      }
      
      return ip
    }

    const clientIP = getClientIP(request)

    // 更新统计数据
    await db.update(siteStats)
      .set({
        totalGenerations: sql`${siteStats.totalGenerations} + 1`,
        dailyGenerations: sql`${siteStats.dailyGenerations} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(siteStats.id, 1))

    // 记录模型使用统计
    try {
      // 创建当前时间的Date对象（JavaScript Date内部存储为UTC时间戳）
      // PostgreSQL的timestamptz会自动处理时区转换
      const now = new Date()
      
      await db.insert(modelUsageStats).values({
        id: randomUUID(),
        modelName: model,
        userId: session?.user?.id || null,
        responseTime,
        isAuthenticated: !!session?.user,
        ipAddress: clientIP,
        createdAt: now,
      })
    } catch (error) {
      // 记录统计失败不应该影响主流程
      console.error('Failed to record model usage stats:', error)
    }

    // 成功完成，清理并发跟踪
    if (generationId) {
      concurrencyManager.end(generationId);
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Error generating image:', error)
    
    // 发生错误，清理并发跟踪
    if (generationId) {
      concurrencyManager.end(generationId);
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 