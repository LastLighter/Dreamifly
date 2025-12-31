import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { eq, and, gte, lt } from 'drizzle-orm'

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

// 根据description分类消耗类型
function categorizeConsumption(description: string | null): string {
  if (!description) return '其他'

  if (description.startsWith('图像生成 -')) {
    // 提取模型名称
    const modelMatch = description.match(/图像生成 - ([^(]+)/)
    if (modelMatch) {
      return `图像生成-${modelMatch[1].trim()}`
    }
    return '图像生成'
  }

  if (description.startsWith('视频生成 -')) {
    // 提取模型名称
    const modelMatch = description.match(/视频生成 - ([^(]+)/)
    if (modelMatch) {
      return `视频生成-${modelMatch[1].trim()}`
    }
    return '视频生成'
  }

  if (description === '工作流修复消费') {
    return '工作流修复'
  }

  if (description === '工作流放大消费') {
    return '工作流放大'
  }

  return '其他'
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
    const timeRange = (searchParams.get('timeRange') || 'today') as TimeRange

    const startDate = getTimeRangeDate(timeRange)
    const endDate = getTimeRangeEndDate(timeRange)

    // 构建时间范围条件
    const dateConditions = [gte(userPoints.earnedAt, startDate)]
    if (endDate) {
      dateConditions.push(lt(userPoints.earnedAt, endDate))
    }

    // 获取所有消耗记录，按类型分组统计
    const rawRecords = await db
      .select({
        description: userPoints.description,
        points: userPoints.points,
      })
      .from(userPoints)
      .where(and(eq(userPoints.type, 'spent'), ...dateConditions))

    // 计算总消耗积分
    const totalConsumed = rawRecords.reduce((sum, record) => sum + Math.abs(record.points), 0)

    // 按类型分组统计
    const distributionMap = new Map<string, { consumedPoints: number; recordCount: number }>()

    rawRecords.forEach(record => {
      const category = categorizeConsumption(record.description)
      const points = Math.abs(record.points)

      if (distributionMap.has(category)) {
        const existing = distributionMap.get(category)!
        existing.consumedPoints += points
        existing.recordCount += 1
      } else {
        distributionMap.set(category, {
          consumedPoints: points,
          recordCount: 1,
        })
      }
    })

    // 转换为数组格式并计算占比
    const distribution = Array.from(distributionMap.entries())
      .map(([type, data]) => ({
        type,
        consumedPoints: data.consumedPoints,
        percentage: totalConsumed > 0 ? Math.round((data.consumedPoints / totalConsumed) * 10000) / 100 : 0,
        recordCount: data.recordCount,
        averageCost: data.recordCount > 0 ? Math.round((data.consumedPoints / data.recordCount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.consumedPoints - a.consumedPoints)

    return NextResponse.json({
      totalConsumed,
      totalRecords: rawRecords.length,
      distribution,
      timeRange,
    })
  } catch (error) {
    console.error('Error fetching points consume distribution:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
