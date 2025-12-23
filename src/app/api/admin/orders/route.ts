import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user, paymentOrder } from '@/db/schema'
import { and, eq, sql, desc, asc } from 'drizzle-orm'
import { headers } from 'next/headers'

type OrderTypeFilter = 'all' | 'subscription' | 'points'
type OrderStatusFilter = 'all' | 'pending' | 'paid' | 'failed' | 'refunded'

export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }

    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 },
      )
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit
    const search = searchParams.get('search')?.trim() || ''

    const typeFilter = (searchParams.get('type') || 'all') as OrderTypeFilter
    const statusFilter = (searchParams.get('status') || 'all') as OrderStatusFilter

    const sortBy = searchParams.get('sortBy') || 'createdAt' // createdAt, amount, paidAt
    const sortOrder = searchParams.get('sortOrder') || 'desc' // asc, desc

    const whereConditions: any[] = []

    if (typeFilter === 'subscription') {
      whereConditions.push(eq(paymentOrder.orderType, 'subscription'))
    } else if (typeFilter === 'points') {
      whereConditions.push(eq(paymentOrder.orderType, 'points'))
    }

    if (statusFilter !== 'all') {
      whereConditions.push(eq(paymentOrder.status, statusFilter))
    }

    if (search) {
      const like = `%${search}%`
      whereConditions.push(
        sql`(${paymentOrder.id} ILIKE ${like} OR ${user.email} ILIKE ${like} OR COALESCE(${user.name}, '') ILIKE ${like})` as any,
      )
    }

    const whereClause = whereConditions.length ? and(...whereConditions) : undefined

    // 总数 & 当前筛选条件下的总金额
    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)`,
      })
      .from(paymentOrder)
      .leftJoin(user, eq(paymentOrder.userId, user.id))
      .where(whereClause as any)

    const total = totalResult[0]?.count || 0
    const totalAmount = Number(totalResult[0]?.totalAmount || 0)

    // 排序字段
    let orderByExpr: any = desc(paymentOrder.createdAt)
    if (sortBy === 'amount') {
      orderByExpr =
        sortOrder === 'asc'
          ? asc(paymentOrder.amount)
          : desc(paymentOrder.amount)
    } else if (sortBy === 'paidAt') {
      orderByExpr =
        sortOrder === 'asc'
          ? asc(paymentOrder.paidAt)
          : desc(paymentOrder.paidAt)
    } else {
      orderByExpr =
        sortOrder === 'asc'
          ? asc(paymentOrder.createdAt)
          : desc(paymentOrder.createdAt)
    }

    const orders = await db
      .select({
        id: paymentOrder.id,
        orderType: paymentOrder.orderType,
        productId: paymentOrder.productId,
        amount: paymentOrder.amount,
        pointsAmount: paymentOrder.pointsAmount,
        status: paymentOrder.status,
        paymentMethod: paymentOrder.paymentMethod,
        paymentId: paymentOrder.paymentId,
        createdAt: paymentOrder.createdAt,
        paidAt: paymentOrder.paidAt,
        userEmail: user.email,
        userName: user.name,
      })
      .from(paymentOrder)
      .leftJoin(user, eq(paymentOrder.userId, user.id))
      .where(whereClause as any)
      .orderBy(orderByExpr)
      .limit(limit)
      .offset(offset)

    return NextResponse.json({
      page,
      limit,
      total,
      totalAmount,
      orders,
    })
  } catch (error) {
    console.error('Error fetching admin orders:', error)
    return NextResponse.json(
      { error: '获取订单列表失败' },
      { status: 500 },
    )
  }
}


