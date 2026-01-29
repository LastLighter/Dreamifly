import { NextResponse } from 'next/server'
import { db } from '@/db'
import { modelUsageStats, user } from '@/db/schema'
import { gte, lt, sql, eq, and, isNotNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date()
  
  switch (range) {
    case 'hour':
      // 一小时前（UTC时间，与数据库存储的timestamp类型一致）
      return new Date(now.getTime() - 60 * 60 * 1000)
    case 'today':
      // 今天00:00:00（中国时区 UTC+8）
      // 使用 Intl API 获取中国时区的当前日期组件
      const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(now)
      
      const year = parseInt(shanghaiDate.find(p => p.type === 'year')!.value)
      const month = parseInt(shanghaiDate.find(p => p.type === 'month')!.value) - 1
      const day = parseInt(shanghaiDate.find(p => p.type === 'day')!.value)
      
      // 创建中国时区今天00:00:00的Date对象，然后转换为UTC
      // 中国时区是UTC+8，所以需要减去8小时
      const todayInShanghai = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      return new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
    case 'yesterday':
      // 昨天00:00:00（中国时区 UTC+8）
      // 先获取今天00:00:00的UTC时间，然后减去24小时得到昨天
      const shanghaiDateYesterday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(now)
      
      const yearYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'year')!.value)
      const monthYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'month')!.value) - 1
      const dayYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'day')!.value)
      
      // 创建中国时区今天00:00:00的UTC时间戳，然后减去24小时得到昨天
      const todayInShanghaiForYesterday = new Date(Date.UTC(yearYesterday, monthYesterday, dayYesterday, 0, 0, 0, 0))
      const todayUTCForYesterday = new Date(todayInShanghaiForYesterday.getTime() - 8 * 60 * 60 * 1000)
      return new Date(todayUTCForYesterday.getTime() - 24 * 60 * 60 * 1000)
    case 'week':
      // 7天前（UTC时间）
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    case 'month':
      // 30天前（UTC时间）
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    case 'all':
      return new Date(0) // 从1970年开始
    default:
      const defaultDate = new Date(now)
      defaultDate.setHours(0, 0, 0, 0)
      return defaultDate
  }
}

