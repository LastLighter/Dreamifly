import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redeemCDK } from '@/utils/cdkManager';
import { getClientIP } from '@/app/api/generate/route';

export async function POST(request: Request) {
  try {
    // 验证用户登录
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: '请输入CDK' }, { status: 400 });
    }

    const clientIP = getClientIP(request);
    const result = await redeemCDK(code.toUpperCase(), session.user.id, clientIP);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.message
      }, { status: 400 });
    }
  } catch (error) {
    console.error('CDK兑换失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误，请稍后重试'
    }, { status: 500 });
  }
}
