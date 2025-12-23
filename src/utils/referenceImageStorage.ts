import { uploadToOSS } from './oss'
import { encodeImageForStorage } from './rejectedImageStorage'
import { v4 as uuidv4 } from 'uuid'

/**
 * 保存参考图到OSS（加密存储）
 * @param imageBase64 参考图的base64字符串（不包含data:image前缀）
 * @returns 返回OSS中的图片URL
 */
export async function saveReferenceImage(imageBase64: string): Promise<string> {
  // 1. 将base64转换为Buffer
  const buffer = Buffer.from(imageBase64, 'base64')
  
  // 2. 加密图片
  const encodedBuffer = encodeImageForStorage(buffer)
  
  // 3. 生成文件名
  const fileName = `${uuidv4()}.dat`
  
  // 4. 按日期生成文件夹路径
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateFolder = `${year}/${month}/${day}`
  
  // 5. 构建完整路径：reference-images/YYYY/MM/DD
  const folderPath = `reference-images/${dateFolder}`
  
  // 6. 上传到OSS
  const imageUrl = await uploadToOSS(encodedBuffer, fileName, folderPath)
  
  return imageUrl
}

/**
 * 批量保存参考图
 * @param imageBase64Array 参考图的base64字符串数组（不包含data:image前缀）
 * @returns 返回OSS中的图片URL数组
 */
export async function saveReferenceImages(imageBase64Array: string[]): Promise<string[]> {
  // 并行上传所有参考图，提高效率
  const uploadPromises = imageBase64Array.map(imageBase64 => 
    saveReferenceImage(imageBase64).catch(error => {
      console.error('单个参考图保存失败:', error)
      return null // 返回null表示失败
    })
  )
  
  const results = await Promise.all(uploadPromises)
  // 过滤掉失败的（null值）
  return results.filter((url): url is string => url !== null)
}

