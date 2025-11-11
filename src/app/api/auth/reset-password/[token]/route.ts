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
  
  // 重定向到 callbackURL，并带上 token 作为查询参数
  const redirectURL = new URL(callbackURL, request.url)
  redirectURL.searchParams.set('token', token)
  
  return NextResponse.redirect(redirectURL)
}

