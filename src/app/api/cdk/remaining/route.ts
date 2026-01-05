import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { checkAndResetUserDailyLimit } from '@/utils/cdkManager';

export async function GET() {
  try {
    // 验证用户登录
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const dailyLimitCheck = await checkAndResetUserDailyLimit(session.user.id);

    return NextResponse.json({
      success: true,
      remainingCount: dailyLimitCheck.remainingCount,
      currentCount: dailyLimitCheck.currentCount,
      maxLimit: dailyLimitCheck.maxLimit,
      canRedeem: dailyLimitCheck.canRedeem
    });
  } catch (error) {
    console.error('获取剩余兑换次数失败:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '服务器内部错误，请稍后重试'
    }, { status: 500 });
  }
}

