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
      
      switch (timeRange) {
        case 'hour':
          // 一小时前（UTC时间，与数据库存储的timestamp类型一致）
          startDate = new Date(now.getTime() - 60 * 60 * 1000)
          break
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
          startDate = new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
          break
        case 'week':
          // 7天前（UTC时间）
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 7)
          break
        case 'month':
          // 30天前（UTC时间）
          startDate = new Date(now)
          startDate.setMonth(startDate.getMonth() - 1)
          break
      }
    }

    let timeDistribution: Array<{ date: string; hour: number; count: number }> = []
    let modelDistribution: Array<{ modelName: string; count: number }> = []
    let ipUsers: Array<{ userId: string; userName: string | null; userEmail: string; userNickname: string | null; callCount: number }> = []
    const dailyDistribution: Array<{ date: string; total: number; authenticated: number; unauthenticated: number }> = []
    const dailyHourlyDistribution: Array<{ date: string; hour: number; total: number; authenticated?: number; unauthenticated?: number }> = []

    if (type === 'user') {
      // 用户详情：按小时统计调用时间分布，按模型统计调用分布
      // 对于hour范围，按分钟统计；其他范围按小时统计
      
      // 1. 调用时间分布
      const whereConditions = [eq(modelUsageStats.userId, identifier)]
      if (timeRange !== 'all') {
        whereConditions.push(gte(modelUsageStats.createdAt, startDate))
      }

      const timeStats = timeRange === 'hour'
        ? await db
            .select({
              date: sql<string>`date_trunc('minute', ${modelUsageStats.createdAt})::text`,
              hour: sql<number>`EXTRACT(MINUTE FROM ${modelUsageStats.createdAt})::int`,
              count: sql<number>`count(*)::int`,
            })
            .from(modelUsageStats)
            .where(and(...whereConditions))
            .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`, sql`EXTRACT(MINUTE FROM ${modelUsageStats.createdAt})`)
            .orderBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`, sql`EXTRACT(MINUTE FROM ${modelUsageStats.createdAt})`)
        : await db
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

      // 3. 当timeRange为week时，添加按天统计的数据
      if (timeRange === 'week') {
        const dailyStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...whereConditions))
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

        // 生成前7天的完整数据
        const now = new Date()
        const dailyMap = new Map<string, number>()
        dailyStats.forEach((stat) => {
          dailyMap.set(stat.date, Number(stat.count))
        })

        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          dailyDistribution.push({
            date: dateStr,
            total: dailyMap.get(dateStr) || 0,
            authenticated: dailyMap.get(dateStr) || 0, // 用户详情只有登录用户
            unauthenticated: 0,
          })
        }

        // 4. 添加近七天每日按小时的数据
        const dailyHourlyStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            hour: sql<number>`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...whereConditions))
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)

        // 生成前7天每天24小时的完整数据
        const hourlyMap = new Map<string, number>()
        dailyHourlyStats.forEach((stat) => {
          const key = `${stat.date}-${stat.hour}`
          hourlyMap.set(key, Number(stat.count))
        })

        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          
          for (let hour = 0; hour < 24; hour++) {
            const key = `${dateStr}-${hour}`
            dailyHourlyDistribution.push({
              date: dateStr,
              hour: hour,
              total: hourlyMap.get(key) || 0,
            })
          }
        }
      }
    } else if (type === 'ip') {
      // IP详情：按小时统计调用时间分布，按模型统计调用分布
      // 对于hour范围，按分钟统计；其他范围按小时统计
      
      // 1. 调用时间分布
      const ipTimeWhereConditions = [eq(modelUsageStats.ipAddress, identifier)]
      if (timeRange !== 'all') {
        ipTimeWhereConditions.push(gte(modelUsageStats.createdAt, startDate))
      }

      const timeStats = timeRange === 'hour'
        ? await db
            .select({
              date: sql<string>`date_trunc('minute', ${modelUsageStats.createdAt})::text`,
              hour: sql<number>`EXTRACT(MINUTE FROM ${modelUsageStats.createdAt})::int`,
              count: sql<number>`count(*)::int`,
            })
            .from(modelUsageStats)
            .where(and(...ipTimeWhereConditions))
            .groupBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`, sql`EXTRACT(MINUTE FROM ${modelUsageStats.createdAt})`)
            .orderBy(sql`date_trunc('minute', ${modelUsageStats.createdAt})`, sql`EXTRACT(MINUTE FROM ${modelUsageStats.createdAt})`)
        : await db
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

      // 获取使用该IP的登录用户信息
      const ipUserStats = await db
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
            eq(modelUsageStats.ipAddress, identifier),
            isNotNull(modelUsageStats.userId),
            eq(modelUsageStats.isAuthenticated, true),
            ...(timeRange !== 'all' ? [gte(modelUsageStats.createdAt, startDate)] : [])
          )
        )
        .groupBy(modelUsageStats.userId, user.name, user.email, user.nickname)
        .orderBy(sql`count(*) DESC`)

      ipUsers = ipUserStats
        .filter((stat) => stat.userId !== null)
        .map((stat) => ({
          userId: stat.userId!,
          userName: stat.userName,
          userEmail: stat.userEmail,
          userNickname: stat.userNickname,
          callCount: Number(stat.callCount),
        }))

      // 3. 当timeRange为week时，添加按天统计的数据（区分登录/未登录用户）
      if (timeRange === 'week') {
        // 总请求按天统计
        const dailyTotalStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...ipTimeWhereConditions))
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

        // 登录用户按天统计
        const dailyAuthStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(
            and(
              ...ipTimeWhereConditions,
              eq(modelUsageStats.isAuthenticated, true)
            )
          )
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

        // 未登录用户按天统计
        const dailyUnauthStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(
            and(
              ...ipTimeWhereConditions,
              eq(modelUsageStats.isAuthenticated, false)
            )
          )
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`)

        // 生成前7天的完整数据
        const now = new Date()
        const totalMap = new Map<string, number>()
        const authMap = new Map<string, number>()
        const unauthMap = new Map<string, number>()

        dailyTotalStats.forEach((stat) => {
          totalMap.set(stat.date, Number(stat.count))
        })
        dailyAuthStats.forEach((stat) => {
          authMap.set(stat.date, Number(stat.count))
        })
        dailyUnauthStats.forEach((stat) => {
          unauthMap.set(stat.date, Number(stat.count))
        })

        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          dailyDistribution.push({
            date: dateStr,
            total: totalMap.get(dateStr) || 0,
            authenticated: authMap.get(dateStr) || 0,
            unauthenticated: unauthMap.get(dateStr) || 0,
          })
        }

        // 4. 添加近七天每日按小时的数据（区分登录/未登录用户）
        // 总请求按天按小时统计
        const dailyHourlyTotalStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            hour: sql<number>`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(and(...ipTimeWhereConditions))
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)

        // 登录用户按天按小时统计
        const dailyHourlyAuthStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            hour: sql<number>`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(
            and(
              ...ipTimeWhereConditions,
              eq(modelUsageStats.isAuthenticated, true)
            )
          )
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)

        // 未登录用户按天按小时统计
        const dailyHourlyUnauthStats = await db
          .select({
            date: sql<string>`date_trunc('day', ${modelUsageStats.createdAt})::date::text`,
            hour: sql<number>`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(modelUsageStats)
          .where(
            and(
              ...ipTimeWhereConditions,
              eq(modelUsageStats.isAuthenticated, false)
            )
          )
          .groupBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)
          .orderBy(sql`date_trunc('day', ${modelUsageStats.createdAt})`, sql`EXTRACT(HOUR FROM ${modelUsageStats.createdAt})`)

        // 生成前7天每天24小时的完整数据
        const totalHourlyMap = new Map<string, number>()
        const authHourlyMap = new Map<string, number>()
        const unauthHourlyMap = new Map<string, number>()

        dailyHourlyTotalStats.forEach((stat) => {
          const key = `${stat.date}-${stat.hour}`
          totalHourlyMap.set(key, Number(stat.count))
        })
        dailyHourlyAuthStats.forEach((stat) => {
          const key = `${stat.date}-${stat.hour}`
          authHourlyMap.set(key, Number(stat.count))
        })
        dailyHourlyUnauthStats.forEach((stat) => {
          const key = `${stat.date}-${stat.hour}`
          unauthHourlyMap.set(key, Number(stat.count))
        })

        for (let i = 6; i >= 0; i--) {
          const date = new Date(now)
          date.setDate(date.getDate() - i)
          const dateStr = date.toISOString().split('T')[0]
          
          for (let hour = 0; hour < 24; hour++) {
            const key = `${dateStr}-${hour}`
            dailyHourlyDistribution.push({
              date: dateStr,
              hour: hour,
              total: totalHourlyMap.get(key) || 0,
              authenticated: authHourlyMap.get(key) || 0,
              unauthenticated: unauthHourlyMap.get(key) || 0,
            })
          }
        }
      }
    }

    return NextResponse.json(
      {
        type,
        identifier,
        timeRange,
        timeDistribution,
        modelDistribution,
        ipUsers: type === 'ip' ? ipUsers : undefined,
        dailyDistribution: timeRange === 'week' ? dailyDistribution : undefined,
        dailyHourlyDistribution: timeRange === 'week' ? dailyHourlyDistribution : undefined,
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

