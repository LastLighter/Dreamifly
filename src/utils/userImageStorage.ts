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
  return isSubscribed && 
    subscriptionExpiresAt && 
    new Date(subscriptionExpiresAt) > new Date()
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
 */
export async function saveUserGeneratedImage(
  userId: string,
  imageBase64: string,
  metadata?: {
    prompt?: string
    model?: string
    width?: number
    height?: number
  }
): Promise<string> {
  // 1. 获取图片存储配置（数据库 > 环境变量 > 默认值）
  const imageConfig = await getImageStorageConfig()
  
  // 2. 实时检查用户订阅状态
  const isSubscribed = await isSubscribedUser(userId)
  const maxImages = isSubscribed ? imageConfig.subscribedUserMaxImages : imageConfig.regularUserMaxImages
  
  // 2. 将base64转换为Buffer
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  
  // 3. 图片审核
  const moderationBaseUrl = process.env.AVATAR_MODERATION_BASE_URL
  const moderationApiKey = process.env.AVATAR_MODERATION_API_KEY || ''
  const moderationModel = process.env.AVATAR_MODERATION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct-FP8'
  const moderationPrompt = process.env.GENERATED_IMAGE_MODERATION_PROMPT || 
    '请判断图片的内容与文字是否可以在公共场所展示，评判标准包括但不限于不应该包含"黄色"、"血腥"、"过于夸张的暴力场景"，你只需输出是或者否即可'
  
  if (moderationBaseUrl) {
    const isApproved = await moderateGeneratedImage(
      buffer,
      'generated-image.png',
      moderationBaseUrl,
      moderationApiKey,
      moderationModel,
      moderationPrompt
    )
    
    if (!isApproved) {
      throw new Error('图片审核未通过，无法保存')
    }
  }
  
  // 4. 上传到OSS（使用新目录 user-generated-images）
  const { v4: uuidv4 } = await import('uuid')
  const fileName = `${uuidv4()}.png`
  const imageUrl = await uploadToOSS(buffer, fileName, 'user-generated-images')
  
  // 5. 保存到数据库
  const imageId = uuidv4()
  await db.insert(userGeneratedImages).values({
    id: imageId,
    userId,
    imageUrl,
    prompt: metadata?.prompt,
    model: metadata?.model,
    width: metadata?.width,
    height: metadata?.height,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  
  // 6. 自动清理超出数量的旧图片（从前往后删除，保留最新的）
  // 无论会员是否过期，都会自动维护对应的上限
  await cleanupOldImages(userId, maxImages)
  
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

