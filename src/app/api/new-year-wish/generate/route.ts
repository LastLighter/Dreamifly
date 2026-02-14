import { NextResponse } from 'next/server'
import { generateImage } from '@/utils/comfyApi'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

/**
 * 验证动态API token (防爬虫)
 * 支持±1分钟时间窗口，处理时间边界问题
 */
function validateDynamicToken(providedToken: string): boolean {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (!apiKey) {
    return false
  }

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

/**
 * 新年许愿机 - 图片生成API
 * 特点：完全免费，无需登录，不扣积分，无使用限制
 * 仅保留token验证防止爬虫
 */
export async function POST(request: Request) {
  try {
    const startTime = Date.now()
    
    // 1. 解析请求（可选传入愿望列表，用于首个愿望自选）
    const { avatar, token, wishes: clientWishes } = await request.json()
    
    // 2. 验证动态token（防爬虫）
    if (!token || !validateDynamicToken(token)) {
      console.log('[New Year Wish] Invalid token')
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }
    
    // 3. 验证头像数据
    if (!avatar) {
      return NextResponse.json(
        { error: 'Avatar is required' },
        { status: 400 }
      )
    }
    
    // 4. 确定愿望列表：客户端传入则使用，否则服务端随机
    let selectedWishes: Array<{ id: string; name: string; prompt: string }>
    if (Array.isArray(clientWishes) && clientWishes.length === 8) {
      selectedWishes = clientWishes
    } else {
      const wishesPath = path.join(process.cwd(), 'public/data/wishes.json')
      const wishesData = fs.readFileSync(wishesPath, 'utf-8')
      const allWishes = JSON.parse(wishesData)
      const shuffled = [...allWishes].sort(() => 0.5 - Math.random())
      selectedWishes = shuffled.slice(0, 8)
    }
    
    console.log(`[New Year Wish] Generating 8 images for wishes: ${selectedWishes.map(w => w.name).join(', ')}`)
    
    // 6. 并发生成8张图片（直接调用底层函数，无需登录、积分、限制）
    const generatePromises = selectedWishes.map(async (wish, index) => {
      try {
        const prompt = `${wish.prompt}, Chinese New Year festive style, red and gold color scheme, celebration atmosphere`
        
        const result = await generateImage({
          model: "Qwen-Image-Edit",
          images: [avatar],
          prompt: prompt,
          width: 768,
          height: 768,
          steps: 20,
          batch_size: 1,
          seed: Math.floor(Math.random() * 1000000)
        })
        
        console.log(`[New Year Wish] Generated image ${index + 1}/8 for wish: ${wish.name}`)
        return {
          success: true,
          image: result,
          wish: wish
        }
      } catch (error) {
        console.error(`[New Year Wish] Failed to generate image for wish ${wish.name}:`, error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Generation failed',
          wish: wish
        }
      }
    })
    
    const results = await Promise.all(generatePromises)
    
    // 7. 统计成功和失败的数量
    const successResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)
    
    const totalTime = Date.now() - startTime
    
    console.log(`[New Year Wish] Generation completed: ${successResults.length}/8 successful, ${failedResults.length}/8 failed, took ${totalTime}ms`)
    
    // 8. 返回结果
    return NextResponse.json({
      success: true,
      images: successResults.map(r => r.image),
      wishes: successResults.map(r => r.wish),
      failed: failedResults.length,
      totalTime: totalTime
    })
    
  } catch (error) {
    console.error('[New Year Wish] Generation error:', error)
    return NextResponse.json(
      { 
        error: 'Generation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
