import { NextResponse } from 'next/server'

/**
 * 获取服务器当前时间
 * 这是一个公开接口，不需要验证，用于客户端获取服务器时间生成动态token
 */
export async function GET() {
  const now = new Date()
  
  return NextResponse.json({
    timestamp: now.getTime(),
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    // 同时返回格式化的时间字符串，方便客户端使用
    timeString: `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  })
}




