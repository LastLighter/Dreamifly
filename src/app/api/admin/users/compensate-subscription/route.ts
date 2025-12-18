import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { subscriptionPlan, user, userPoints, userSubscription } from '@/db/schema'

type PlanLite = {
  id: number
  name: string
  type: string
  bonusPoints: number | null
  isActive: boolean | null
}

function addPlanDuration(base: Date, planType: string) {
  const temp = new Date(base)

  if (planType === 'monthly') {
    temp.setMonth(temp.getMonth() + 1)
  } else if (planType === 'quarterly') {
    temp.setMonth(temp.getMonth() + 3)
  } else if (planType === 'yearly') {
    temp.setFullYear(temp.getFullYear() + 1)
  } else {
    throw new Error('未知的套餐类型')
  }

  return temp
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }

    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (!currentUser[0]?.isAdmin) {
      return NextResponse.json({ error: '无权限访问，需要管理员权限' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, planId } = body || {}

    if (!userId || planId === undefined || planId === null) {
      return NextResponse.json({ error: '缺少参数：userId 或 planId' }, { status: 400 })
    }

    const planIdInt = parseInt(planId, 10)
    if (!Number.isInteger(planIdInt) || planIdInt <= 0) {
      return NextResponse.json({ error: 'planId 必须为正整数' }, { status: 400 })
    }

    const targetUsers = await db
      .select({
        id: user.id,
        isSubscribed: user.isSubscribed,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    const plans = await db
      .select({
        id: subscriptionPlan.id,
        name: subscriptionPlan.name,
        type: subscriptionPlan.type,
        bonusPoints: subscriptionPlan.bonusPoints,
        isActive: subscriptionPlan.isActive,
      })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, planIdInt))
      .limit(1)

    if (plans.length === 0) {
      return NextResponse.json({ error: '套餐不存在' }, { status: 404 })
    }

    const plan: PlanLite = plans[0]

    if (plan.isActive === false) {
      return NextResponse.json({ error: '该套餐已下架，无法补偿' }, { status: 400 })
    }

    const now = new Date()
    const targetUser = targetUsers[0]
    const baseDate =
      targetUser.isSubscribed && targetUser.subscriptionExpiresAt && targetUser.subscriptionExpiresAt.getTime() > now.getTime()
        ? targetUser.subscriptionExpiresAt
        : now

    let newExpiresAt: Date
    try {
      newExpiresAt = addPlanDuration(baseDate, plan.type)
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message || '无法计算会员时长' }, { status: 400 })
    }

    const existingSubs = await db
      .select()
      .from(userSubscription)
      .where(eq(userSubscription.userId, userId))
      .limit(1)

    if (existingSubs.length > 0) {
      await db
        .update(userSubscription)
        .set({
          planType: plan.type,
          status: 'active',
          expiresAt: newExpiresAt,
          updatedAt: now,
        })
        .where(eq(userSubscription.userId, userId))
    } else {
      await db.insert(userSubscription).values({
        id: randomUUID(),
        userId,
        planType: plan.type,
        status: 'active',
        startedAt: now,
        expiresAt: newExpiresAt,
      })
    }

    await db
      .update(user)
      .set({
        isSubscribed: true,
        subscriptionExpiresAt: newExpiresAt,
        updatedAt: now,
      })
      .where(eq(user.id, userId))

    if (plan.bonusPoints && plan.bonusPoints > 0) {
      const pointsExpiresAt = new Date()
      pointsExpiresAt.setDate(pointsExpiresAt.getDate() + 365)

      await db.insert(userPoints).values({
        id: randomUUID(),
        userId,
        points: plan.bonusPoints,
        type: 'earned',
        description: `管理员补偿会员 - ${plan.name}`,
        earnedAt: now,
        expiresAt: pointsExpiresAt,
      })
    }

    return NextResponse.json({
      success: true,
      subscriptionExpiresAt: newExpiresAt,
      bonusPoints: plan.bonusPoints || 0,
    })
  } catch (error) {
    console.error('Error compensating subscription:', error)
    return NextResponse.json({ error: '补偿失败，请稍后重试' }, { status: 500 })
  }
}




