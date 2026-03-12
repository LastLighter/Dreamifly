import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { and, eq, gte, lte, like, or, sql } from 'drizzle-orm'
import type {
  MonthlyUserStatsExportParams,
  MonthlyUserStatsParams,
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

function escapeCsvValue(value: any): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

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

    if (start) conditions.push(gte(userPoints.earnedAt, start))
    if (end) conditions.push(lte(userPoints.earnedAt, end))

    if (params.userSearch && params.userSearch.trim()) {
      const keyword = `%${params.userSearch.trim()}%`
      conditions.push(or(like(user.name, keyword), like(user.email, keyword))!)
    }

    const monthlyRows = await db
      .select({
        userId: userPoints.userId,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        month: sql<string>`to_char(date_trunc('month', ${userPoints.earnedAt}), 'YYYY-MM')`,
        totalConsumedPoints: sql<number>`COALESCE(SUM(-${userPoints.points}), 0)`,
        purchasedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${userPoints.sourceType} IN ('purchased', 'mixed') THEN -${userPoints.points} ELSE 0 END), 0)`,
        giftedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${userPoints.sourceType} = 'gifted' THEN -${userPoints.points} ELSE 0 END), 0)`,
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
      otherPoints: Number(row.otherPoints ?? 0),
    }))

    // CSV 表头
    const csvHeader = [
      '月份',
      '用户名',
      '用户邮箱',
      '用户角色',
      '总积分消耗',
      '购买积分消耗',
      '赠送积分消耗',
      '其他积分消耗',
      '购买积分占比',
      '赠送积分占比',
      '其他积分占比',
    ].join(',')

    const csvRows = rows.map((r) => {
      const total = r.totalConsumedPoints || 0
      const ratio = (part: number) =>
        total > 0 ? ((part / total) * 100).toFixed(1) + '%' : '0%'
      const roleLabel =
        r.role === 'admin' ? '管理员' : r.role === 'premium' ? '会员' : '普通用户'

      return [
        escapeCsvValue(r.month),
        escapeCsvValue(r.name ?? ''),
        escapeCsvValue(r.email),
        escapeCsvValue(roleLabel),
        escapeCsvValue(total),
        escapeCsvValue(r.purchasedPoints),
        escapeCsvValue(r.giftedPoints),
        escapeCsvValue(r.otherPoints),
        escapeCsvValue(ratio(r.purchasedPoints)),
        escapeCsvValue(ratio(r.giftedPoints)),
        escapeCsvValue(ratio(r.otherPoints)),
      ].join(',')
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
