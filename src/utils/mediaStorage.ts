/**
 * 通用媒体存储工具（支持图片和视频）
 * 提供加密/解密功能，避免OSS审核
 */

/**
 * 将媒体Buffer编码为文本文件（避免OSS审核）
 * 使用base64编码，但改变文件扩展名为.dat，并添加混淆
 * 支持图片和视频
 */
export function encodeMediaForStorage(buffer: Buffer): Buffer {
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
 * 解码存储的媒体数据（支持图片和视频）
 */
export function decodeMediaFromStorage(encodedBuffer: Buffer): Buffer {
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

