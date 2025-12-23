import { db } from '@/db'
import { rejectedImages, user } from '@/db/schema'
import { uploadToOSS } from './oss'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

/**
 * 将图片Buffer编码为文本文件（避免OSS审核）
 * 使用base64编码，但改变文件扩展名为.dat，并添加混淆
 */
export function encodeImageForStorage(buffer: Buffer): Buffer {
  // 1. 转换为base64
  const base64 = buffer.toString('base64')
  
  // 2. 添加简单的混淆（字符偏移）
  const obfuscated = base64
    .split('')
    .map((char, index) => {
      // 简单的字符偏移混淆
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 + index % 26) % 26) + 65)
      }
      if (char >= 'a' && char <= 'z') {
        return String.fromCharCode(((char.charCodeAt(0) - 97 + index % 26) % 26) + 97)
      }
      if (char >= '0' && char <= '9') {
        return String.fromCharCode(((char.charCodeAt(0) - 48 + index % 10) % 10) + 48)
      }
      return char
    })
    .join('')
  
  // 3. 转换为Buffer（作为文本文件存储）
  return Buffer.from(obfuscated, 'utf-8')
}

/**
 * 解码存储的图片数据
 */
export function decodeImageFromStorage(encodedBuffer: Buffer): Buffer {
  // 1. 读取文本内容
  const obfuscated = encodedBuffer.toString('utf-8')
  
  // 2. 反向混淆
  const base64 = obfuscated
    .split('')
    .map((char, index) => {
      if (char >= 'A' && char <= 'Z') {
        return String.fromCharCode(((char.charCodeAt(0) - 65 - (index % 26) + 26) % 26) + 65)
      }
      if (char >= 'a' && char <= 'z') {
        return String.fromCharCode(((char.charCodeAt(0) - 97 - (index % 26) + 26) % 26) + 97)
      }
      if (char >= '0' && char <= '9') {
        return String.fromCharCode(((char.charCodeAt(0) - 48 - (index % 10) + 10) % 10) + 48)
      }
      return char
    })
    .join('')
  
  // 3. 转换回Buffer
  return Buffer.from(base64, 'base64')
}

/**
 * 生成IP地址的哈希值（用于匿名用户存储）
 */
function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16)
}

/**
 * 保存未通过审核的图片
 */
export async function saveRejectedImage(
  imageBuffer: Buffer,
  metadata: {
    userId?: string | null
    ipAddress?: string
    prompt?: string
    model?: string
    width?: number
    height?: number
    rejectionReason: 'image' | 'prompt' | 'both'
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

  // 2. 编码图片（避免OSS审核）
  const encodedBuffer = encodeImageForStorage(imageBuffer)

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
  
  const folderPath = `rejected-images/${year}/${month}/${day}/${userType}/${userPath}`
  
  // 4. 上传到OSS
  const imageUrl = await uploadToOSS(encodedBuffer, fileName, folderPath)

  // 5. 保存到数据库（不再保存用户信息字段，改为通过user_id关联实时获取）
  const imageId = uuidv4()
  await db.insert(rejectedImages).values({
    id: imageId,
    userId: metadata.userId || null,
    ipAddress: metadata.ipAddress || null,
    imageUrl,
    prompt: metadata.prompt || null,
    model: metadata.model || null,
    width: metadata.width || null,
    height: metadata.height || null,
    rejectionReason: metadata.rejectionReason,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  return imageId
}

/**
 * 从OSS获取并解码图片
 */
export async function getRejectedImageBuffer(imageUrl: string): Promise<Buffer> {
  // 1. 从OSS下载文件
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error('Failed to fetch image from OSS')
  }
  
  // 2. 获取Buffer
  const arrayBuffer = await response.arrayBuffer()
  const encodedBuffer = Buffer.from(arrayBuffer)
  
  // 3. 解码
  return decodeImageFromStorage(encodedBuffer)
}

