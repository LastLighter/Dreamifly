import { NextResponse } from 'next/server'
import { generateImage } from '@/utils/comfyApi'
import { db } from '@/db'
import { siteStats } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { prompt, width, height, steps, seed, batch_size, model, images, denoise, negative_prompt } = body

    // 验证输入
    if (width < 64 || width > 1920 || height < 64 || height > 1920) {
      return NextResponse.json({ error: 'Invalid image dimensions' }, { status: 400 })
    }
    if (steps < 5 || steps > 40) {
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
      denoise,
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

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Error generating image:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 