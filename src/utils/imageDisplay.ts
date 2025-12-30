/**
 * 统一的媒体显示处理工具（支持图片和视频）
 * 支持普通图片/视频和加密图片/视频的自动识别和解码
 */

/**
 * 判断媒体URL是否为加密文件
 * @param mediaUrl 媒体URL
 * @returns 是否为加密文件（.dat结尾）
 */
export function isEncryptedImage(mediaUrl: string): boolean {
  return mediaUrl.endsWith('.dat')
}

/**
 * 判断媒体URL是否为普通图片文件
 * @param mediaUrl 媒体URL
 * @returns 是否为普通图片文件（.png, .jpg, .jpeg等）
 */
export function isNormalImage(mediaUrl: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
  return imageExtensions.some(ext => mediaUrl.toLowerCase().endsWith(ext))
}

/**
 * 判断媒体URL是否为普通视频文件
 * @param mediaUrl 媒体URL
 * @returns 是否为普通视频文件（.mp4, .webm等）
 */
export function isNormalVideo(mediaUrl: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov']
  return videoExtensions.some(ext => mediaUrl.toLowerCase().endsWith(ext))
}

/**
 * 解码混淆的base64字符串（前端使用）
 */
function decodeObfuscatedBase64(obfuscated: string): string {
  return obfuscated
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
}

/**
 * 解码加密图片（前端使用）
 * @param imageUrl 加密图片URL
 * @returns base64 data URL
 */
export async function decodeImageForDisplay(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }
    
    const obfuscated = await response.text()
    const base64 = decodeObfuscatedBase64(obfuscated)
    return `data:image/png;base64,${base64}`
  } catch (error) {
    console.error('解码图片失败:', error)
    throw error
  }
}

/**
 * 解码加密视频（前端使用）
 * @param videoUrl 加密视频URL
 * @returns base64 data URL
 */
export async function decodeVideoForDisplay(videoUrl: string): Promise<string> {
  try {
    const response = await fetch(videoUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`)
    }
    
    const obfuscated = await response.text()
    const base64 = decodeObfuscatedBase64(obfuscated)
    return `data:video/mp4;base64,${base64}`
  } catch (error) {
    console.error('解码视频失败:', error)
    throw error
  }
}

/**
 * 获取图片显示URL（自动判断是否需要解码）
 * @param imageUrl 原始图片URL
 * @param decodedCache 已解码图片的缓存对象
 * @returns Promise<string> 可直接使用的图片URL
 */
export async function getImageDisplayUrl(
  imageUrl: string,
  decodedCache?: { [key: string]: string }
): Promise<string> {
  // 如果是普通图片文件，直接返回
  if (isNormalImage(imageUrl)) {
    return imageUrl
  }
  
  // 如果是加密文件，检查缓存
  if (isEncryptedImage(imageUrl)) {
    if (decodedCache && decodedCache[imageUrl]) {
      return decodedCache[imageUrl]
    }
    
    // 解码并缓存
    const decodedUrl = await decodeImageForDisplay(imageUrl)
    if (decodedCache) {
      decodedCache[imageUrl] = decodedUrl
    }
    return decodedUrl
  }
  
  // 其他情况，直接返回原URL
  return imageUrl
}

/**
 * 获取视频显示URL（自动判断是否需要解码）
 * @param videoUrl 原始视频URL
 * @param decodedCache 已解码视频的缓存对象
 * @param mediaType 媒体类型（'image' | 'video'），用于判断是图片还是视频
 * @returns Promise<string> 可直接使用的视频URL
 */
export async function getVideoDisplayUrl(
  videoUrl: string,
  decodedCache?: { [key: string]: string },
  mediaType?: 'image' | 'video'
): Promise<string> {
  // 如果是普通视频文件，直接返回
  if (isNormalVideo(videoUrl)) {
    return videoUrl
  }
  
  // 如果是加密文件，检查缓存
  if (isEncryptedImage(videoUrl)) {
    if (decodedCache && decodedCache[videoUrl]) {
      return decodedCache[videoUrl]
    }
    
    // 解码并缓存
    const decodedUrl = await decodeVideoForDisplay(videoUrl)
    if (decodedCache) {
      decodedCache[videoUrl] = decodedUrl
    }
    return decodedUrl
  }
  
  // 其他情况，直接返回原URL
  return videoUrl
}

/**
 * 获取媒体显示URL（自动判断图片或视频，是否需要解码）
 * @param mediaUrl 原始媒体URL
 * @param decodedCache 已解码媒体的缓存对象
 * @param mediaType 媒体类型（'image' | 'video'），如果未提供则自动判断
 * @returns Promise<string> 可直接使用的媒体URL
 */
export async function getMediaDisplayUrl(
  mediaUrl: string,
  decodedCache?: { [key: string]: string },
  mediaType?: 'image' | 'video'
): Promise<string> {
  // 如果指定了媒体类型，使用对应的函数
  if (mediaType === 'video') {
    return getVideoDisplayUrl(mediaUrl, decodedCache, mediaType)
  } else if (mediaType === 'image') {
    return getImageDisplayUrl(mediaUrl, decodedCache)
  }
  
  // 自动判断：优先判断是否为视频
  if (isNormalVideo(mediaUrl)) {
    return mediaUrl
  }
  
  // 否则按图片处理
  return getImageDisplayUrl(mediaUrl, decodedCache)
}

