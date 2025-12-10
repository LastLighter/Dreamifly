import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptionPlan } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

const TEST_PLAN_ID = 999001;

// 获取所有激活的订阅套餐
export async function GET() {
  try {
    const plans = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true))
      .orderBy(asc(subscriptionPlan.sortOrder));

    // 解析 features JSON 字段
    const formattedPlans = plans.map(plan => ({
      ...plan,
      features: plan.features ? JSON.parse(plan.features) : [],
    }));

    // 本地/非生产环境添加测试会员挡位（0.1元）
    if (process.env.NODE_ENV !== 'production') {
      formattedPlans.push({
        id: TEST_PLAN_ID,
        name: '测试会员（本地）',
        type: 'monthly',
        price: 0.1,
        originalPrice: null,
        bonusPoints: 0,
        dailyPointsMultiplier: 1,
        description: '用于本地支付联调的测试套餐',
        features: ['测试用，不计入正式权益'],
        isActive: true,
        isPopular: false,
        sortOrder: 9999,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      plans: formattedPlans,
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

