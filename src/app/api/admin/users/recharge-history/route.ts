import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { paymentOrder, pointsPackage, subscriptionPlan, user } from '@/db/schema'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    // 检查管理员权限
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 })
    }

    // 查询用户已完成的付费订单
    const orders = await db
      .select({
        id: paymentOrder.id,
        orderType: paymentOrder.orderType,
        productId: paymentOrder.productId,
        amount: paymentOrder.amount,
        pointsAmount: paymentOrder.pointsAmount,
        paymentMethod: paymentOrder.paymentMethod,
        paidAt: paymentOrder.paidAt,
        createdAt: paymentOrder.createdAt,
      })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.userId, userId),
          eq(paymentOrder.status, 'paid')
        )
      )
      .orderBy(sql`${paymentOrder.paidAt} DESC NULLS LAST, ${paymentOrder.createdAt} DESC`)

    // 获取所有相关的产品ID
    const pointsProductIds = orders
      .filter(o => o.orderType === 'points')
      .map(o => parseInt(o.productId, 10))
      .filter(id => !isNaN(id))
    
    const subscriptionProductIds = orders
      .filter(o => o.orderType === 'subscription')
      .map(o => parseInt(o.productId, 10))
      .filter(id => !isNaN(id))

    // 查询积分套餐信息
    const pointsPackages = pointsProductIds.length > 0
      ? await db
          .select({
            id: pointsPackage.id,
            name: pointsPackage.name,
          })
          .from(pointsPackage)
          .where(inArray(pointsPackage.id, pointsProductIds))
      : []

    // 查询订阅套餐信息
    const subscriptionPlans = subscriptionProductIds.length > 0
      ? await db
          .select({
            id: subscriptionPlan.id,
            name: subscriptionPlan.name,
          })
          .from(subscriptionPlan)
          .where(inArray(subscriptionPlan.id, subscriptionProductIds))
      : []

    // 创建产品名称映射
    const productNameMap = new Map<number, string>()
    pointsPackages.forEach(pkg => {
      productNameMap.set(pkg.id, pkg.name)
    })
    subscriptionPlans.forEach(plan => {
      productNameMap.set(plan.id, plan.name)
    })

    // 构建订单列表
    const orderList = orders.map(order => {
      const productId = parseInt(order.productId, 10)
      const productName = !isNaN(productId) && productNameMap.has(productId)
        ? productNameMap.get(productId)!
        : order.productId

      return {
        id: order.id,
        orderType: order.orderType,
        productName,
        amount: Number(order.amount),
        pointsAmount: order.pointsAmount ? Number(order.pointsAmount) : null,
        paymentMethod: order.paymentMethod,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
      }
    })

    return NextResponse.json({
      success: true,
      orders: orderList,
    })
  } catch (error) {
    console.error('Error fetching recharge history:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch recharge history' },
      { status: 500 }
    )
  }
}

