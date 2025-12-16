import { db } from '@/db'
import { userGeneratedImages, user } from '@/db/schema'
import { eq, asc, desc, sql, and } from 'drizzle-orm'
import { uploadToOSS, deleteFromOSS } from './oss'
import { moderateGeneratedImage } from './imageModeration'
import { getImageStorageConfig } from './points'

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
 * 清理超出数量的旧图片（从前往后删除，保留最新的）
 * @param userId 用户ID
 * @param maxImages 最大图片数量
 */
async function cleanupOldImages(userId: string, maxImages: number): Promise<void> {
  // 获取用户的所有图片，按创建时间升序排列（最旧的在前）
  const allImages = await db
    .select({ 
      id: userGeneratedImages.id, 
      imageUrl: userGeneratedImages.imageUrl 
    })
    .from(userGeneratedImages)
    .where(eq(userGeneratedImages.userId, userId))
    .orderBy(asc(userGeneratedImages.createdAt)) // 按创建时间升序：最旧的在前
  
  // 如果超出数量，删除最旧的图片（从前往后删除）
  if (allImages.length > maxImages) {
    const imagesToDelete = allImages.slice(0, allImages.length - maxImages) // 保留最后 maxImages 张
    
    for (const image of imagesToDelete) {
      // 从数据库删除记录
      await db
        .delete(userGeneratedImages)
        .where(eq(userGeneratedImages.id, image.id))
      
      // 从OSS删除文件
      try {
        await deleteFromOSS(image.imageUrl)
        console.log(`已自动删除旧图片: ${image.imageUrl}`)
      } catch (error) {
        console.error(`删除OSS文件失败: ${image.imageUrl}`, error)
        // 继续删除其他文件，不中断流程
      }
    }
    
    console.log(`用户 ${userId} 自动清理了 ${imagesToDelete.length} 张旧图片，保留最新 ${maxImages} 张`)
  }
}

/**
 * 保存用户生成的图片（自动维护数量限制）
 * @param userId 用户ID，如果为null则视为未登录用户
 */
