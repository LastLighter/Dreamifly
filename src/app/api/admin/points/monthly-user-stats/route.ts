import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { and, eq, gte, lte, like, or, sql } from 'drizzle-orm'
import type {
  MonthlyUserStatsParams,
  MonthlyUserStatsResponse,
  MonthlyUserStatsUser,
  UserRole,
} from '@/types/points'

// 解析并规范化日期范围（精确到天）
function buildDateRange(params: MonthlyUserStatsParams) {
  const { startDate, endDate } = params
  let start: Date | undefined
  let end: Date | undefined

  if (startDate) {
    start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
  }

  if (endDate) {
    end = new Date(endDate)
    end.setHours(23, 59, 59, 999)
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

    if (start) {
      conditions.push(gte(userPoints.earnedAt, start))
    }
    if (end) {
      conditions.push(lte(userPoints.earnedAt, end))
    }

    // 用户搜索（姓名/邮箱）
    if (params.userSearch && params.userSearch.trim()) {
      const keyword = `%${params.userSearch.trim()}%`
      conditions.push(or(like(user.name, keyword), like(user.email, keyword)))
    }

    // 按用户 + 月份聚合
    const monthlyRows = await db
      .select({
        userId: userPoints.userId,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        month: sql<string>`to_char(date_trunc('month', ${userPoints.earnedAt}), 'YYYY-MM')`,
        consumedPoints: sql<number>`COALESCE(SUM(-${userPoints.points}), 0)`,
        consumedCount: sql<number>`COUNT(${userPoints.id})`,
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
        userPoints.userId,
        sql`date_trunc('month', ${userPoints.earnedAt}) ASC`,
      )

    // 汇总为每用户一行结构
    const monthsSet = new Set<string>()
    const userMap = new Map<string, MonthlyUserStatsUser>()
    let totalConsumedPointsAllUsers = 0

    for (const row of monthlyRows) {
      const monthKey = row.month
      monthsSet.add(monthKey)

      let userEntry = userMap.get(row.userId)
      if (!userEntry) {
        const role = getUserRole(row.isAdmin ?? false, row.isPremium ?? false)
        userEntry = {
          userId: row.userId,
          name: row.name,
          email: row.email,
          role,
          totalConsumedPoints: 0,
          totalConsumedCount: 0,
          monthlyPoints: {},
          monthlyCounts: {},
        }
        userMap.set(row.userId, userEntry)
      }

      userEntry.totalConsumedPoints += Number(row.consumedPoints ?? 0)
      userEntry.totalConsumedCount += Number(row.consumedCount ?? 0)
      userEntry.monthlyPoints[monthKey] = Number(row.consumedPoints ?? 0)
      userEntry.monthlyCounts[monthKey] = Number(row.consumedCount ?? 0)
    }

    const months = Array.from(monthsSet).sort()
    const users = Array.from(userMap.values()).sort(
      (a, b) => b.totalConsumedPoints - a.totalConsumedPoints,
    )

    const totalUsers = users.length
    for (const u of users) {
      totalConsumedPointsAllUsers += u.totalConsumedPoints
    }

    const totalPages = totalUsers === 0 ? 0 : Math.ceil(totalUsers / limit)
    const pageIndex = Math.min(page, Math.max(totalPages, 1))
    const startIndex = (pageIndex - 1) * limit
    const pagedUsers = users.slice(startIndex, startIndex + limit)

    const response: MonthlyUserStatsResponse = {
      months,
      page: pageIndex,
      totalPages,
      totalUsers,
      totalConsumedPoints: totalConsumedPointsAllUsers,
      users: pagedUsers,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching monthly user stats:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

