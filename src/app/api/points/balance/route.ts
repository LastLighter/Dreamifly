import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { userPoints } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getPointsBalance } from '@/utils/points';

// 积分余额查询API
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取积分余额
    const balance = await getPointsBalance(session.user.id);

    // 获取积分记录列表（最近30条）
    const records = await db
      .select()
      .from(userPoints)
      .where(eq(userPoints.userId, session.user.id))
      .orderBy(desc(userPoints.earnedAt))
      .limit(30);

    return NextResponse.json({
      balance,
      records: records.map(record => ({
        id: record.id,
        points: record.points,
        type: record.type,
        description: record.description,
        earnedAt: record.earnedAt,
        expiresAt: record.expiresAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching points balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

