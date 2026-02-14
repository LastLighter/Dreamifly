import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { eq, and, gte, lte, or, like, sql } from 'drizzle-orm'
import type { PointsExportParams, ExportField } from '@/types/points'

// 字段映射（中文表头）
const fieldLabels: Record<ExportField, string> = {
  id: '记录ID',
  userId: '用户ID',
  userName: '用户名',
  userEmail: '用户邮箱',
  userRole: '用户角色',
  points: '积分数量',
  type: '记录类型',
  description: '描述说明',
  earnedAt: '发生时间',
  expiresAt: '过期时间',
  createdAt: '创建时间',
}

// CSV转义函数
function escapeCsvValue(value: any): string {
  const str = String(value ?? '')
  // 如果包含逗号、引号或换行符，需要用引号包裹并转义内部引号
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

// 格式化日期为本地时间
function formatDate(date: Date | null): string {
  if (!date) return ''
  try {
    // 转换为中国时区时间
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Shanghai',
    }).format(new Date(date))
  } catch {
    return String(date)
  }
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

    // 解析请求参数
    const params: PointsExportParams = await request.json()
    const {
      startDate,
      endDate,
      fields,
      userSearch,
      userRoles,
      recordType = 'all',
      descriptions,
      minPoints,
      maxPoints,
      limit = 10000,
    } = params

    // 验证必填字段
    if (!fields || fields.length === 0) {
      return NextResponse.json({ error: '请至少选择一个导出字段' }, { status: 400 })
    }

    // 构建查询条件
    const conditions: any[] = []

    // 时间范围筛选
    if (startDate) {
      const startDateTime = new Date(startDate)
      startDateTime.setHours(0, 0, 0, 0)
      conditions.push(gte(userPoints.earnedAt, startDateTime))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      conditions.push(lte(userPoints.earnedAt, endDateTime))
    }

    // 类型筛选
    if (recordType && recordType !== 'all') {
      conditions.push(eq(userPoints.type, recordType))
    }

    // 用户筛选
    if (userSearch && userSearch.trim()) {
      conditions.push(
        or(
          like(user.name, `%${userSearch.trim()}%`),
          like(user.email, `%${userSearch.trim()}%`)
        )
      )
    }

    // 用户角色筛选
    if (userRoles && userRoles.length > 0) {
      const roleConditions: any[] = []
      if (userRoles.includes('admin')) {
        roleConditions.push(eq(user.isAdmin, true))
      }
      if (userRoles.includes('premium')) {
        roleConditions.push(and(eq(user.isPremium, true), eq(user.isAdmin, false)))
      }
      if (userRoles.includes('regular')) {
        roleConditions.push(and(eq(user.isPremium, false), eq(user.isAdmin, false)))
      }
      if (roleConditions.length > 0) {
        conditions.push(or(...roleConditions)!)
      }
    }

    // 描述筛选
    if (descriptions && descriptions.length > 0) {
      const descConditions = descriptions.map((desc) => like(userPoints.description, `%${desc}%`))
      if (descConditions.length > 0) {
        conditions.push(or(...descConditions)!)
      }
    }

    // 积分范围筛选（使用绝对值）
    if (minPoints !== undefined && minPoints !== null) {
      conditions.push(
        or(
          gte(userPoints.points, minPoints),
          lte(userPoints.points, -minPoints)
        )
      )
    }

    if (maxPoints !== undefined && maxPoints !== null) {
      conditions.push(
        or(
          and(lte(userPoints.points, maxPoints), gte(userPoints.points, 0)),
          and(gte(userPoints.points, -maxPoints), lte(userPoints.points, 0))
        )
      )
    }

    // 执行查询
    const records = await db
      .select({
        id: userPoints.id,
        userId: userPoints.userId,
        userName: user.name,
        userEmail: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        points: userPoints.points,
        type: userPoints.type,
        description: userPoints.description,
        earnedAt: userPoints.earnedAt,
        expiresAt: userPoints.expiresAt,
        createdAt: userPoints.createdAt,
      })
      .from(userPoints)
      .innerJoin(user, eq(userPoints.userId, user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${userPoints.earnedAt} DESC`)
      .limit(Math.min(limit, 50000)) // 最大限制50000条

    // 生成CSV内容
    const headers = fields.map((field) => fieldLabels[field])
    const csvHeader = headers.join(',')

    const csvRows = records.map((record) => {
      return fields
        .map((field) => {
          let value: any

          // 特殊字段处理
          if (field === 'userRole') {
            value = record.isAdmin ? '管理员' : record.isPremium ? '会员' : '普通用户'
          } else if (field === 'type') {
            value = record.type === 'earned' ? '获得' : '消耗'
          } else if (field === 'earnedAt' || field === 'expiresAt' || field === 'createdAt') {
            value = formatDate(record[field] as Date | null)
          } else {
            value = record[field as keyof typeof record]
          }

          return escapeCsvValue(value)
        })
        .join(',')
    })

    // 添加UTF-8 BOM以支持Excel正确显示中文
    const BOM = '\uFEFF'
    const csvContent = BOM + [csvHeader, ...csvRows].join('\n')

    // 生成文件名
    const timestamp = new Date()
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'Asia/Shanghai',
      })
      .replace(/[/:]/g, '-')
      .replace(/\s/g, '_')

    const filename = `积分明细_${timestamp}.csv`

    // 返回CSV文件
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    console.error('Error exporting points:', error)
    return NextResponse.json(
      { error: 'Internal Server Error', message: String(error) },
      { status: 500 }
    )
  }
}
