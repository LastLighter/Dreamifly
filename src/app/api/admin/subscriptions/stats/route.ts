import { NextResponse } from 'next/server'
import { db } from '@/db'
import { user, userSubscription, paymentOrder, subscriptionPlan } from '@/db/schema'
import { gte, lt, gt, lte, sql, eq, and, isNotNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'all'

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date()
  
  switch (range) {
    case 'today':
      // 今天00:00:00（中国时区 UTC+8）
      const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(now)
      
      const year = parseInt(shanghaiDate.find(p => p.type === 'year')!.value)
      const month = parseInt(shanghaiDate.find(p => p.type === 'month')!.value) - 1
      const day = parseInt(shanghaiDate.find(p => p.type === 'day')!.value)
      
      const todayInShanghai = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      return new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
    case 'yesterday':
      const shanghaiDateYesterday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(now)
      
      const yearYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'year')!.value)
      const monthYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'month')!.value) - 1
      const dayYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'day')!.value)
      
      const todayInShanghaiForYesterday = new Date(Date.UTC(yearYesterday, monthYesterday, dayYesterday, 0, 0, 0, 0))
      const todayUTCForYesterday = new Date(todayInShanghaiForYesterday.getTime() - 8 * 60 * 60 * 1000)
      return new Date(todayUTCForYesterday.getTime() - 24 * 60 * 60 * 1000)
    case 'week':
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    case 'month':
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    case 'all':
      return new Date(0)
    default:
      return new Date(0)
  }
}

function getTimeRangeEndDate(range: TimeRange): Date | null {
  if (range !== 'yesterday') {
    return null
  }
  
  const now = new Date()
  const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  
  const year = parseInt(shanghaiDate.find(p => p.type === 'year')!.value)
  const month = parseInt(shanghaiDate.find(p => p.type === 'month')!.value) - 1
  const day = parseInt(shanghaiDate.find(p => p.type === 'day')!.value)
  
  const todayInShanghai = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
  return new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
}

