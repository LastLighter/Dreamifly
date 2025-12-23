/**
 * 统一的图片显示处理工具
 * 支持普通图片和加密图片的自动识别和解码
 */

/**
 * 判断图片URL是否为加密文件
 * @param imageUrl 图片URL
 * @returns 是否为加密文件（.dat结尾）
 */
export function isEncryptedImage(imageUrl: string): boolean {
  return imageUrl.endsWith('.dat')
}

/**
 * 判断图片URL是否为普通图片文件
 * @param imageUrl 图片URL
 * @returns 是否为普通图片文件（.png, .jpg, .jpeg等）
 */
export function isNormalImage(imageUrl: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
  return imageExtensions.some(ext => imageUrl.toLowerCase().endsWith(ext))
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

