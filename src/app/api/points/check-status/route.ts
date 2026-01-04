import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasAwardedToday } from '@/utils/points';

// 检查签到状态API
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 检查今天是否已签到
    const alreadyAwarded = await hasAwardedToday(session.user.id);

    return NextResponse.json({
      success: true,
      checkedIn: alreadyAwarded,
    });
  } catch (error) {
    console.error('Error checking check-in status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

