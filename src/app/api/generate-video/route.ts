import { NextResponse } from 'next/server'
import { generateVideo } from '@/utils/videoComfyApi'
import { getVideoModelById, calculateVideoResolution } from '@/utils/videoModelConfig'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { createHash } from 'crypto'
import { getModelBaseCost, checkPointsSufficient, deductPoints, getPointsBalance } from '@/utils/points'
import { db } from '@/db'
import { siteStats, user } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { saveUserGeneratedVideo } from '@/utils/userVideoStorage'

// 设置 API 路由最大执行时间为 25 分钟（1500 秒），确保比视频生成超时时间（20 分钟）更长
// 这样即使需要轮询获取视频，也不会因为 Next.js 的路由超时而失败
export const maxDuration = 1500 // 25 分钟

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
  const requestId = Math.random().toString(36).substring(7);
  const totalStartTime = Date.now();

  try {
    // 验证认证头
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error(`[视频生成API] [${requestId}] 认证头缺失或无效`);
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const providedToken = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      console.error(`[视频生成API] [${requestId}] Token验证失败`);
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // 检查用户是否已登录
    const session = await auth.api.getSession({
      headers: await headers()
    });

    // 未登录用户无法调用
    if (!session?.user) {
      console.error(`[视频生成API] [${requestId}] 用户未登录`);
      return NextResponse.json({
        error: '请登录后再使用视频生成功能',
        code: 'LOGIN_REQUIRED'
      }, { status: 401 });
    }

    const userId = session.user.id;

    // 检查管理员权限
    const currentUser = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    const isAdmin = currentUser.length > 0 && currentUser[0].isAdmin;

    // 解析请求体
    const body = await request.json();
    const { prompt, width, height, aspectRatio, length, fps, seed, steps, model, image, negative_prompt } = body;
    
    // 验证模型是否存在
    const modelConfig = getVideoModelById(model);
    if (!modelConfig) {
      console.error(`[视频生成API] [${requestId}] 模型不存在: ${model}`);
      return NextResponse.json({ error: '视频模型不存在' }, { status: 400 });
    }
    
    // 计算分辨率（如果提供了aspectRatio，使用比例计算；否则使用提供的width和height）
    let finalWidth = width;
    let finalHeight = height;
    
    if (aspectRatio && !width && !height) {
      // 根据比例计算分辨率（保持总像素不变）
      const resolution = calculateVideoResolution(modelConfig, aspectRatio);
      finalWidth = resolution.width;
      finalHeight = resolution.height;
    } else if (width && height) {
      // 使用提供的分辨率，但需要确保总像素不超过模型限制
      const totalPixels = width * height;
      const maxPixels = modelConfig.totalPixels || 1280 * 720;
      
      if (totalPixels > maxPixels) {
        // 如果超过限制，按比例缩放
        const scale = Math.sqrt(maxPixels / totalPixels);
        finalWidth = Math.round(width * scale / 8) * 8;
        finalHeight = Math.round(height * scale / 8) * 8;
      } else {
        // 确保宽高都是8的倍数
        finalWidth = Math.round(width / 8) * 8;
        finalHeight = Math.round(height / 8) * 8;
      }
    } else {
      return NextResponse.json({ error: '请提供分辨率或宽高比' }, { status: 400 })
    }
    
    // 验证输入
    if (finalWidth < 64 || finalHeight < 64) {
      return NextResponse.json({ error: 'Invalid video dimensions' }, { status: 400 })
    }
    
    // 验证图片输入（I2V 需要输入图片）
    if (!image) {
      return NextResponse.json({ error: '图像到视频生成需要输入图片' }, { status: 400 })
    }

    // 管理员不需要积分检查和扣除
    if (!isAdmin) {
      
      // 获取模型基础积分消耗
      const baseCost = await getModelBaseCost(model);

      if (baseCost === null) {
        console.error(`[视频生成API] [${requestId}] 模型未配置积分消耗: ${model}`);
        return NextResponse.json({
          error: `视频模型 ${model} 未配置积分消耗`
        }, { status: 400 });
      }

      // 视频生成固定消耗基础积分（不根据分辨率或步数变化）
      const pointsCost = baseCost;

      // 检查积分是否足够
      const hasEnoughPoints = await checkPointsSufficient(userId, pointsCost);

      if (!hasEnoughPoints) {
        const currentBalance = await getPointsBalance(userId);
        console.error(`[视频生成API] [${requestId}] 积分不足:`, {
          required: pointsCost,
          current: currentBalance,
        });
        return NextResponse.json({
          error: `积分不足。本次生成需要消耗 ${pointsCost} 积分，但您的积分余额不足（当前余额：${currentBalance} 积分）。`,
          code: 'INSUFFICIENT_POINTS',
          requiredPoints: pointsCost,
          currentBalance: currentBalance
        }, { status: 402 }); // 402 Payment Required
      }

      // 扣除积分
      const deductSuccess = await deductPoints(
        userId,
        pointsCost,
        `视频生成 - ${model} (分辨率: ${finalWidth}x${finalHeight}, 长度: ${length || modelConfig.defaultLength || 100}帧)`
      );

      if (!deductSuccess) {
        // 再次检查积分余额，判断是积分不足还是其他错误
        const currentBalance = await getPointsBalance(userId);
        if (currentBalance < pointsCost) {
          // 积分不足
          console.error(`[视频生成API] [${requestId}] 积分扣除失败 - 余额不足:`, {
            required: pointsCost,
            current: currentBalance,
          });
          return NextResponse.json({
            error: `积分不足。本次生成需要消耗 ${pointsCost} 积分，但您的积分余额不足（当前余额：${currentBalance} 积分）。`,
            code: 'INSUFFICIENT_POINTS',
            requiredPoints: pointsCost,
            currentBalance: currentBalance
          }, { status: 402 }); // 402 Payment Required
        } else {
          // 其他错误（如数据库错误）
          console.error(`[视频生成API] [${requestId}] 积分扣除失败 - 其他错误`);
          return NextResponse.json({
            error: '积分扣除失败，请稍后重试',
            code: 'POINTS_DEDUCTION_FAILED'
          }, { status: 500 });
        }
      }
    } else {
    }

    // 调用视频生成 API
    // 注意：视频生成可能需要较长时间，这里不设置超时限制
    const videoUrl = await generateVideo({
      prompt,
      width: finalWidth,
      height: finalHeight,
      length: length || modelConfig.defaultLength || 100,
      fps: fps || modelConfig.defaultFps || 20,
      seed: seed ? parseInt(seed) : undefined,
      steps: steps || 4,
      model,
      image,
      negative_prompt,
    });
    
    // 计算视频元数据
    const videoLength = length || modelConfig.defaultLength || 100;
    const videoFps = fps || modelConfig.defaultFps || 20;
    const videoDuration = videoLength / videoFps; // 视频时长（秒）

    // 保存视频到数据库（如果用户已登录）
    if (userId) {
      try {
        // 获取客户端IP地址
        const headersList = await headers();
        const ipAddress = headersList.get('x-forwarded-for') ||
                        headersList.get('x-real-ip') ||
                        'unknown';

        // 提取参考图（输入图片，用于I2V）
        let referenceImages: string[] | undefined = undefined
        if (image) {
          // 移除 data:image 前缀，只保留 base64 数据
          let imageBase64 = image
          if (imageBase64.includes(',')) {
            imageBase64 = imageBase64.split(',')[1]
          }
          referenceImages = [imageBase64]
        }

        // 保存视频（包含审核流程）
        await saveUserGeneratedVideo(
          userId,
          videoUrl, // base64格式的视频
          {
            prompt: prompt,
            model: model,
            width: finalWidth,
            height: finalHeight,
            duration: Math.round(videoDuration), // 视频时长（秒）
            fps: videoFps,
            frameCount: videoLength, // 总帧数
            ipAddress: ipAddress,
            referenceImages: referenceImages, // 参考图（输入图片，加密存储）
          }
        );
      } catch (error) {
        // 保存失败不应该影响返回结果，只记录错误
        console.error(`[视频生成API] [${requestId}] 视频保存到数据库失败:`, error);
        // 如果是审核未通过，需要返回错误
        if (error instanceof Error && error.message.includes('审核未通过')) {
          return NextResponse.json({
            error: error.message,
            code: 'MODERATION_FAILED'
          }, { status: 403 });
        }
      }
    }

    // 计算总响应时间（秒）
    const responseTime = (Date.now() - totalStartTime) / 1000;

    // 更新统计数据（如果需要）
    try {
      await db.update(siteStats)
        .set({
          totalGenerations: sql`${siteStats.totalGenerations} + 1`,
          dailyGenerations: sql`${siteStats.dailyGenerations} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(siteStats.id, 1));
    } catch (error) {
      // 记录统计失败不应该影响主流程
      console.error(`[视频生成API] [${requestId}] 统计数据更新失败:`, error);
    }

    // 返回视频 URL
    return NextResponse.json({ 
      videoUrl,
      responseTime: Math.round(responseTime * 100) / 100 // 保留两位小数
    });
  } catch (error) {
    const totalDuration = Date.now() - totalStartTime;
    
    console.error(`[视频生成API] [${requestId}] 视频生成失败 - 总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`, {
      error: error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      requestId: requestId,
    });
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to generate video',
        requestId: requestId, // 返回请求ID以便追踪
      },
      { status: 500 }
    );
  }
}

