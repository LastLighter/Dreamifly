import { NextRequest, NextResponse } from 'next/server';
import { isEmailDomainAllowed } from '@/utils/email-domain-validator';

/**
 * 验证邮箱域名是否允许
 * GET /api/auth/validate-email-domain?email=xxx@example.com
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: '邮箱地址不能为空' },
        { status: 400 }
      );
    }

    const isValid = await isEmailDomainAllowed(email);

    return NextResponse.json({
      isValid,
      email,
    });
  } catch (error) {
    console.error('Error validating email domain:', error);
    return NextResponse.json(
      { error: '验证邮箱域名时出错' },
      { status: 500 }
    );
  }
}

