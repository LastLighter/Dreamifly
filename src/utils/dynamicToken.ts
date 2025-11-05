import MD5 from 'crypto-js/md5'

/**
 * 生成动态API token
 * 使用格式: MD5(NEXT_PUBLIC_API_KEY + YYYYMMDDHHmm)
 * @param serverTimeString 服务器时间字符串（格式：YYYYMMDDHHmm），如果未提供则使用本地时间（降级方案）
 * @returns 动态生成的token字符串
 */
export function generateDynamicToken(serverTimeString?: string): string {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_API_KEY is not defined')
  }

  let salt: string
  
  if (serverTimeString) {
    // 使用服务器时间
    salt = serverTimeString
  } else {
    // 降级方案：使用本地时间（如果获取服务器时间失败）
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    salt = `${year}${month}${day}${hour}${minute}`
  }
  
  // 生成MD5哈希: MD5(密钥 + 盐值)
  const token = MD5(apiKey + salt).toString()
  
  return token
}

/**
 * 获取服务器时间并生成动态token
 * @returns 动态生成的token字符串
 */
export async function generateDynamicTokenWithServerTime(): Promise<string> {
  try {
    // 获取服务器时间
    const response = await fetch('/api/time', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    })
    
    if (!response.ok) {
      throw new Error('Failed to fetch server time')
    }
    
    const data = await response.json()
    
    // 使用服务器时间生成token
    return generateDynamicToken(data.timeString)
  } catch (error) {
    console.warn('Failed to fetch server time, using local time as fallback:', error)
    // 降级方案：如果获取服务器时间失败，使用本地时间
    return generateDynamicToken()
  }
}

