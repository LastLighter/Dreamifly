import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getAvailablePointsPackages, getAvailableSubscriptionPlans } from '@/utils/cdkManager';

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
    const type = searchParams.get('type'); // 'points' 或 'subscription'

    let packages;
    if (type === 'points') {
      packages = await getAvailablePointsPackages();
    } else if (type === 'subscription') {
      packages = await getAvailableSubscriptionPlans();
    } else {
      // 返回所有类型的包
      const [pointsPackages, subscriptionPlans] = await Promise.all([
        getAvailablePointsPackages(),
        getAvailableSubscriptionPlans()
      ]);
      packages = {
        points: pointsPackages,
        subscription: subscriptionPlans
      };
    }

    return NextResponse.json({ packages });
  } catch (error) {
    console.error('获取包列表失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
