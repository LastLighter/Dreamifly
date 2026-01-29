import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getRedemptionHistory } from '@/utils/cdkManager';

export async function GET(request: Request) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const userId = searchParams.get('userId') || undefined;
    const cdkId = searchParams.get('cdkId') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const result = await getRedemptionHistory(page, pageSize, {
      userId,
      cdkId,
      startDate,
      endDate,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('获取兑换记录失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