export async function GET(request: Request) {
  try {
    // 检查管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
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
    const timeRange = (searchParams.get('timeRange') || 'all') as TimeRange

    const startDate = getTimeRangeDate(timeRange)
    const endDate = getTimeRangeEndDate(timeRange)

    const now = new Date()
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // 统一的日期字符串（用于与 to_char(..., 'YYYY-MM-DD') 对齐）
    const todayStr = new Date().toISOString().slice(0, 10) // 假设数据库按 UTC 存储，与 to_char 结果一致
    const yesterdayDate = new Date()
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1)
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10)

    // 1. 总订阅用户数
    // - 当 timeRange = 'today' 时：统计今天有订阅记录的用户数（去重，不判断是否仍然有效）
    // - 其他时间范围：统计当前仍然有效的订阅用户数
    let totalSubscriptionsCount = 0

    if (timeRange === 'today') {
      const todaySubscriptions = await db
        .select({
          count: sql<number>`count(distinct ${userSubscription.userId})::int`,
        })
        .from(userSubscription)
        .where(
          sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${todayStr}` as any,
        )

      totalSubscriptionsCount = todaySubscriptions[0]?.count || 0
    } else {
      const totalActiveSubscriptions = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(user)
        .where(
          and(
            eq(user.isSubscribed, true),
            isNotNull(user.subscriptionExpiresAt),
            gt(user.subscriptionExpiresAt, now),
          ),
        )

      totalSubscriptionsCount = totalActiveSubscriptions[0]?.count || 0
    }

    // 2. 今日 / 昨日新增订阅数（用于前端展示，按日期字符串与趋势保持一致）
    const todayNewSubscriptions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSubscription)
      .where(
        sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${todayStr}` as any,
      )

    const yesterdayNewSubscriptions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSubscription)
      .where(
        sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${yesterdayStr}` as any,
      )

    // 3. 本月新增订阅数
    const monthStart = getTimeRangeDate('month')
    const monthNewSubscriptions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSubscription)
      .where(gte(userSubscription.createdAt, monthStart))

    // 4. 收入统计（订阅 + 积分）
    // 构建基础条件：已支付订单
    const baseRevenueConditions = [
      eq(paymentOrder.status, 'paid'),
      isNotNull(paymentOrder.paidAt),
    ]
    
    // 日期范围过滤
    if (timeRange === 'yesterday') {
      baseRevenueConditions.push(
        sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD') = ${yesterdayStr}` as any
      )
    } else if (timeRange === 'today') {
      baseRevenueConditions.push(
        sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD') = ${todayStr}` as any
      )
    } else {
      baseRevenueConditions.push(gte(paymentOrder.paidAt, startDate))
      if (endDate) {
        baseRevenueConditions.push(lt(paymentOrder.paidAt, endDate))
      }
    }

    // 订阅收入条件
    const subscriptionRevenueConditions = [
      ...baseRevenueConditions,
      eq(paymentOrder.orderType, 'subscription'),
    ]

    // 积分收入条件
    const pointsRevenueConditions = [
      ...baseRevenueConditions,
      eq(paymentOrder.orderType, 'points'),
    ]

    // 订阅总收入（当前时间范围）
    const subscriptionTotalRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(and(...subscriptionRevenueConditions))

    // 积分总收入（当前时间范围）
    const pointsTotalRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(and(...pointsRevenueConditions))

    // 今日订阅收入
    const subscriptionTodayRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'subscription'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD') = ${todayStr}` as any
        )
      )

    // 今日积分收入
    const pointsTodayRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'points'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD') = ${todayStr}` as any
        )
      )

    // 昨日订阅收入
    const subscriptionYesterdayRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'subscription'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD') = ${yesterdayStr}` as any
        )
      )

    // 昨日积分收入
    const pointsYesterdayRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'points'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD') = ${yesterdayStr}` as any
        )
      )

    // 本周订阅收入
    const weekStart = getTimeRangeDate('week')
    const subscriptionWeekRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'subscription'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          gte(paymentOrder.paidAt, weekStart)
        )
      )

    // 本周积分收入
    const pointsWeekRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'points'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          gte(paymentOrder.paidAt, weekStart)
        )
      )

    // 本月订阅收入
    const subscriptionMonthRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'subscription'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          gte(paymentOrder.paidAt, monthStart)
        )
      )

    // 本月积分收入
    const pointsMonthRevenue = await db
      .select({ total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)` })
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.orderType, 'points'),
          eq(paymentOrder.status, 'paid'),
          isNotNull(paymentOrder.paidAt),
          gte(paymentOrder.paidAt, monthStart)
        )
      )

    // 5. 订阅套餐分布（按时间范围过滤；基于订单）
    //    这里统计的是「在该时间段内新增的订阅订单中，各套餐类型的占比」
    const planDistribution = await db
      .select({
        planType: subscriptionPlan.type,
        count: sql<number>`count(*)::int`,
      })
      .from(paymentOrder)
      .innerJoin(
        subscriptionPlan,
        // product_id 存的是订阅套餐的 ID（text），这里转成 int 做关联
        sql`${subscriptionPlan.id} = (${paymentOrder.productId})::int` as any,
      )
      .where(and(...subscriptionRevenueConditions))
      .groupBy(subscriptionPlan.type)

    // 6. 订阅状态分布（按时间范围过滤；今天 / 昨天时仅统计对应一天的数据）
    const statusWhereConditions: any[] = []
    if (timeRange === 'yesterday') {
      statusWhereConditions.push(
        sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${yesterdayStr}` as any
      )
    } else if (timeRange === 'today') {
      statusWhereConditions.push(
        sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${todayStr}` as any
      )
    } else {
      statusWhereConditions.push(gte(userSubscription.createdAt, startDate))
      if (endDate) {
        statusWhereConditions.push(lt(userSubscription.createdAt, endDate))
      }
    }

    const statusDistribution = await db
      .select({
        status: userSubscription.status,
        count: sql<number>`count(*)::int`
      })
      .from(userSubscription)
      .where(and(...statusWhereConditions))
      .groupBy(userSubscription.status)

    // 7. 即将过期订阅数（7天内）
    const expiringSoon = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.status, 'active'),
          gte(userSubscription.expiresAt, now),
          lte(userSubscription.expiresAt, sevenDaysLater)
        )
      )

    // 8. 订阅趋势数据（按日期分组；今天 / 昨天时仅统计对应一天的数据）
    const trendWhereConditions: any[] = []
    if (timeRange === 'yesterday') {
      trendWhereConditions.push(
        sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${yesterdayStr}` as any
      )
    } else if (timeRange === 'today') {
      trendWhereConditions.push(
        sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD') = ${todayStr}` as any
      )
    } else {
      trendWhereConditions.push(gte(userSubscription.createdAt, startDate))
      if (endDate) {
        trendWhereConditions.push(lt(userSubscription.createdAt, endDate))
      }
    }

    const subscriptionTrend = await db
      .select({
        date: sql<string>`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`
      })
      .from(userSubscription)
      .where(and(...trendWhereConditions))
      .groupBy(sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${userSubscription.createdAt}, 'YYYY-MM-DD')`)

    // 9. 收入趋势数据（按日期分组，分类统计）
    // 订阅收入趋势
    const subscriptionRevenueTrend = await db
      .select({
        date: sql<string>`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)`,
        count: sql<number>`count(*)::int`
      })
      .from(paymentOrder)
      .where(and(...subscriptionRevenueConditions))
      .groupBy(sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD')`)

    // 积分收入趋势
    const pointsRevenueTrend = await db
      .select({
        date: sql<string>`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD')`,
        total: sql<number>`coalesce(sum(${paymentOrder.amount}), 0)`,
        count: sql<number>`count(*)::int`
      })
      .from(paymentOrder)
      .where(and(...pointsRevenueConditions))
      .groupBy(sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${paymentOrder.paidAt}, 'YYYY-MM-DD')`)

    // 合并收入趋势数据（按日期）
    const allDates = new Set([
      ...subscriptionRevenueTrend.map(r => r.date),
      ...pointsRevenueTrend.map(r => r.date)
    ])
    
    const revenueTrend = Array.from(allDates).sort().map(date => {
      const subData = subscriptionRevenueTrend.find(r => r.date === date)
      const pointsData = pointsRevenueTrend.find(r => r.date === date)
      return {
        date,
        subscription: Number(subData?.total || 0),
        points: Number(pointsData?.total || 0),
        total: Number(subData?.total || 0) + Number(pointsData?.total || 0),
        subscriptionCount: subData?.count || 0,
        pointsCount: pointsData?.count || 0,
      }
    })

    // 使用与收入趋势相同的日期标准计算今日/昨日收入
    const todaySubscriptionRevenue = subscriptionRevenueTrend
      .filter(r => r.date === todayStr)
      .reduce((sum, r) => sum + Number(r.total || 0), 0)

    const todayPointsRevenue = pointsRevenueTrend
      .filter(r => r.date === todayStr)
      .reduce((sum, r) => sum + Number(r.total || 0), 0)

    const yesterdaySubscriptionRevenue = subscriptionRevenueTrend
      .filter(r => r.date === yesterdayStr)
      .reduce((sum, r) => sum + Number(r.total || 0), 0)

    const yesterdayPointsRevenue = pointsRevenueTrend
      .filter(r => r.date === yesterdayStr)
      .reduce((sum, r) => sum + Number(r.total || 0), 0)

    // 计算总收入
    const totalSubscriptionRevenue = Number(subscriptionTotalRevenue[0]?.total || 0)
    const totalPointsRevenue = Number(pointsTotalRevenue[0]?.total || 0)
    const totalRevenue = totalSubscriptionRevenue + totalPointsRevenue

    // 计算收入占比
    const revenueRatio = {
      subscription: totalRevenue > 0 ? (totalSubscriptionRevenue / totalRevenue) * 100 : 0,
      points: totalRevenue > 0 ? (totalPointsRevenue / totalRevenue) * 100 : 0,
    }

    return NextResponse.json({
      totalActiveSubscriptions: totalSubscriptionsCount,
      todayNewSubscriptions: todayNewSubscriptions[0]?.count || 0,
      yesterdayNewSubscriptions: yesterdayNewSubscriptions[0]?.count || 0,
      monthNewSubscriptions: monthNewSubscriptions[0]?.count || 0,
      revenue: {
        total: totalRevenue,
        subscription: {
          total: totalSubscriptionRevenue,
          today: Number(subscriptionTodayRevenue[0]?.total || 0),
          yesterday: Number(subscriptionYesterdayRevenue[0]?.total || 0),
          week: Number(subscriptionWeekRevenue[0]?.total || 0),
          month: Number(subscriptionMonthRevenue[0]?.total || 0),
        },
        points: {
          total: totalPointsRevenue,
          today: Number(pointsTodayRevenue[0]?.total || 0),
          yesterday: Number(pointsYesterdayRevenue[0]?.total || 0),
          week: Number(pointsWeekRevenue[0]?.total || 0),
          month: Number(pointsMonthRevenue[0]?.total || 0),
        },
        // 兼容旧字段
        today: todaySubscriptionRevenue + todayPointsRevenue,
        yesterday: yesterdaySubscriptionRevenue + yesterdayPointsRevenue,
        week: Number(subscriptionWeekRevenue[0]?.total || 0) + Number(pointsWeekRevenue[0]?.total || 0),
        month: Number(subscriptionMonthRevenue[0]?.total || 0) + Number(pointsMonthRevenue[0]?.total || 0),
      },
      revenueRatio,
      planDistribution: planDistribution.map(p => ({
        planType: p.planType,
        count: p.count
      })),
      statusDistribution: statusDistribution.map(s => ({
        status: s.status,
        count: s.count
      })),
      expiringSoon: expiringSoon[0]?.count || 0,
      subscriptionTrend: subscriptionTrend.map(t => ({
        date: t.date,
        count: t.count
      })),
      revenueTrend: revenueTrend
    })
  } catch (error) {
    console.error('Error fetching subscription stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

