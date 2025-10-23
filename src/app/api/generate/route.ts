import { NextResponse } from 'next/server'
import { generateImage } from '@/utils/comfyApi'
import { db } from '@/db'
import { siteStats } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { concurrencyManager } from '@/utils/concurrencyManager'

export async function POST(request: Request) {
  let generationId: string | null = null;
  
  try {
    // 验证认证头
    const authHeader = request.headers.get('Authorization')
    const expectedApiKey = process.env.NEXT_PUBLIC_API_KEY
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedKey = authHeader.substring(7) // 移除 "Bearer " 前缀
    if (!expectedApiKey || providedKey !== expectedApiKey) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 检查用户是否已登录
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    // 如果用户已登录，检查并发限制
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
      
      // 开始跟踪这个生成请求
      generationId = concurrencyManager.start(userId);
    } else {
      // 如果用户未登录，添加延迟（未登录用户不受并发限制）
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

    // 更新统计数据
    await db.update(siteStats)
      .set({
        totalGenerations: sql`${siteStats.totalGenerations} + 1`,
        dailyGenerations: sql`${siteStats.dailyGenerations} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(siteStats.id, 1))

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