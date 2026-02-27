import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { and, eq, gte, lte, like, or, sql } from 'drizzle-orm'
import type {
  MonthlyUserStatsParams,
  MonthlyUserStatsResponse,
  MonthlyUserStatsRow,
  UserRole,
} from '@/types/points'

// 将 YYYY-MM 格式解析为月份的开始/结束时间戳
function buildDateRange(params: MonthlyUserStatsParams) {
  const { startDate, endDate } = params
  let start: Date | undefined
  let end: Date | undefined

  if (startDate) {
    const [year, month] = startDate.split('-').map(Number)
    start = new Date(year, month - 1, 1, 0, 0, 0, 0) // 月份第一天 00:00:00
  }

  if (endDate) {
    const [year, month] = endDate.split('-').map(Number)
    end = new Date(year, month, 0, 23, 59, 59, 999) // 月份最后一天 23:59:59
  }

  return { start, end }
}

function getUserRole(isAdmin: boolean, isPremium: boolean): UserRole {
  if (isAdmin) return 'admin'
  if (isPremium) return 'premium'
  return 'regular'
}

export async function GET(request: NextRequest) {
  try {
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

    const params: MonthlyUserStatsParams = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      userSearch: searchParams.get('userSearch') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '50', 10),
    }

    const page = params.page && params.page > 0 ? params.page : 1
    const limit = params.limit && params.limit > 0 ? Math.min(params.limit, 200) : 50

    const { start, end } = buildDateRange(params)

    const conditions = [eq(userPoints.type, 'spent' as const)]

    if (start) conditions.push(gte(userPoints.earnedAt, start))
    if (end) conditions.push(lte(userPoints.earnedAt, end))

    if (params.userSearch && params.userSearch.trim()) {
      const keyword = `%${params.userSearch.trim()}%`
      conditions.push(or(like(user.name, keyword), like(user.email, keyword))!)
    }

    // 按用户 + 月份聚合，同时按 sourceType 做条件求和
    const monthlyRows = await db
      .select({
        userId: userPoints.userId,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        month: sql<string>`to_char(date_trunc('month', ${userPoints.earnedAt}), 'YYYY-MM')`,
        totalConsumedPoints: sql<number>`COALESCE(SUM(-${userPoints.points}), 0)`,
        purchasedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${userPoints.sourceType} = 'purchased' THEN -${userPoints.points} ELSE 0 END), 0)`,
        giftedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${userPoints.sourceType} = 'gifted' THEN -${userPoints.points} ELSE 0 END), 0)`,
        mixedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${userPoints.sourceType} = 'mixed' THEN -${userPoints.points} ELSE 0 END), 0)`,
        otherPoints: sql<number>`COALESCE(SUM(CASE WHEN ${userPoints.sourceType} IN ('other', 'refund') OR ${userPoints.sourceType} IS NULL THEN -${userPoints.points} ELSE 0 END), 0)`,
      })
      .from(userPoints)
      .innerJoin(user, eq(userPoints.userId, user.id))
      .where(and(...conditions))
      .groupBy(
        userPoints.userId,
        user.name,
        user.email,
        user.isAdmin,
        user.isPremium,
        sql`date_trunc('month', ${userPoints.earnedAt})`,
      )
      .orderBy(
        sql`date_trunc('month', ${userPoints.earnedAt}) ASC`,
        sql`SUM(-${userPoints.points}) DESC`,
      )

    const rows: MonthlyUserStatsRow[] = monthlyRows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: getUserRole(row.isAdmin ?? false, row.isPremium ?? false),
      month: row.month,
      totalConsumedPoints: Number(row.totalConsumedPoints ?? 0),
      purchasedPoints: Number(row.purchasedPoints ?? 0),
      giftedPoints: Number(row.giftedPoints ?? 0),
      mixedPoints: Number(row.mixedPoints ?? 0),
      otherPoints: Number(row.otherPoints ?? 0),
    }))

    const totalRows = rows.length
    const totalConsumedPoints = rows.reduce((sum, r) => sum + r.totalConsumedPoints, 0)
    const totalPages = totalRows === 0 ? 0 : Math.ceil(totalRows / limit)
    const pageIndex = Math.min(page, Math.max(totalPages, 1))
    const startIndex = (pageIndex - 1) * limit
    const pagedRows = rows.slice(startIndex, startIndex + limit)

    const response: MonthlyUserStatsResponse = {
      page: pageIndex,
      totalPages,
      totalRows,
      totalConsumedPoints,
      rows: pagedRows,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching monthly user stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
