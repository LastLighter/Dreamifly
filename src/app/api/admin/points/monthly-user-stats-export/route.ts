import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { and, eq, gte, lte, like, or, sql } from 'drizzle-orm'
import type {
  MonthlyUserStatsExportParams,
  MonthlyUserStatsParams,
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

// CSV 转义
function escapeCsvValue(value: any): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// 生成上海时区时间戳字符串
function formatShanghaiTimestampForFilename(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  })
    .format(date)
    .replace(/[/:]/g, '-')
    .replace(/\s/g, '_')
}

export async function POST(request: NextRequest) {
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

    const params: MonthlyUserStatsExportParams = await request.json()
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

    let users = Array.from(userMap.values()).sort(
      (a, b) => b.totalConsumedPoints - a.totalConsumedPoints,
    )

    if (users.length === 0) {
      // 没有数据时也返回一个只有表头的空 CSV
      users = []
    }

    const months = Array.from(monthsSet).sort()

    // 生成 CSV 表头
    const headerColumns = [
      '用户名',
      '用户邮箱',
      '用户角色',
      '总消耗积分',
      '总消耗次数',
      ...months,
    ]
    const csvHeader = headerColumns.join(',')

    // 生成数据行
    const csvRows = users.map((u) => {
      const baseCols = [
        escapeCsvValue(u.name ?? ''),
        escapeCsvValue(u.email),
        escapeCsvValue(
          u.role === 'admin' ? '管理员' : u.role === 'premium' ? '会员' : '普通用户',
        ),
        escapeCsvValue(u.totalConsumedPoints),
        escapeCsvValue(u.totalConsumedCount),
      ]

      const monthCols = months.map((m) => escapeCsvValue(u.monthlyPoints[m] ?? 0))

      return [...baseCols, ...monthCols].join(',')
    })

    const BOM = '\uFEFF'
    const csvContent = BOM + [csvHeader, ...csvRows].join('\n')

    const now = new Date()
    const timestamp = formatShanghaiTimestampForFilename(now)
    const filename = `用户月度积分消耗_${timestamp}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error exporting monthly user stats:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: String(error) },
      { status: 500 },
    )
  }
}