export async function saveUserGeneratedImage(
  userId: string | null,
  imageBase64: string,
  metadata?: {
    prompt?: string
    model?: string
    width?: number
    height?: number
    ipAddress?: string // 客户端IP地址（用于未登录用户记录）
  }
): Promise<string> {
  // 1. 检查是否为管理员（管理员不记录未通过审核的图片，但可以保存通过的图片）
  if (userId) {
    const userData = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    
    if (userData.length > 0 && userData[0].isAdmin) {
      // 管理员不记录未通过审核的图片，但可以正常保存通过的图片
    }
  }

  // 2. 获取图片存储配置（数据库 > 环境变量 > 默认值）
  const imageConfig = await getImageStorageConfig()
  
  // 3. 实时检查用户订阅状态（仅登录用户）
  let isSubscribed = false
  let maxImages = imageConfig.regularUserMaxImages
  if (userId) {
    isSubscribed = await isSubscribedUser(userId)
    maxImages = isSubscribed ? imageConfig.subscribedUserMaxImages : imageConfig.regularUserMaxImages
  }
  
  // 4. 将base64转换为Buffer
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  
  // 5. 审核（图片和提示词都需要通过）
  const moderationBaseUrl = process.env.AVATAR_MODERATION_BASE_URL
  const moderationApiKey = process.env.AVATAR_MODERATION_API_KEY || ''
  const moderationModel = process.env.AVATAR_MODERATION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct-FP8'
  const imageModerationPrompt = process.env.GENERATED_IMAGE_MODERATION_PROMPT || 
    '请判断图片的内容与文字是否可以在公共场所展示，评判标准包括但不限于不应该包含"黄色"、"血腥"、"过于夸张的暴力场景"，你只需输出是或者否即可'
  const promptModerationPrompt = process.env.PROMPT_MODERATION_PROMPT || 
    '请判断以下图片生成提示词是否可以在公共场所使用，评判标准包括但不限于不应该包含"黄色"、"血腥"、"暴力"、"政治敏感"等内容，你只需输出是或者否即可。提示词：{prompt}'
  
  if (moderationBaseUrl) {
    // 3.1 图片审核
    const imageApproved = await moderateGeneratedImage(
      buffer,
      'generated-image.png',
      moderationBaseUrl,
      moderationApiKey,
      moderationModel,
      imageModerationPrompt
    )
    
    if (!imageApproved) {
      // 保存未通过审核的图片
      try {
        const { saveRejectedImage } = await import('./rejectedImageStorage')
        await saveRejectedImage(buffer, {
          userId: userId || null,
          ipAddress: metadata?.ipAddress,
          prompt: metadata?.prompt,
          model: metadata?.model,
          width: metadata?.width,
          height: metadata?.height,
          rejectionReason: 'image',
        })
      } catch (error) {
        console.error('保存未通过审核图片失败:', error)
      }
      throw new Error('图片审核未通过，无法保存')
    }
    
    // 3.2 提示词审核（如果提供了提示词）
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
        // 保存未通过审核的图片
        try {
          const { saveRejectedImage } = await import('./rejectedImageStorage')
          await saveRejectedImage(buffer, {
            userId: userId || null,
            ipAddress: metadata?.ipAddress,
            prompt: metadata?.prompt,
            model: metadata?.model,
            width: metadata?.width,
            height: metadata?.height,
            rejectionReason: 'prompt',
          })
        } catch (error) {
          console.error('保存未通过审核图片失败:', error)
        }
        throw new Error('提示词审核未通过，无法保存')
      }
    }
    
    // 如果图片和提示词都通过了，但之前图片审核失败过（理论上不会到这里，但为了完整性）
    // 这里不需要额外处理，因为如果图片审核失败，已经在上面的 if 中 throw 了
  }
  
  // 6. 上传到OSS（使用新目录 user-generated-images，按日期分文件夹存储）
  const { v4: uuidv4 } = await import('uuid')
  const fileName = `${uuidv4()}.png`
  
  // 按日期生成文件夹路径：YYYY/MM/DD
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateFolder = `${year}/${month}/${day}`
  
  // 构建完整路径：user-generated-images/YYYY/MM/DD
  const folderPath = `user-generated-images/${dateFolder}`
  const imageUrl = await uploadToOSS(buffer, fileName, folderPath)
  
  // 7. 获取用户信息（角色、头像、昵称、头像框）- 仅登录用户
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

  // 8. 保存到数据库（仅登录用户）
  if (userId) {
    const imageId = uuidv4()
    await db.insert(userGeneratedImages).values({
      id: imageId,
      userId,
      imageUrl,
      prompt: metadata?.prompt,
      model: metadata?.model,
      width: metadata?.width,
      height: metadata?.height,
      userRole,
      userAvatar,
      userNickname,
      avatarFrameId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    
    // 9. 自动清理超出数量的旧图片（从前往后删除，保留最新的）
    // 无论会员是否过期，都会自动维护对应的上限
    await cleanupOldImages(userId, maxImages)
  }
  
  return imageUrl
}

/**
 * 获取用户的所有保存的图片（最新的在前）
 */
export async function getUserGeneratedImages(
  userId: string,
  limit?: number
): Promise<Array<{
  id: string
  imageUrl: string
  prompt?: string | null
  model?: string | null
  width?: number | null
  height?: number | null
  createdAt: Date
}>> {
  const images = await db
    .select()
    .from(userGeneratedImages)
    .where(eq(userGeneratedImages.userId, userId))
    .orderBy(desc(userGeneratedImages.createdAt)) // 按创建时间降序，最新的在前
  
  if (limit) {
    return images.slice(0, limit)
  }
  
  return images
}

/**
 * 删除用户指定的图片
 */
export async function deleteUserGeneratedImage(
  userId: string,
  imageId: string
): Promise<boolean> {
  // 先获取图片信息，确保是用户的图片
  const image = await db
    .select()
    .from(userGeneratedImages)
    .where(
      and(
        eq(userGeneratedImages.id, imageId),
        eq(userGeneratedImages.userId, userId)
      )
    )
    .limit(1)
  
  if (image.length === 0) {
    return false
  }
  
  // 从数据库删除
  await db
    .delete(userGeneratedImages)
    .where(eq(userGeneratedImages.id, imageId))
  
  // 从OSS删除
  try {
    await deleteFromOSS(image[0].imageUrl)
  } catch (error) {
    console.error(`删除OSS文件失败: ${image[0].imageUrl}`, error)
  }
  
  return true
}

/**
 * 获取用户图片存储状态信息
 */
export async function getUserImageStorageInfo(userId: string): Promise<{
  currentCount: number
  maxImages: number
  isSubscribed: boolean
  subscriptionExpiresAt: Date | null
  canAddMore: boolean
  message?: string
}> {
  // 获取图片存储配置（数据库 > 环境变量 > 默认值）
  const imageConfig = await getImageStorageConfig()
  
  const isSubscribed = await isSubscribedUser(userId)
  const maxImages = isSubscribed ? imageConfig.subscribedUserMaxImages : imageConfig.regularUserMaxImages
  
  // 获取当前图片数量
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(userGeneratedImages)
    .where(eq(userGeneratedImages.userId, userId))
  
  const currentCount = Number(countResult[0]?.count || 0)
  
  // 获取订阅过期时间
  const userData = await db
    .select({ subscriptionExpiresAt: user.subscriptionExpiresAt })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  
  const subscriptionExpiresAt = userData[0]?.subscriptionExpiresAt || null
  
  // 判断是否可以新增（实际上总是可以新增，系统会自动清理）
  const canAddMore = true
  
  // 生成提示信息
  let message: string | undefined
  if (!isSubscribed && currentCount >= imageConfig.regularUserMaxImages) {
    message = `您的会员已过期，当前保存了 ${currentCount} 张图片。继续添加新图片时，系统会自动保留最新的 ${imageConfig.regularUserMaxImages} 张。`
  } else if (isSubscribed && currentCount >= imageConfig.subscribedUserMaxImages - 5) {
    message = `您已保存 ${currentCount}/${imageConfig.subscribedUserMaxImages} 张图片，接近上限。继续添加新图片时，系统会自动保留最新的 ${imageConfig.subscribedUserMaxImages} 张。`
  } else if (!isSubscribed) {
    message = `普通用户最多保存 ${imageConfig.regularUserMaxImages} 张图片。订阅会员可保存最多 ${imageConfig.subscribedUserMaxImages} 张。`
  }
  
  return {
    currentCount,
    maxImages,
    isSubscribed,
    subscriptionExpiresAt,
    canAddMore,
    message,
  }
}

