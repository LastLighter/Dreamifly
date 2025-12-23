import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptionPlan } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

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

