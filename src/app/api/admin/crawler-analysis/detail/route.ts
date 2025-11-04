import { NextResponse } from 'next/server'
import { db } from '@/db'
import { modelUsageStats, user } from '@/db/schema'
import { eq, sql, and, isNotNull, gte } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

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
    const type = searchParams.get('type') // 'user' 或 'ip'
    const identifier = searchParams.get('identifier') // userId 或 ipAddress
    const timeRange = searchParams.get('timeRange') || 'all' // 时间范围

    if (!type || !identifier) {
      return NextResponse.json({ error: 'Missing type or identifier' }, { status: 400 })
    }

    // 计算时间范围
    let startDate = new Date(0)
    if (timeRange !== 'all') {
      const now = new Date()
      const localNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
      
      switch (timeRange) {
        case 'today':
          startDate = new Date(localNow)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate = new Date(localNow)
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          startDate = new Date(localNow)
          startDate.setMonth(startDate.getMonth() - 1)
          break
      }
    }

    let timeDistribution: Array<{ date: string; hour: number; count: number }> = []
    let modelDistribution: Array<{ modelName: string; count: number }> = []

    if (type === 'user') {
      // 用户详情：按小时统计调用时间分布，按模型统计调用分布
      
      // 1. 调用时间分布（按小时）
      const whereConditions = [eq(modelUsageStats.userId, identifier)]
      if (timeRange !== 'all') {
        whereConditions.push(gte(modelUsageStats.createdAt, startDate))
      }

      const timeStats = await db
        .select({
          date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
          hour: sql<number>`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(modelUsageStats)
        .where(and(...whereConditions))
        .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)

      timeDistribution = timeStats.map((stat) => ({
        date: stat.date,
        hour: Number(stat.hour),
        count: Number(stat.count),
      }))

      // 2. 模型分布
      const modelWhereConditions = [eq(modelUsageStats.userId, identifier)]
      if (timeRange !== 'all') {
        modelWhereConditions.push(gte(modelUsageStats.createdAt, startDate))
      }

      const modelStats = await db
        .select({
          modelName: modelUsageStats.modelName,
          count: sql<number>`count(*)::int`,
        })
        .from(modelUsageStats)
        .where(and(...modelWhereConditions))
        .groupBy(modelUsageStats.modelName)
        .orderBy(sql`count(*) DESC`)

      modelDistribution = modelStats.map((stat) => ({
        modelName: stat.modelName,
        count: Number(stat.count),
      }))
    } else if (type === 'ip') {
      // IP详情：按小时统计调用时间分布，按模型统计调用分布
      
      // 1. 调用时间分布（按小时）
      const ipTimeWhereConditions = [eq(modelUsageStats.ipAddress, identifier)]
      if (timeRange !== 'all') {
        ipTimeWhereConditions.push(gte(modelUsageStats.createdAt, startDate))
      }

      const timeStats = await db
        .select({
          date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
          hour: sql<number>`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(modelUsageStats)
        .where(and(...ipTimeWhereConditions))
        .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)
        .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)

      timeDistribution = timeStats.map((stat) => ({
        date: stat.date,
        hour: Number(stat.hour),
        count: Number(stat.count),
      }))

      // 2. 模型分布
      const ipModelWhereConditions = [eq(modelUsageStats.ipAddress, identifier)]
      if (timeRange !== 'all') {
        ipModelWhereConditions.push(gte(modelUsageStats.createdAt, startDate))
      }

      const modelStats = await db
        .select({
          modelName: modelUsageStats.modelName,
          count: sql<number>`count(*)::int`,
        })
        .from(modelUsageStats)
        .where(and(...ipModelWhereConditions))
        .groupBy(modelUsageStats.modelName)
        .orderBy(sql`count(*) DESC`)

      modelDistribution = modelStats.map((stat) => ({
        modelName: stat.modelName,
        count: Number(stat.count),
      }))
    }

    return NextResponse.json(
      {
        type,
        identifier,
        timeRange,
        timeDistribution,
        modelDistribution,
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
    console.error('Error fetching detail:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch detail' },
      { status: 500 }
    )
  }
}

