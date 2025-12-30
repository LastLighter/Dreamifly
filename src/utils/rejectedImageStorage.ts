import { db } from '@/db'
import { rejectedImages, user } from '@/db/schema'
import { uploadToOSS } from './oss'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'
import { encodeMediaForStorage, decodeMediaFromStorage } from './mediaStorage'

/**
 * @deprecated 使用 encodeMediaForStorage 代替
 * 保留此函数以保持向后兼容
 */
export function encodeImageForStorage(buffer: Buffer): Buffer {
  return encodeMediaForStorage(buffer)
}

/**
 * @deprecated 使用 decodeMediaFromStorage 代替
 * 保留此函数以保持向后兼容
 */
export function decodeImageFromStorage(encodedBuffer: Buffer): Buffer {
  return decodeMediaFromStorage(encodedBuffer)
}

/**
 * 生成IP地址的哈希值（用于匿名用户存储）
 */
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

/**
 * 保存未通过审核的媒体（图片或视频）
 */
export async function saveRejectedImage(
  mediaBuffer: Buffer,
  metadata: {
    userId?: string | null
    ipAddress?: string
    prompt?: string
    model?: string
    width?: number
    height?: number
    mediaType?: 'image' | 'video' // 媒体类型，默认为 'image'
    duration?: number // 视频时长（秒）
    fps?: number // 视频帧率
    frameCount?: number // 视频总帧数
    rejectionReason: 'image' | 'prompt' | 'both'
    referenceImages?: string[] // 参考图URL数组（已上传到OSS的URL）
  }
): Promise<string> {
  // 1. 检查是否为管理员（管理员不记录）
  if (metadata.userId) {
    const userData = await db
      .select({ isAdmin: user.isAdmin })
      .from(user)
      .where(eq(user.id, metadata.userId))
      .limit(1)
    
    if (userData.length > 0 && userData[0].isAdmin) {
      // 管理员不记录，直接返回空字符串
      return ''
    }
  }

  // 2. 编码媒体（避免OSS审核）
  const encodedBuffer = encodeMediaForStorage(mediaBuffer)
  const mediaType = metadata.mediaType || 'image'

  // 3. 生成文件路径
  const { v4: uuidv4 } = await import('uuid')
  const fileName = `${uuidv4()}.dat` // 使用.dat扩展名
  
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  
  // 确定用户类型和子路径
  const userType = metadata.userId ? 'authenticated' : 'anonymous'
  const userPath = metadata.userId 
    ? metadata.userId 
    : hashIP(metadata.ipAddress || 'unknown')
  
  // 根据媒体类型选择不同的文件夹路径
  const mediaFolder = mediaType === 'video' ? 'rejected-videos' : 'rejected-images'
  const folderPath = `${mediaFolder}/${year}/${month}/${day}/${userType}/${userPath}`
  
  // 4. 上传到OSS
  const imageUrl = await uploadToOSS(encodedBuffer, fileName, folderPath)

  // 5. 保存到数据库（不再保存用户信息字段，改为通过user_id关联实时获取）
  const imageId = uuidv4()
  await db.insert(rejectedImages).values({
    id: imageId,
    userId: metadata.userId || null,
    ipAddress: metadata.ipAddress || null,
    imageUrl,
    mediaType,
    prompt: metadata.prompt || null,
    model: metadata.model || null,
    width: metadata.width || null,
    height: metadata.height || null,
    duration: metadata.duration || null,
    fps: metadata.fps || null,
    frameCount: metadata.frameCount || null,
    rejectionReason: metadata.rejectionReason,
    referenceImages: metadata.referenceImages || [], // 保存参考图URL数组
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return imageId
}

/**
 * 从OSS获取并解码媒体（图片或视频）
 */
export async function getRejectedImageBuffer(imageUrl: string): Promise<Buffer> {
  // 1. 从OSS下载文件
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error('Failed to fetch media from OSS')
  }
  
  // 2. 获取Buffer
  const arrayBuffer = await response.arrayBuffer()
  const encodedBuffer = Buffer.from(arrayBuffer)
  
  // 3. 解码
  return decodeMediaFromStorage(encodedBuffer)
}