// 获取时间范围的结束时间（用于 yesterday 等需要精确日期范围的情况）
function getTimeRangeEndDate(range: TimeRange): Date | null {
  if (range !== 'yesterday') {
    return null // 其他时间范围不需要结束时间限制
  }
  
  const now = new Date()
  // 对于 yesterday，结束时间是今天00:00:00（中国时区 UTC+8）
  const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now)
  
  const year = parseInt(shanghaiDate.find(p => p.type === 'year')!.value)
  const month = parseInt(shanghaiDate.find(p => p.type === 'month')!.value) - 1
  const day = parseInt(shanghaiDate.find(p => p.type === 'day')!.value)
  
  // 创建中国时区今天00:00:00的Date对象，然后转换为UTC
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
    const endDate = getTimeRangeEndDate(timeRange)

    // 构建查询条件
    const whereConditions = [gte(modelUsageStats.createdAt, startDate)]
    if (endDate) {
      whereConditions.push(lt(modelUsageStats.createdAt, endDate))
    }

    // 获取模型调用次数统计
    const callCounts = await db
      .select({
        modelName: modelUsageStats.modelName,
        count: sql<number>`count(*)::int`,
        authenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
        unauthenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
      })
      .from(modelUsageStats)
      .where(and(...whereConditions))
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
      .where(and(...whereConditions))
      .groupBy(modelUsageStats.modelName, modelUsageStats.isAuthenticated)

    // 按日期分组统计（用于图表显示）
    // 对于hour范围，按分钟统计；today和yesterday范围按小时统计；其他范围按天统计
    const dailyStats = timeRange === 'hour'
      ? await db
          .select({
            date: sql<string>`date_trunc('minute', ${modelUsageStats.createdAt})::text`,
            modelName: modelUsageStats.modelName,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...whereConditions))
          .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`, modelUsageStats.modelName)
          .orderBy(modelUsageStats.modelName, sql`date_trunc('minute', ${modelUsageStats.createdAt})`)
      : timeRange === 'today' || timeRange === 'yesterday'
      ? await db
          .select({
            date: sql<string>`date_trunc('hour', ${modelUsageStats.createdAt})::text`,
            modelName: modelUsageStats.modelName,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...whereConditions))
          .groupBy(sql`date_trunc('hour', ${modelUsageStats.createdAt})`, modelUsageStats.modelName)
          .orderBy(modelUsageStats.modelName, sql`date_trunc('hour', ${modelUsageStats.createdAt})`)
      : await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::text`,
            modelName: modelUsageStats.modelName,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...whereConditions))
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
      .where(and(...whereConditions))

    // 获取活跃用户数量（去重）
    const activeUsers = await db
      .select({
        count: sql<number>`count(distinct ${modelUsageStats.userId})::int`,
      })
      .from(modelUsageStats)
      .where(and(...whereConditions, isNotNull(modelUsageStats.userId)))

    // 获取已登录用户活跃IP数量（去重）
    const authenticatedIPs = await db
      .select({
        count: sql<number>`count(distinct ${modelUsageStats.ipAddress})::int`,
      })
      .from(modelUsageStats)
      .where(and(...whereConditions, eq(modelUsageStats.isAuthenticated, true), isNotNull(modelUsageStats.ipAddress)))

    // 获取未登录用户IP数量（去重）
    const unauthenticatedIPs = await db
      .select({
        count: sql<number>`count(distinct ${modelUsageStats.ipAddress})::int`,
      })
      .from(modelUsageStats)
      .where(and(...whereConditions, eq(modelUsageStats.isAuthenticated, false), isNotNull(modelUsageStats.ipAddress)))

    // 获取注册统计（基于用户表的createdAt和emailVerified字段）
    // 构建用户注册时间查询条件（与modelUsageStats的时间范围一致）
    const userWhereConditions = [gte(user.createdAt, startDate)]
    if (endDate) {
      userWhereConditions.push(lt(user.createdAt, endDate))
    }

    // 获取注册人数（总数）
    const registeredUsers = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .where(and(...userWhereConditions))

    // 获取有效注册次数（已验证邮箱）
    const verifiedRegistrations = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .where(and(...userWhereConditions, eq(user.emailVerified, true)))

    // 获取无效注册次数（未验证邮箱）
    const unverifiedRegistrations = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(user)
      .where(and(...userWhereConditions, eq(user.emailVerified, false)))

    // 获取每日总计趋势（用于折线图）
    // 对于hour范围，按分钟统计；today和yesterday范围按小时统计；week和month按天统计
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
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`)

      dailyTrend = minuteTrendData.map((stat) => ({
        date: stat.date,
        total: Number(stat.total),
        authenticated: Number(stat.authenticated),
        unauthenticated: Number(stat.unauthenticated),
      }))
    } else if (timeRange === 'today' || timeRange === 'yesterday') {
      // 按小时统计
      const hourTrendData = await db
        .select({
          date: sql<string>`date_trunc('hour', ${modelUsageStats.createdAt})::text`,
          total: sql<number>`count(*)::int`,
          authenticated: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
          unauthenticated: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
        })
        .from(modelUsageStats)
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('hour', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${modelUsageStats.createdAt})`)

      dailyTrend = hourTrendData.map((stat) => ({
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
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

      dailyTrend = dailyTrendData.map((stat) => ({
        date: stat.date,
        total: Number(stat.total),
        authenticated: Number(stat.authenticated),
        unauthenticated: Number(stat.unauthenticated),
      }))
    }

    // 获取用户量趋势数据（活跃用户数、已登录用户IP数、未登录用户IP数）
    let userTrend: Array<{ date: string; activeUsers: number; authenticatedIPs: number; unauthenticatedIPs: number }> = []

    if (timeRange === 'hour') {
      // 按分钟统计用户量趋势
      const minuteUserTrendData = await db
        .select({
          date: sql<string>`date_trunc('minute', ${modelUsageStats.createdAt})::text`,
          activeUsers: sql<number>`count(distinct ${modelUsageStats.userId}) filter (where ${isNotNull(modelUsageStats.userId)})::int`,
          authenticatedIPs: sql<number>`count(distinct ${modelUsageStats.ipAddress}) filter (where ${modelUsageStats.isAuthenticated} = true and ${isNotNull(modelUsageStats.ipAddress)})::int`,
          unauthenticatedIPs: sql<number>`count(distinct ${modelUsageStats.ipAddress}) filter (where ${modelUsageStats.isAuthenticated} = false and ${isNotNull(modelUsageStats.ipAddress)})::int`,
        })
        .from(modelUsageStats)
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`)

      userTrend = minuteUserTrendData.map((stat) => ({
        date: stat.date,
        activeUsers: Number(stat.activeUsers),
        authenticatedIPs: Number(stat.authenticatedIPs),
        unauthenticatedIPs: Number(stat.unauthenticatedIPs),
      }))
    } else if (timeRange === 'today' || timeRange === 'yesterday') {
      // 按小时统计用户量趋势
      const hourUserTrendData = await db
        .select({
          date: sql<string>`date_trunc('hour', ${modelUsageStats.createdAt})::text`,
          activeUsers: sql<number>`count(distinct ${modelUsageStats.userId}) filter (where ${isNotNull(modelUsageStats.userId)})::int`,
          authenticatedIPs: sql<number>`count(distinct ${modelUsageStats.ipAddress}) filter (where ${modelUsageStats.isAuthenticated} = true and ${isNotNull(modelUsageStats.ipAddress)})::int`,
          unauthenticatedIPs: sql<number>`count(distinct ${modelUsageStats.ipAddress}) filter (where ${modelUsageStats.isAuthenticated} = false and ${isNotNull(modelUsageStats.ipAddress)})::int`,
        })
        .from(modelUsageStats)
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('hour', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('hour', ${modelUsageStats.createdAt})`)

      userTrend = hourUserTrendData.map((stat) => ({
        date: stat.date,
        activeUsers: Number(stat.activeUsers),
        authenticatedIPs: Number(stat.authenticatedIPs),
        unauthenticatedIPs: Number(stat.unauthenticatedIPs),
      }))
    } else if (timeRange === 'week' || timeRange === 'month') {
      // 按天统计用户量趋势
      const dailyUserTrendData = await db
        .select({
          date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
          activeUsers: sql<number>`count(distinct ${modelUsageStats.userId}) filter (where ${isNotNull(modelUsageStats.userId)})::int`,
          authenticatedIPs: sql<number>`count(distinct ${modelUsageStats.ipAddress}) filter (where ${modelUsageStats.isAuthenticated} = true and ${isNotNull(modelUsageStats.ipAddress)})::int`,
          unauthenticatedIPs: sql<number>`count(distinct ${modelUsageStats.ipAddress}) filter (where ${modelUsageStats.isAuthenticated} = false and ${isNotNull(modelUsageStats.ipAddress)})::int`,
        })
        .from(modelUsageStats)
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

      userTrend = dailyUserTrendData.map((stat) => ({
        date: stat.date,
        activeUsers: Number(stat.activeUsers),
        authenticatedIPs: Number(stat.authenticatedIPs),
        unauthenticatedIPs: Number(stat.unauthenticatedIPs),
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
          activeUsers: activeUsers[0] ? Number(activeUsers[0].count) : 0,
          authenticatedIPs: authenticatedIPs[0] ? Number(authenticatedIPs[0].count) : 0,
          unauthenticatedIPs: unauthenticatedIPs[0] ? Number(unauthenticatedIPs[0].count) : 0,
          registeredUsers: registeredUsers[0] ? Number(registeredUsers[0].count) : 0,
          verifiedRegistrations: verifiedRegistrations[0] ? Number(verifiedRegistrations[0].count) : 0,
          unverifiedRegistrations: unverifiedRegistrations[0] ? Number(unverifiedRegistrations[0].count) : 0,
        },
        dailyTrend,
        userTrend,
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

