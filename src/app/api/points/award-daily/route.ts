import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, userPoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPointsConfig, hasAwardedToday } from '@/utils/points';
import { randomUUID } from 'crypto';

// 每日积分发放API
export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户信息
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = currentUser[0];
    const isAdmin = userData.isAdmin || false;
    const config = await getPointsConfig();
    const expiresInDays = config.pointsExpiryDays;
    const userType = userData.isPremium ? 'premium' : 'regular';

    // 管理员不发放积分
    if (isAdmin) {
      return NextResponse.json({ 
        success: true, 
        awarded: false,
        points: 0,
        expiresInDays,
        userType: 'admin' 
      });
    }

    // 检查今天是否已发放过积分
    const alreadyAwarded = await hasAwardedToday(session.user.id);
    if (alreadyAwarded) {
      return NextResponse.json({ 
        success: true, 
        awarded: false,
        points: 0,
        expiresInDays,
        userType
      });
    }

    // 根据用户角色获取应发放的积分数
    const isPremium = userData.isPremium || false;
    const pointsToAward = isPremium 
      ? config.premiumUserDailyPoints 
      : config.regularUserDailyPoints;

    // 计算过期时间（获得时间 + 过期天数）
    const earnedAt = new Date();
    const expiresAt = new Date(earnedAt);
    expiresAt.setDate(expiresAt.getDate() + config.pointsExpiryDays);

    // 插入积分记录
    await db.insert(userPoints).values({
      id: randomUUID(),
      userId: session.user.id,
      points: pointsToAward,
      type: 'earned',
      description: '每日登录奖励',
      earnedAt,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      awarded: true,
      points: pointsToAward,
      expiresInDays,
      userType,
    });
  } catch (error) {
    console.error('Error awarding daily points:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 支持GET请求（用于客户端调用）
export async function GET(request: NextRequest) {
  return POST(request);
}

