import { NextResponse } from 'next/server'
import { generateImage } from '@/utils/comfyApi'
import { db } from '@/db'
import { siteStats, modelUsageStats, user, userLimitConfig, ipBlacklist } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { concurrencyManager } from '@/utils/concurrencyManager'
import { ipConcurrencyManager } from '@/utils/ipConcurrencyManager'
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

// 获取客户端IP地址
function getClientIP(request: Request): string | null {
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
  
  // 处理IPv4映射的IPv6格式（::ffff:192.168.1.1 -> 192.168.1.1）
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7) // 移除 '::ffff:' 前缀
  }
  
  return ip
}

export async function POST(request: Request) {
  let generationId: string | null = null;
  const clientIP = getClientIP(request)
  
  try {
    // 记录总开始时间（包含排队延迟）
    const totalStartTime = Date.now()
    
    // 首先检查IP黑名单（在所有其他检查之前）
    if (clientIP) {
      const blacklistedIP = await db.select()
        .from(ipBlacklist)
        .where(eq(ipBlacklist.ipAddress, clientIP))
        .limit(1)
      
      if (blacklistedIP.length > 0) {
        return NextResponse.json({ 
          error: '您的IP地址已被加入黑名单，无法使用此服务',
          code: 'IP_BLACKLISTED'
        }, { status: 403 })
      }
    }
    
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
    
    // 获取用户信息（用于IP并发控制）
    let isAdmin = false
    let isPremium = false
    let currentUserId: string | null = null
    
    if (session?.user) {
      currentUserId = session.user.id
      const currentUser = await db.select()
        .from(user)
        .where(eq(user.id, currentUserId))
        .limit(1)
      
      if (currentUser.length > 0) {
        isAdmin = currentUser[0].isAdmin || false
        isPremium = currentUser[0].isPremium || false
      }
    }
    
    // 检查IP并发限制（在所有其他检查之前）
    let ipMaxConcurrency: number | null = null
    if (clientIP) {
      const ipConcurrencyCheck = await ipConcurrencyManager.canStart(
        clientIP,
        currentUserId,
        isAdmin,
        isPremium
      )
      
      if (!ipConcurrencyCheck.canStart) {
        return NextResponse.json({
          error: `当前有 ${ipConcurrencyCheck.currentConcurrency} 个生图任务正在执行，请等待其他任务执行完成后再试。`,
          code: 'IP_CONCURRENCY_LIMIT_EXCEEDED',
          currentConcurrency: ipConcurrencyCheck.currentConcurrency,
          maxConcurrency: ipConcurrencyCheck.maxConcurrency
        }, { status: 429 })
      }
      
      // 保存最大并发数，用于后续增加计数
      ipMaxConcurrency = ipConcurrencyCheck.maxConcurrency
      
      // 对于未登录用户，在进入排队前就增加IP并发计数，避免多个请求同时排队
      // 已登录用户的IP并发计数在后续统一增加（在用户并发检查之后）
      if (!session?.user) {
        const ipStartSuccess = await ipConcurrencyManager.start(clientIP, ipMaxConcurrency)
        if (!ipStartSuccess) {
          // 如果增加计数失败（可能因为并发冲突），返回错误
          const currentInfo = await ipConcurrencyManager.getInfo(clientIP)
          return NextResponse.json({
            error: `当前有 ${currentInfo?.currentConcurrency || 0} 个生图任务正在执行，请等待其他任务执行完成后再试。`,
            code: 'IP_CONCURRENCY_LIMIT_EXCEEDED',
            currentConcurrency: currentInfo?.currentConcurrency || 0,
            maxConcurrency: ipMaxConcurrency
          }, { status: 429 })
        }
      }
    }
    
    // 如果用户已登录，检查用户并发限制和每日请求次数
    if (session?.user) {
      const userId = session.user.id;
      
      // 先获取用户信息，检查是否是管理员
      // 使用数据库原子操作来确保并发安全
      // 注意：查询时使用 AT TIME ZONE 'UTC' 确保读取的是UTC时间，避免时区转换问题
      const currentUser = await db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        isOldUser: user.isOldUser,
        dailyRequestCount: user.dailyRequestCount,
        // 将 timestamptz 转换为 UTC 时间字符串，确保读取正确
        lastRequestResetDate: sql<string | null>`${user.lastRequestResetDate} AT TIME ZONE 'UTC'`,
        updatedAt: user.updatedAt,
      })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (currentUser.length > 0) {
        const userData = currentUser[0];
        // 更新isAdmin和isPremium（如果之前没有获取到）
        if (!isAdmin) isAdmin = userData.isAdmin || false;
        if (!isPremium) isPremium = userData.isPremium || false;
        const isOldUser = userData.isOldUser || false;
        
        // 管理员不受用户并发限制
        if (!isAdmin) {
          const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '2', 10);
          
          // 检查是否超过用户并发限制
          if (!concurrencyManager.canStart(userId, maxConcurrent)) {
            const currentCount = concurrencyManager.getCurrentCount(userId);
            return NextResponse.json({ 
              error: `您当前有 ${currentCount} 个生图任务正在进行，最多允许 ${maxConcurrent} 个任务同时进行。请等待其中一个完成后再试。`,
              code: 'CONCURRENCY_LIMIT_EXCEEDED',
              currentCount,
              maxConcurrent
            }, { status: 429 }) // 429 Too Many Requests
          }
        }

        // 检查是否需要重置每日计数（使用东八区时区判断）
        // 辅助函数：获取指定日期在东八区的年月日
        const getShanghaiDate = (date: Date) => {
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Shanghai',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).formatToParts(date);
          
          return {
            year: parseInt(parts.find(p => p.type === 'year')!.value),
            month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
            day: parseInt(parts.find(p => p.type === 'day')!.value)
          };
        };

        const now = new Date();
        const todayShanghai = getShanghaiDate(now);
        // 创建东八区今天的UTC日期对象（用于比较）
        const todayShanghaiDate = new Date(Date.UTC(
          todayShanghai.year,
          todayShanghai.month,
          todayShanghai.day
        ));

        // 由于查询时已经使用 AT TIME ZONE 'UTC' 转换为UTC时间字符串
        // 返回的格式是 '2025-11-17 15:17:26.143223' (无时区标识的UTC时间，空格分隔)
        // 需要转换为ISO 8601格式（将空格替换为T，添加Z表示UTC）
        const lastResetDate = userData.lastRequestResetDate 
          ? new Date(userData.lastRequestResetDate.replace(' ', 'T') + 'Z') 
          : null;
        const lastResetDayShanghai = lastResetDate ? getShanghaiDate(lastResetDate) : null;
        const lastResetDayShanghaiDate = lastResetDayShanghai ? new Date(Date.UTC(
          lastResetDayShanghai.year,
          lastResetDayShanghai.month,
          lastResetDayShanghai.day
        )) : null;

        // 先检查并重置（如果需要）- 所有用户都需要统计
        let currentCount = userData.dailyRequestCount || 0;
        const needsReset = !lastResetDayShanghaiDate || lastResetDayShanghaiDate.getTime() !== todayShanghaiDate.getTime();
        
        // 如果上次重置日期不是今天（东八区），重置计数
        if (needsReset) {
          currentCount = 0;
          // 先重置计数
          // 注意：字段类型是 timestamptz，PostgreSQL 会自动处理时区转换
          // 直接使用 now() 即可，PostgreSQL 会以 UTC 存储
          await db
            .update(user)
            .set({
              dailyRequestCount: 0,
              lastRequestResetDate: sql`now()`,
              updatedAt: sql`now()`,
            })
            .where(eq(user.id, userId));
        }

        // 管理员不限次，其他用户检查次数限制
        if (!isAdmin) {
          // 获取用户限额配置（优先使用数据库配置，否则使用环境变量）
          let maxDailyRequests: number;
          try {
            const config = await db.select()
              .from(userLimitConfig)
              .where(eq(userLimitConfig.id, 1))
              .limit(1);
            
            if (config.length > 0) {
              const configData = config[0];
              if (isPremium) {
                // 优质用户不受影响
                const dbPremiumLimit = configData.premiumUserDailyLimit;
                const envPremiumLimit = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '500', 10);
                maxDailyRequests = dbPremiumLimit ?? envPremiumLimit;
                // 调试日志
                console.log(`[Generate API] Premium user limit - DB: ${dbPremiumLimit}, Env: ${envPremiumLimit}, Final: ${maxDailyRequests}`);
              } else {
                // 普通用户根据是否老用户使用不同额度
                if (isOldUser) {
                  maxDailyRequests = configData.regularUserDailyLimit ?? 
                    parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '200', 10);
                } else {
                  maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '200', 10);
                }
              }
            } else {
              // 配置不存在，使用环境变量
              if (isPremium) {
                maxDailyRequests = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '500', 10);
              } else {
                // 普通用户根据是否老用户使用不同额度
                if (isOldUser) {
                  maxDailyRequests = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '200', 10);
                } else {
                  maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '200', 10);
                }
              }
            }
          } catch (error) {
            // 如果查询配置失败，使用环境变量作为后备
            console.error('Error fetching user limit config:', error);
            if (isPremium) {
              maxDailyRequests = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '500', 10);
            } else {
              // 普通用户根据是否老用户使用不同额度
              if (isOldUser) {
                maxDailyRequests = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '200', 10);
              } else {
                maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '200', 10);
              }
            }
          }
          
          // 检查是否超过限制
          if (currentCount >= maxDailyRequests) {
            return NextResponse.json({ 
              error: `您今日的生图次数已达上限（${maxDailyRequests}次）。${isPremium ? '优质用户' : '普通用户'}每日可使用${maxDailyRequests}次生图功能。`,
              code: 'DAILY_LIMIT_EXCEEDED',
              dailyCount: currentCount,
              maxDailyRequests
            }, { status: 429 });
          }
        }

        // 使用原子操作增加计数（每次请求+1，不管batch_size）
        // 这样可以确保并发请求时也能正确计数（包括管理员）
        // 构建更新对象
        const updateData: any = {
          dailyRequestCount: sql`${user.dailyRequestCount} + 1`,
          updatedAt: sql`now()`,
        };
        // 注意：如果上面已经重置过（needsReset = true），lastRequestResetDate 已经在重置时更新了
        // 这里不需要再更新，避免重复更新
        // 如果日期相同（needsReset = false），也不需要更新 lastRequestResetDate，保持原值
        await db
          .update(user)
          .set(updateData)
          .where(eq(user.id, userId));
      }
      
      // 开始跟踪这个生成请求（用户并发）
      generationId = concurrencyManager.start(userId);
    }
    
    // 如果用户未登录，添加延迟（未登录用户不受用户并发限制）
    // 注意：未登录用户的IP并发计数已在前面增加，所以排队期间也算IP并发
    if (!session?.user) {
      const unauthDelay = parseInt(process.env.UNAUTHENTICATED_USER_DELAY || '20', 10)
      await new Promise(resolve => setTimeout(resolve, unauthDelay * 1000))
    }

    const body = await request.json()
    const { prompt, width, height, steps, seed, batch_size, model, images, negative_prompt } = body

    // 验证输入
    if (width < 64 || width > 1440 || height < 64 || height > 1440) {
      // 如果输入验证失败，需要清理已增加的并发计数
      if (!session?.user && clientIP) {
        // 未登录用户：清理IP并发计数
        await ipConcurrencyManager.end(clientIP).catch(err => {
          console.error('Error decrementing IP concurrency after validation error:', err)
        })
      } else if (session?.user && generationId) {
        // 已登录用户：清理用户并发跟踪（IP并发计数此时还未增加）
        concurrencyManager.end(generationId)
      }
      return NextResponse.json({ error: 'Invalid image dimensions' }, { status: 400 })
    }
    if (steps < 5 || steps > 32) {
      // 如果输入验证失败，需要清理已增加的并发计数
      if (!session?.user && clientIP) {
        // 未登录用户：清理IP并发计数
        await ipConcurrencyManager.end(clientIP).catch(err => {
          console.error('Error decrementing IP concurrency after validation error:', err)
        })
      } else if (session?.user && generationId) {
        // 已登录用户：清理用户并发跟踪（IP并发计数此时还未增加）
        concurrencyManager.end(generationId)
      }
      return NextResponse.json({ error: 'Invalid steps value' }, { status: 400 })
    }

    // 对于已登录用户，在所有检查都通过后，原子性地增加IP并发计数
    // 未登录用户的IP并发计数已在前面增加
    if (clientIP && session?.user) {
      const ipStartSuccess = await ipConcurrencyManager.start(clientIP, ipMaxConcurrency)
      if (!ipStartSuccess) {
        // 如果增加计数失败，需要清理用户并发跟踪
        if (generationId) {
          concurrencyManager.end(generationId)
        }
        const currentInfo = await ipConcurrencyManager.getInfo(clientIP)
        return NextResponse.json({
          error: `当前有 ${currentInfo?.currentConcurrency || 0} 个生图任务正在执行，请等待其他任务执行完成后再试。`,
          code: 'IP_CONCURRENCY_LIMIT_EXCEEDED',
          currentConcurrency: currentInfo?.currentConcurrency || 0,
          maxConcurrency: ipMaxConcurrency
        }, { status: 429 })
      }
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
    
    // 清理IP并发跟踪
    if (clientIP) {
      await ipConcurrencyManager.end(clientIP)
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Error generating image:', error)
    
    // 发生错误，清理并发跟踪
    if (generationId) {
      concurrencyManager.end(generationId);
    }
    
    // 清理IP并发跟踪
    if (clientIP) {
      await ipConcurrencyManager.end(clientIP).catch(err => {
        console.error('Error decrementing IP concurrency:', err)
      })
    }
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 