import { NextResponse } from 'next/server'
import { db } from '@/db'
import { modelUsageStats, user } from '@/db/schema'
import { gte, sql, eq, isNotNull, and } from 'drizzle-orm'
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
      const today = new Date(localNow)
      today.setHours(0, 0, 0, 0)
      return today
    case 'week':
      const weekAgo = new Date(localNow)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    case 'month':
      const monthAgo = new Date(localNow)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    case 'all':
      return new Date(0)
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

    // 1. 登录用户调用次数排名
    const userCallRanking = await db
      .select({
        userId: modelUsageStats.userId,
        userName: user.name,
        userEmail: user.email,
        userNickname: user.nickname,
        callCount: sql<number>`count(*)::int`,
      })
      .from(modelUsageStats)
      .innerJoin(user, eq(modelUsageStats.userId, user.id))
      .where(
        and(
          gte(modelUsageStats.createdAt, startDate),
          isNotNull(modelUsageStats.userId),
          eq(modelUsageStats.isAuthenticated, true)
        )
      )
      .groupBy(modelUsageStats.userId, user.name, user.email, user.nickname)
      .orderBy(sql`count(*) DESC`)
      .limit(100)

    // 2. IP调用次数排名（全部用户）
    const allIPRanking = await db
      .select({
        ipAddress: modelUsageStats.ipAddress,
        callCount: sql<number>`count(*)::int`,
        authenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
        unauthenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
      })
      .from(modelUsageStats)
      .where(
        and(
          gte(modelUsageStats.createdAt, startDate),
          isNotNull(modelUsageStats.ipAddress)
        )
      )
      .groupBy(modelUsageStats.ipAddress)
      .orderBy(sql`count(*) DESC`)
      .limit(100)

    // 3. IP调用次数排名（仅登录用户）
    const authenticatedIPRanking = await db
      .select({
        ipAddress: modelUsageStats.ipAddress,
        callCount: sql<number>`count(*)::int`,
      })
      .from(modelUsageStats)
      .where(
        and(
          gte(modelUsageStats.createdAt, startDate),
          isNotNull(modelUsageStats.ipAddress),
          eq(modelUsageStats.isAuthenticated, true)
        )
      )
      .groupBy(modelUsageStats.ipAddress)
      .orderBy(sql`count(*) DESC`)
      .limit(100)

    // 4. IP调用次数排名（仅未登录用户）
    const unauthenticatedIPRanking = await db
      .select({
        ipAddress: modelUsageStats.ipAddress,
        callCount: sql<number>`count(*)::int`,
      })
      .from(modelUsageStats)
      .where(
        and(
          gte(modelUsageStats.createdAt, startDate),
          isNotNull(modelUsageStats.ipAddress),
          eq(modelUsageStats.isAuthenticated, false)
        )
      )
      .groupBy(modelUsageStats.ipAddress)
      .orderBy(sql`count(*) DESC`)
      .limit(100)

    return NextResponse.json(
      {
        timeRange,
        userCallRanking: userCallRanking.map((item) => ({
          userId: item.userId,
          userName: item.userName,
          userEmail: item.userEmail,
          userNickname: item.userNickname,
          callCount: Number(item.callCount),
        })),
        allIPRanking: allIPRanking.map((item) => ({
          ipAddress: item.ipAddress,
          callCount: Number(item.callCount),
          authenticatedCount: Number(item.authenticatedCount),
          unauthenticatedCount: Number(item.unauthenticatedCount),
        })),
        authenticatedIPRanking: authenticatedIPRanking.map((item) => ({
          ipAddress: item.ipAddress,
          callCount: Number(item.callCount),
        })),
        unauthenticatedIPRanking: unauthenticatedIPRanking.map((item) => ({
          ipAddress: item.ipAddress,
          callCount: Number(item.callCount),
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (error) {
    console.error('Error fetching crawler analysis:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch crawler analysis' },
      { status: 500 }
    )
  }
}

