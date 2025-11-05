import { NextResponse } from 'next/server'
import { db } from '@/db'
import { modelUsageStats, user } from '@/db/schema'
import { gte, sql, eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type TimeRange = 'hour' | 'today' | 'week' | 'month' | 'all'

function getTimeRangeDate(range: TimeRange): Date {
  // 使用本地时区创建日期（中国时区 UTC+8）
  const now = new Date()
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
  
  switch (range) {
    case 'hour':
      // 一小时前（中国时区）
      const hourAgo = new Date(localNow)
      hourAgo.setHours(hourAgo.getHours() - 1)
      return hourAgo
    case 'today':
      // 今天00:00:00（中国时区）
      const today = new Date(localNow)
      today.setHours(0, 0, 0, 0)
      return today
    case 'week':
      // 7天前（中国时区）
      const weekAgo = new Date(localNow)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    case 'month':
      // 30天前（中国时区）
      const monthAgo = new Date(localNow)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    case 'all':
      return new Date(0) // 从1970年开始
    default:
      const defaultDate = new Date(localNow)
      defaultDate.setHours(0, 0, 0, 0)
      return defaultDate
  }
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

    // 检查管理员权限
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = (searchParams.get('timeRange') || 'week') as TimeRange

    const startDate = getTimeRangeDate(timeRange)

    // 获取模型调用次数统计
    const callCounts = await db
      .select({
        modelName: modelUsageStats.modelName,
        count: sql<number>`count(*)::int`,
        authenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
        unauthenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
      })
      .from(modelUsageStats)
      .where(gte(modelUsageStats.createdAt, startDate))
      .groupBy(modelUsageStats.modelName)

    // 获取平均响应时间统计（区分登录和未登录）
    const avgResponseTimes = await db
      .select({
        modelName: modelUsageStats.modelName,
        isAuthenticated: modelUsageStats.isAuthenticated,
        avgResponseTime: sql<number>`avg(${modelUsageStats.responseTime})`,
        count: sql<number>`count(*)::int`,
      })
      .from(modelUsageStats)
      .where(gte(modelUsageStats.createdAt, startDate))
      .groupBy(modelUsageStats.modelName, modelUsageStats.isAuthenticated)

    // 按日期分组统计（用于图表显示）
    // 对于hour范围，按分钟统计；其他范围按天统计
    const dailyStats = timeRange === 'hour'
      ? await db
          .select({
            date: sql<string>`date_trunc('minute', ${modelUsageStats.createdAt})::text`,
            modelName: modelUsageStats.modelName,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(gte(modelUsageStats.createdAt, startDate))
          .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`, modelUsageStats.modelName)
          .orderBy(modelUsageStats.modelName, sql`date_trunc('minute', ${modelUsageStats.createdAt})`)
      : await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::text`,
            modelName: modelUsageStats.modelName,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(gte(modelUsageStats.createdAt, startDate))
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, modelUsageStats.modelName)
          .orderBy(modelUsageStats.modelName, sql`date_trunc('day', ${modelUsageStats.createdAt})`)

    // 格式化数据
    const modelStats = callCounts.map((callCount) => {
      const authAvgTime = avgResponseTimes.find(
        (t) => t.modelName === callCount.modelName && t.isAuthenticated === true
      )
      const unauthAvgTime = avgResponseTimes.find(
        (t) => t.modelName === callCount.modelName && t.isAuthenticated === false
      )

      return {
        modelName: callCount.modelName,
        totalCalls: Number(callCount.count),
        authenticatedCalls: Number(callCount.authenticatedCount),
        unauthenticatedCalls: Number(callCount.unauthenticatedCount),
        avgResponseTimeAuthenticated: authAvgTime ? Number(authAvgTime.avgResponseTime) : null,
        avgResponseTimeUnauthenticated: unauthAvgTime ? Number(unauthAvgTime.avgResponseTime) : null,
      }
    })

    // 格式化每日统计数据
    const dailyData = dailyStats.map((stat) => ({
      date: stat.date,
      modelName: stat.modelName,
      count: Number(stat.count),
    }))

    // 获取总计数据
    const totalStats = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        authenticatedCalls: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
        unauthenticatedCalls: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
      })
      .from(modelUsageStats)
      .where(gte(modelUsageStats.createdAt, startDate))

    // 获取每日总计趋势（用于折线图）
    // 对于hour范围，按分钟统计；week和month按天统计
    let dailyTrend: Array<{ date: string; total: number; authenticated: number; unauthenticated: number }> = []
    
    if (timeRange === 'hour') {
      // 按分钟统计
      const minuteTrendData = await db
        .select({
          date: sql<string>`date_trunc('minute', ${modelUsageStats.createdAt})::text`,
          total: sql<number>`count(*)::int`,
          authenticated: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
          unauthenticated: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
        })
        .from(modelUsageStats)
        .where(gte(modelUsageStats.createdAt, startDate))
        .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`)

      dailyTrend = minuteTrendData.map((stat) => ({
        date: stat.date,
        total: Number(stat.total),
        authenticated: Number(stat.authenticated),
        unauthenticated: Number(stat.unauthenticated),
      }))
    } else if (timeRange === 'week' || timeRange === 'month') {
      // 按天统计
      const dailyTrendData = await db
        .select({
          date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
          total: sql<number>`count(*)::int`,
          authenticated: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
          unauthenticated: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
        })
        .from(modelUsageStats)
        .where(gte(modelUsageStats.createdAt, startDate))
        .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

      dailyTrend = dailyTrendData.map((stat) => ({
        date: stat.date,
        total: Number(stat.total),
        authenticated: Number(stat.authenticated),
        unauthenticated: Number(stat.unauthenticated),
      }))
    }

    // 设置响应头，禁用缓存
    return NextResponse.json(
      {
        timeRange,
        modelStats,
        dailyData,
        totalStats: {
          totalCalls: totalStats[0] ? Number(totalStats[0].totalCalls) : 0,
          authenticatedCalls: totalStats[0] ? Number(totalStats[0].authenticatedCalls) : 0,
          unauthenticatedCalls: totalStats[0] ? Number(totalStats[0].unauthenticatedCalls) : 0,
        },
        dailyTrend,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching model stats:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch model stats' },
      { status: 500 }
    )
  }
}

