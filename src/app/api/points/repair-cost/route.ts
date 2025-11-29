import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getPointsConfig } from '@/utils/points';

// 获取工作流修复消耗积分（公开API，所有登录用户可访问）
export async function GET() {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 获取积分配置
    const config = await getPointsConfig();

    return NextResponse.json({
      repairWorkflowCost: config.repairWorkflowCost,
    });
  } catch (error) {
    console.error('Error fetching repair cost:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

