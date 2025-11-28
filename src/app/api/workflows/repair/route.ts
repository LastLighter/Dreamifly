import { NextResponse } from 'next/server'
import { runSupirRepairWorkflow } from '@/utils/supirRepairWorkflow'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createHash } from 'crypto'
import { getPointsConfig, checkPointsSufficient, deductPoints } from '@/utils/points'

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
  try {
    // 1. 验证动态 token
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 2. 检查用户是否已登录
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized: 请先登录' }, { status: 401 })
    }

    // 3. 检查用户权限（只有优质用户和管理员可以使用）
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userData = currentUser[0]
    const isAdmin = userData.isAdmin || false
    const isPremium = userData.isPremium || false

    if (!isAdmin && !isPremium) {
      return NextResponse.json(
        { error: 'Forbidden: 此功能仅限优质用户和管理员使用' },
        { status: 403 }
      )
    }

    // 管理员不扣积分，普通用户和优质用户需要检查并扣除积分
    if (!isAdmin) {
      // 获取积分配置
      const config = await getPointsConfig()
      const cost = config.repairWorkflowCost

      // 检查积分是否足够
      const hasEnoughPoints = await checkPointsSufficient(session.user.id, cost)
      if (!hasEnoughPoints) {
        return NextResponse.json(
          { error: `积分不足，需要 ${cost} 积分才能使用此功能` },
          { status: 403 }
        )
      }
    }

    // 4. 处理请求
    const body = await request.json()
    const { image, positivePrompt, negativePrompt, steps, seed } = body || {}

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: '缺少图片数据' }, { status: 400 })
    }

    const sanitizedImage = image.startsWith('data:')
      ? image.split(',')[1]
      : image

    // 5. 验证图片格式与尺寸
    try {
      // 将 base64 转换为 Buffer 并获取图片尺寸
      const imageBuffer = Buffer.from(sanitizedImage, 'base64')

      // 验证文件类型（仅允许 PNG/JPG/JPEG）
      const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47
      const isJpeg = imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8 && imageBuffer[2] === 0xFF

      if (!isPng && !isJpeg) {
        return NextResponse.json(
          { error: '仅支持 PNG、JPG、JPEG 格式的图片' },
          { status: 400 }
        )
      }

      // 使用简单的图片头解析获取尺寸（支持 PNG 和 JPEG）
      let width = 0
      let height = 0
      
      // PNG 格式：前8字节是签名，然后8字节是IHDR，接下来4字节是宽度，4字节是高度
      if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
        width = imageBuffer.readUInt32BE(16)
        height = imageBuffer.readUInt32BE(20)
      }
      // JPEG 格式：查找 SOF 标记（0xFF 0xC0, 0xFF 0xC1, 0xFF 0xC2 等）
      else if (imageBuffer[0] === 0xFF && imageBuffer[1] === 0xD8) {
        let i = 2
        while (i < imageBuffer.length - 1 && i < 65535) {
          if (imageBuffer[i] === 0xFF && (imageBuffer[i + 1] >= 0xC0 && imageBuffer[i + 1] <= 0xC3)) {
            height = imageBuffer.readUInt16BE(i + 5)
            width = imageBuffer.readUInt16BE(i + 7)
            break
          }
          // 跳过当前段
          if (imageBuffer[i] === 0xFF && imageBuffer[i + 1] !== 0xFF) {
            const segmentLength = imageBuffer.readUInt16BE(i + 2)
            i += segmentLength + 2
          } else {
            i++
          }
        }
      }
      
      // 如果无法解析尺寸，返回错误（前端应该已经验证过，这里作为二次验证）
      if (width === 0 || height === 0) {
        return NextResponse.json(
          { error: '无法解析图片尺寸，请确保上传的是有效的 PNG 或 JPEG 图片' },
          { status: 400 }
        )
      }
      
      // 验证尺寸范围：宽高需小于 2000 像素
      if (width > 2000 || height > 2000) {
        return NextResponse.json(
          { error: '图片宽高需小于 2000 像素' },
          { status: 400 }
        )
      }
    } catch (sizeError) {
      // 如果尺寸验证失败，返回错误
      console.error('Failed to validate image dimensions:', sizeError)
      return NextResponse.json(
        { error: '无法验证图片尺寸，请确保上传的是有效的图片文件' },
        { status: 400 }
      )
    }

    // 执行修复工作流
    let repairedImage: string
    try {
      repairedImage = await runSupirRepairWorkflow(sanitizedImage, {
        positivePrompt,
        negativePrompt,
        steps,
        seed
      })

      // 修复成功后扣除积分（管理员不扣）
      if (!isAdmin) {
        const config = await getPointsConfig()
        const cost = config.repairWorkflowCost
        const deducted = await deductPoints(session.user.id, cost, '工作流修复消费')
        if (!deducted) {
          // 如果扣除失败（理论上不应该发生，因为前面已经检查过），记录错误但不影响结果
          console.error('Failed to deduct points after repair workflow')
        }
      }

      return NextResponse.json({ imageUrl: repairedImage })
    } catch (workflowError) {
      // 工作流失败，不扣除积分（因为前面已经检查过积分，这里如果失败应该回滚，但为了简化，我们只在成功时扣除）
      throw workflowError
    }
  } catch (error) {
    console.error('Error running Supir Repair workflow:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '修复失败，请稍后重试' },
      { status: 500 }
    )
  }
}


