import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { eq, and, gte, lt, sql, desc } from 'drizzle-orm'

type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date()

  switch (range) {
    case 'hour':
      // 一小时前（UTC时间）
      return new Date(now.getTime() - 60 * 60 * 1000)
    case 'today': {
      // 今天00:00:00（中国时区 UTC+8）
      const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now)

      const year = parseInt(shanghaiDate.find((p) => p.type === 'year')!.value)
      const month = parseInt(shanghaiDate.find((p) => p.type === 'month')!.value) - 1
      const day = parseInt(shanghaiDate.find((p) => p.type === 'day')!.value)

      const todayInShanghai = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
      return new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
    }
    case 'yesterday': {
      // 昨天00:00:00（中国时区 UTC+8）
      const shanghaiDateYesterday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(now)

      const yearYesterday = parseInt(shanghaiDateYesterday.find((p) => p.type === 'year')!.value)
      const monthYesterday = parseInt(shanghaiDateYesterday.find((p) => p.type === 'month')!.value) - 1
      const dayYesterday = parseInt(shanghaiDateYesterday.find((p) => p.type === 'day')!.value)

      const todayInShanghaiForYesterday = new Date(
        Date.UTC(yearYesterday, monthYesterday, dayYesterday, 0, 0, 0, 0)
      )
      const todayUTCForYesterday = new Date(todayInShanghaiForYesterday.getTime() - 8 * 60 * 60 * 1000)
      return new Date(todayUTCForYesterday.getTime() - 24 * 60 * 60 * 1000)
    }
    case 'week': {
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    }
    case 'month': {
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    }
    case 'all':
      return new Date(0)
    default: {
      const defaultDate = new Date(now)
      defaultDate.setHours(0, 0, 0, 0)
      return defaultDate
    }
  }
}

// 获取时间范围的结束时间（仅 yesterday 需要）
function getTimeRangeEndDate(range: TimeRange): Date | null {
  if (range !== 'yesterday') {
    return null
  }

  const now = new Date()
  const shanghaiDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = parseInt(shanghaiDate.find((p) => p.type === 'year')!.value)
  const month = parseInt(shanghaiDate.find((p) => p.type === 'month')!.value) - 1
  const day = parseInt(shanghaiDate.find((p) => p.type === 'day')!.value)

  const todayInShanghai = new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
  return new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
}

export async function GET(request: NextRequest) {
  try {
    // 管理员鉴权
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = (page - 1) * limit
    const timeRange = (searchParams.get('timeRange') || 'week') as TimeRange

    const startDate = getTimeRangeDate(timeRange)
    const endDate = getTimeRangeEndDate(timeRange)

    // 构建时间范围条件
    const dateConditions = [gte(userPoints.earnedAt, startDate)]
    if (endDate) {
      dateConditions.push(lt(userPoints.earnedAt, endDate))
    }

    // 只统计消费积分（type = 'spent'），按消费总额排序
    const ranking = await db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        totalSpentPoints: sql<number>`COALESCE(SUM(-${userPoints.points}), 0)`,
      })
      .from(user)
      .leftJoin(userPoints, and(eq(user.id, userPoints.userId), eq(userPoints.type, 'spent')))
      .where(and(...dateConditions))
      .groupBy(user.id, user.isAdmin, user.isPremium)
      .orderBy(desc(sql`COALESCE(SUM(-${userPoints.points}), 0)`))
      .limit(limit)
      .offset(offset)

    const totalResult = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${user.id})`,
      })
      .from(user)
      .leftJoin(userPoints, and(eq(user.id, userPoints.userId), eq(userPoints.type, 'spent')))
      .where(and(...dateConditions))

    const total = Number(totalResult[0]?.count || 0)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      ranking,
      total,
      totalPages,
      currentPage: page,
      timeRange,
    })
  } catch (error) {
    console.error('Error fetching points consume ranking:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}


