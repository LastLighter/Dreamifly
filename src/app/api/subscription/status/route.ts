import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, userSubscription } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// 获取用户订阅状态
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 获取用户信息
    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = currentUser[0];

    // 获取最新的订阅记录
    const subscriptions = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, session.user.id),
          eq(userSubscription.status, 'active')
        )
      )
      .orderBy(desc(userSubscription.expiresAt))
      .limit(1);

    const activeSubscription = subscriptions.length > 0 ? subscriptions[0] : null;

    // 检查订阅是否有效
    const isActive = userData.isSubscribed && 
      userData.subscriptionExpiresAt && 
      new Date(userData.subscriptionExpiresAt) > new Date();

    return NextResponse.json({
      success: true,
      isSubscribed: isActive,
      subscription: activeSubscription ? {
        planType: activeSubscription.planType,
        status: activeSubscription.status,
        startedAt: activeSubscription.startedAt,
        expiresAt: activeSubscription.expiresAt,
      } : null,
      expiresAt: userData.subscriptionExpiresAt,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}









