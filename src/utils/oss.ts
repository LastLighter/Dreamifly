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
