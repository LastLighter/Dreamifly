import { db } from '@/db'
import { userGeneratedImages, user } from '@/db/schema'
import { eq, asc } from 'drizzle-orm'
import { uploadToOSS, deleteFromOSS } from './oss'
import { getImageStorageConfig } from './points'
import { encodeMediaForStorage } from './mediaStorage'

/**
 * 检查用户是否为订阅用户（实时检查）
 */
async function isSubscribedUser(userId: string): Promise<boolean> {
  const userData = await db
    .select({ 
      isSubscribed: user.isSubscribed, 
      subscriptionExpiresAt: user.subscriptionExpiresAt 
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  
  if (userData.length === 0) return false
  
  const { isSubscribed, subscriptionExpiresAt } = userData[0]
  
  // 检查订阅是否有效（未过期）
  return Boolean(isSubscribed && 
    subscriptionExpiresAt && 
    new Date(subscriptionExpiresAt) > new Date())
}

/**
 * 清理超出数量的旧媒体（图片+视频，从前往后删除，保留最新的）
 * @param userId 用户ID
 * @param maxMedia 最大媒体数量（图片+视频总数）
 */
async function cleanupOldMedia(userId: string, maxMedia: number): Promise<void> {
  // 获取用户的所有媒体（图片+视频），按创建时间升序排列（最旧的在前）
  const allMedia = await db
    .select({ 
      id: userGeneratedImages.id, 
      imageUrl: userGeneratedImages.imageUrl,
      mediaType: userGeneratedImages.mediaType,
      referenceImages: userGeneratedImages.referenceImages
    })
    .from(userGeneratedImages)
    .where(eq(userGeneratedImages.userId, userId))
    .orderBy(asc(userGeneratedImages.createdAt)) // 按创建时间升序：最旧的在前
  
  // 如果超出数量，删除最旧的媒体（从前往后删除）
  if (allMedia.length > maxMedia) {
    const mediaToDelete = allMedia.slice(0, allMedia.length - maxMedia) // 保留最后 maxMedia 个
    
    for (const media of mediaToDelete) {
      // 先删除参考图片（如果有）
      if (media.referenceImages && Array.isArray(media.referenceImages) && media.referenceImages.length > 0) {
        for (const refImageUrl of media.referenceImages) {
          if (refImageUrl && typeof refImageUrl === 'string') {
            try {
              await deleteFromOSS(refImageUrl)
            } catch (error) {
              console.error(`删除参考图片失败: ${refImageUrl}`, error)
              // 继续删除其他文件，不中断流程
            }
          }
        }
      }
      
      // 从数据库删除记录
      await db
        .delete(userGeneratedImages)
        .where(eq(userGeneratedImages.id, media.id))
      
      // 从OSS删除主媒体文件
      try {
        await deleteFromOSS(media.imageUrl)
      } catch (error) {
        console.error(`删除OSS文件失败: ${media.imageUrl}`, error)
        // 继续删除其他文件，不中断流程
      }
    }
    
  }
}

/**
 * 保存用户生成的视频（自动维护数量限制）
 * @param userId 用户ID，如果为null则视为未登录用户
 */
export async function saveUserGeneratedVideo(
  userId: string | null,
  videoBase64: string,
  metadata?: {
    prompt?: string
    model?: string
    width?: number
    height?: number
    duration?: number // 视频时长（秒）
    fps?: number // 视频帧率
    frameCount?: number // 视频总帧数
    ipAddress?: string // 客户端IP地址（用于未登录用户记录）
    referenceImages?: string[] // 参考图的base64数组（不包含data:image前缀）
  }
): Promise<string> {
  // 1. 检查是否为管理员（管理员不记录未通过审核的视频，但可以保存通过的视频）
  if (userId) {
    const userData = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    
    if (userData.length > 0 && userData[0].isAdmin) {
      // 管理员不记录未通过审核的视频，但可以正常保存通过的视频
    }
  }

  // 2. 获取存储配置（数据库 > 环境变量 > 默认值）
  const imageConfig = await getImageStorageConfig()
  
  // 3. 实时检查用户订阅状态（仅登录用户）
  let isSubscribed = false
  let maxMedia = imageConfig.regularUserMaxImages // 所有媒体（图片+视频）的总数限制
  if (userId) {
    isSubscribed = await isSubscribedUser(userId)
    maxMedia = isSubscribed ? imageConfig.subscribedUserMaxImages : imageConfig.regularUserMaxImages
  }
  
  // 4. 将base64转换为Buffer
  const base64Data = videoBase64.replace(/^data:video\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  
  // 4.5 编码视频（统一使用加密存储，避免OSS审核）
  const encodedBuffer = encodeMediaForStorage(buffer)
  
  // 5. 审核（仅提示词审核）
  const moderationBaseUrl = process.env.AVATAR_MODERATION_BASE_URL
  const moderationApiKey = process.env.AVATAR_MODERATION_API_KEY || ''
  const moderationModel = process.env.AVATAR_MODERATION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct-FP8'
  const promptModerationPrompt = process.env.PROMPT_MODERATION_PROMPT || 
    '请判断以下视频生成提示词是否可以在公共场所使用，评判标准包括但不限于不应该包含"黄色"、"血腥"、"暴力"、"政治敏感"等内容，你只需输出是或者否即可。提示词：{prompt}'
  
  if (moderationBaseUrl) {
    // 5.1 提示词审核（如果提供了提示词）
    let promptApproved = true
    if (metadata?.prompt && metadata.prompt.trim()) {
      const { moderatePrompt } = await import('./imageModeration')
      promptApproved = await moderatePrompt(
        metadata.prompt,
        moderationBaseUrl,
        moderationApiKey,
        moderationModel,
        promptModerationPrompt
      )
      
      if (!promptApproved) {
        // 保存未通过审核的视频
        try {
          const { saveRejectedImage } = await import('./rejectedImageStorage')
          
          // 先保存参考图（如果有）
          let referenceImageUrls: string[] = []
          if (metadata?.referenceImages && metadata.referenceImages.length > 0) {
            try {
              const { saveReferenceImages } = await import('./referenceImageStorage')
              referenceImageUrls = await saveReferenceImages(metadata.referenceImages)
            } catch (error) {
              console.error('保存未通过审核视频的参考图失败:', error)
            }
          }
          
          await saveRejectedImage(buffer, {
            userId: userId || null,
            ipAddress: metadata?.ipAddress,
            prompt: metadata?.prompt,
            model: metadata?.model,
            width: metadata?.width,
            height: metadata?.height,
            mediaType: 'video',
            duration: metadata?.duration,
            fps: metadata?.fps,
            frameCount: metadata?.frameCount,
            rejectionReason: 'prompt',
            referenceImages: referenceImageUrls,
          })
          
          // 记录审核未通过，但不抛出错误
          // 这样视频仍然可以返回给用户，但会被保存到 rejectedImageStorage
          console.warn(`[视频保存] 提示词审核未通过，视频已保存到 rejectedImageStorage:`, {
            userId: userId || 'anonymous',
            prompt: metadata?.prompt?.substring(0, 50),
          })
        } catch (error) {
          console.error('保存未通过审核视频失败:', error)
        }
        // 不再抛出错误，允许继续执行，视频可以返回给用户
        // throw new Error('提示词审核未通过，无法保存')
      }
    }
  }
  
  // 6. 审核通过后，保存参考图到OSS（如果有参考图）
  let referenceImageUrls: string[] = []
  if (metadata?.referenceImages && metadata.referenceImages.length > 0) {
    try {
      const { saveReferenceImages } = await import('./referenceImageStorage')
      // 将base64数组转换为OSS URL数组
      referenceImageUrls = await saveReferenceImages(metadata.referenceImages)
    } catch (error) {
      console.error('保存参考图失败:', error)
      // 不阻止主流程，继续保存生成的视频
    }
  }
  
  // 7. 上传到OSS（使用加密存储，.dat扩展名）
  const { v4: uuidv4 } = await import('uuid')
  const fileName = `${uuidv4()}.dat` // 使用.dat扩展名，统一使用加密存储

  // 按日期生成文件夹路径：YYYY/MM/DD
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateFolder = `${year}/${month}/${day}`

  // 构建完整路径：user-generated-videos/YYYY/MM/DD
  const folderPath = `user-generated-videos/${dateFolder}`
  const videoUrl = await uploadToOSS(encodedBuffer, fileName, folderPath) // 使用加密后的buffer
  
  // 8. 获取用户信息（角色、头像、昵称、头像框）- 仅登录用户
  let userData: Array<{
    isAdmin: boolean
    isSubscribed: boolean
    subscriptionExpiresAt: Date | null
    isPremium: boolean
    isOldUser: boolean
    avatar: string | null
    nickname: string | null
    avatarFrameId: number | null
  }> = []
  
  if (userId) {
    const rawUserData = await db
      .select({
        isAdmin: user.isAdmin,
        isSubscribed: user.isSubscribed,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        isPremium: user.isPremium,
        isOldUser: user.isOldUser,
        avatar: user.avatar,
        nickname: user.nickname,
        avatarFrameId: user.avatarFrameId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    
    // 确保布尔字段不为 null
    userData = rawUserData.map(u => ({
      isAdmin: u.isAdmin ?? false,
      isSubscribed: u.isSubscribed ?? false,
      subscriptionExpiresAt: u.subscriptionExpiresAt,
      isPremium: u.isPremium ?? false,
      isOldUser: u.isOldUser ?? false,
      avatar: u.avatar,
      nickname: u.nickname,
      avatarFrameId: u.avatarFrameId,
    }))
  }

  // 判断用户角色
  let userRole: 'admin' | 'subscribed' | 'premium' | 'oldUser' | 'regular' = 'regular'
  if (userData.length > 0) {
    const userInfo = userData[0]
    if (userInfo.isAdmin) {
      userRole = 'admin'
    } else if (userInfo.isSubscribed && userInfo.subscriptionExpiresAt && new Date(userInfo.subscriptionExpiresAt) > new Date()) {
      userRole = 'subscribed'
    } else if (userInfo.isPremium) {
      userRole = 'premium'
    } else if (userInfo.isOldUser) {
      userRole = 'oldUser'
    }
  }

  const userAvatar = userData.length > 0 ? (userData[0].avatar || '/images/default-avatar.svg') : '/images/default-avatar.svg'
  const userNickname = userData.length > 0 ? (userData[0].nickname || null) : null
  const avatarFrameId = userData.length > 0 ? userData[0].avatarFrameId : null

  // 9. 保存到数据库（仅登录用户）
  if (userId) {
    const videoId = uuidv4()
    await db.insert(userGeneratedImages).values({
      id: videoId,
      userId,
      imageUrl: videoUrl,
      mediaType: 'video', // 明确指定为视频类型
      prompt: metadata?.prompt,
      model: metadata?.model,
      width: metadata?.width,
      height: metadata?.height,
      duration: metadata?.duration,
      fps: metadata?.fps,
      frameCount: metadata?.frameCount,
      userRole,
      userAvatar,
      userNickname,
      avatarFrameId,
      referenceImages: referenceImageUrls, // 保存参考图URL数组
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // 10. 自动清理超出数量的旧媒体（图片+视频，从前往后删除，保留最新的）
    // 无论会员是否过期，都会自动维护对应的上限
    await cleanupOldMedia(userId, maxMedia)
  }
  
  return videoUrl
}

