import { NextRequest, NextResponse } from 'next/server'
import { defaultLocale } from '@/config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  let callbackURL = request.nextUrl.searchParams.get('callbackURL') || '/reset-password'
  
  // 如果 callbackURL 不包含 locale，添加默认 locale
  if (!callbackURL.startsWith('/zh/') && !callbackURL.startsWith('/en/') && !callbackURL.startsWith('/zh-TW/')) {
    callbackURL = `/${defaultLocale}${callbackURL}`
  }
  
  // 优先使用请求的原始域名（从 Host 头或 X-Forwarded-Host 获取）
  // 这样可以确保即使服务器运行在 localhost，也能重定向到正确的生产域名
  const host = request.headers.get('x-forwarded-host') || 
               request.headers.get('host') || 
               new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://dreamifly.com').host
  
  // 判断协议（从 X-Forwarded-Proto 或请求 URL 获取）
  const protocol = request.headers.get('x-forwarded-proto') || 
                   (request.url.startsWith('https') ? 'https' : 'http')
  
  // 构建完整的重定向 URL
  const baseURL = `${protocol}://${host}`
  const redirectURL = new URL(callbackURL, baseURL)
  redirectURL.searchParams.set('token', token)
  
  return NextResponse.redirect(redirectURL)
}

