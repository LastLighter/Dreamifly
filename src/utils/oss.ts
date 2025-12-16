import OSS from 'ali-oss'

// OSS配置
const ossConfig = {
  accessKeyId: process.env.OSS_AK!,
  accessKeySecret: process.env.OSS_SK!,
  bucket: process.env.OSS_BUCKET!,
  endpoint: process.env.OSS_ENDPOINT!,
  secure: true, // 使用HTTPS
}

// 创建OSS客户端实例（仅在配置完整时）
let client: OSS | null = null

function getOSSClient(): OSS {
  if (!client) {
    if (!checkOSSConfig()) {
      throw new Error('OSS配置不完整')
    }
    client = new OSS(ossConfig)
  }
  return client
}

/**
 * 上传文件到OSS
 * @param file 文件对象
 * @param fileName 文件名
 * @param folder 文件夹路径，默认为 'avatars'
 * @returns 返回文件的完整URL
 */
export async function uploadToOSS(
  file: Buffer,
  fileName: string,
  folder: string = 'avatars'
): Promise<string> {
  try {
    const ossClient = getOSSClient()
    const objectName = `${folder}/${fileName}`
    
    const result = await ossClient.put(objectName, file)
    
    // 返回文件的完整URL
    return result.url
  } catch (error) {
    console.error('OSS上传失败:', error)
    throw new Error('文件上传失败')
  }
}

/**
 * 删除OSS中的文件
 * @param fileUrl 文件的完整URL
 * @returns 是否删除成功
 */
export async function deleteFromOSS(fileUrl: string): Promise<boolean> {
  try {
    const ossClient = getOSSClient()
    // 从URL中提取object name
    const url = new URL(fileUrl)
    const objectName = url.pathname.substring(1) // 移除开头的 '/'
    
    await ossClient.delete(objectName)
    return true
  } catch (error) {
    console.error('OSS删除失败:', error)
    return false
  }
}

/**
 * 检查OSS配置是否完整
 * @returns 配置是否完整
 */
export function checkOSSConfig(): boolean {
  return !!(
    process.env.OSS_AK &&
    process.env.OSS_SK &&
    process.env.OSS_BUCKET &&
    process.env.OSS_ENDPOINT
  )
}

/**
 * 生成OSS图片缩略图URL
 * 使用阿里云OSS的图片处理功能生成缩略图
 * @param originalUrl 原始图片URL
 * @param width 缩略图宽度（默认300）
 * @param height 缩略图高度（默认300，如果为0则按比例缩放）
 * @param quality 图片质量（1-100，默认80）
 * @returns 缩略图URL
 */
export function getThumbnailUrl(
  originalUrl: string,
  width: number = 300,
  height: number = 300,
  quality: number = 80
): string {
  // 如果不是OSS URL，直接返回原URL
  if (!originalUrl || (!originalUrl.includes('oss') && !originalUrl.includes('aliyuncs'))) {
    return originalUrl
  }

  try {
    const url = new URL(originalUrl)
    
    // 构建图片处理参数
    // m_fill: 等比缩放，短边优先
    // m_lfit: 等比缩放，长边优先
    // m_fixed: 固定宽高，可能会裁剪
    let processParams = `image/resize,m_lfit`
    
    if (width > 0) {
      processParams += `,w_${width}`
    }
    
    if (height > 0) {
      processParams += `,h_${height}`
    }
    
    // 添加质量参数
    if (quality > 0 && quality <= 100) {
      processParams += `/quality,q_${quality}`
    }
    
    // 添加处理参数到URL
    url.searchParams.set('x-oss-process', processParams)
    
    return url.toString()
  } catch (error) {
    console.error('生成缩略图URL失败:', error)
    // 如果URL解析失败，返回原URL
    return originalUrl
  }
}