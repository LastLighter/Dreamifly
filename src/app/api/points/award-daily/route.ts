import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, userPoints } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPointsConfig, hasAwardedToday } from '@/utils/points';
import { randomUUID } from 'crypto';

// 检查用户订阅是否有效
function isSubscriptionActive(userData: { isSubscribed: boolean | null; subscriptionExpiresAt: Date | null }): boolean {
  if (!userData.isSubscribed) return false;
  if (!userData.subscriptionExpiresAt) return false;
  return new Date(userData.subscriptionExpiresAt) > new Date();
}

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

    // 检查是否是手动签到请求（新版本前端）
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      requestBody = {};
    }

    // 如果请求中没有 manual: true 参数，说明是旧版本前端自动签到，拒绝请求
    if (!requestBody.manual || requestBody.manual !== true) {
      return NextResponse.json({ 
        error: '请使用最新版本进行手动签到',
        code: 'MANUAL_CHECKIN_REQUIRED'
      }, { status: 400 });
    }

    // 获取用户信息（包含订阅相关字段）
    const currentUser = await db.select({
      id: user.id,
      isAdmin: user.isAdmin,
      isPremium: user.isPremium,
      isActive: user.isActive,
      isSubscribed: user.isSubscribed,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
    })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = currentUser[0];
    const isAdmin = userData.isAdmin || false;
    const isSubscribed = isSubscriptionActive({
      isSubscribed: userData.isSubscribed,
      subscriptionExpiresAt: userData.subscriptionExpiresAt,
    });
    
    // 检查用户是否被封禁
    if (!userData.isActive) {
      return NextResponse.json({ 
        error: '您的账号已被封禁，无法签到获得积分',
        code: 'USER_BANNED'
      }, { status: 403 });
    }
    
    const config = await getPointsConfig();
    const expiresInDays = config.pointsExpiryDays;
    
    // 确定用户类型
    let userType = 'regular';
    if (isSubscribed) {
      userType = 'subscribed';
    } else if (userData.isPremium) {
      userType = 'premium';
    }

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
    // 订阅用户获得双倍积分
    const isPremium = userData.isPremium || false;
    const basePoints = isPremium 
      ? config.premiumUserDailyPoints 
      : config.regularUserDailyPoints;
    
    // 订阅用户双倍积分
    const pointsToAward = isSubscribed ? basePoints * 2 : basePoints;

    // 计算过期时间（获得时间 + 过期天数）
    const earnedAt = new Date();
    const expiresAt = new Date(earnedAt);
    expiresAt.setDate(expiresAt.getDate() + config.pointsExpiryDays);

    // 插入积分记录
    const description = isSubscribed ? '每日登录奖励（会员双倍）' : '每日登录奖励';
    await db.insert(userPoints).values({
      id: randomUUID(),
      userId: session.user.id,
      points: pointsToAward,
      type: 'earned',
      description,
      earnedAt,
      expiresAt,
    });

    // 更新用户表的最后签到日期
    await db
      .update(user)
      .set({
        lastDailyAwardDate: earnedAt,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({
      success: true,
      awarded: true,
      points: pointsToAward,
      expiresInDays,
      userType,
      isSubscribed,
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
// 注意：GET请求无法传递body，所以会被拒绝（只有新版本的手动签到POST请求才能成功）
export async function GET(_request: NextRequest) {
  // GET请求无法传递manual参数，直接拒绝（防止旧版本自动签到）
  return NextResponse.json({ 
    error: '请使用最新版本进行手动签到',
    code: 'MANUAL_CHECKIN_REQUIRED'
  }, { status: 400 });
}

