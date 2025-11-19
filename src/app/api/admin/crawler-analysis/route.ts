import { NextResponse } from 'next/server'
import { db } from '@/db'
import { modelUsageStats, user, userLimitConfig } from '@/db/schema'
import { gte, sql, eq, isNotNull, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

function getTimeRangeDate(range: TimeRange): Date {
  const now = new Date()
  
  switch (range) {
    case 'hour':
      // 一小时前（UTC时间，与数据库存储的timestamp类型一致）
      return new Date(now.getTime() - 60 * 60 * 1000)
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
      return new Date(todayInShanghai.getTime() - 8 * 60 * 60 * 1000)
    case 'yesterday':
      // 昨天00:00:00（中国时区 UTC+8）
      // 使用 Intl API 获取中国时区的当前日期组件
      const shanghaiDateYesterday = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(now)
      
      const yearYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'year')!.value)
      const monthYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'month')!.value) - 1
      const dayYesterday = parseInt(shanghaiDateYesterday.find(p => p.type === 'day')!.value)
      
      // 创建中国时区昨天00:00:00的Date对象，然后转换为UTC
      // 中国时区是UTC+8，所以需要减去8小时
      const yesterdayInShanghai = new Date(Date.UTC(yearYesterday, monthYesterday, dayYesterday - 1, 0, 0, 0, 0))
      return new Date(yesterdayInShanghai.getTime() - 8 * 60 * 60 * 1000)
    case 'week':
      // 7天前（UTC时间）
      const weekAgo = new Date(now)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return weekAgo
    case 'month':
      // 30天前（UTC时间）
      const monthAgo = new Date(now)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return monthAgo
    case 'all':
      return new Date(0)
    default:
      const defaultDate = new Date(now)
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

    // 获取用户限额配置
    let regularUserDailyLimit = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '200', 10)
    let premiumUserDailyLimit = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '500', 10)
    
    try {
      const config = await db.select()
        .from(userLimitConfig)
        .where(eq(userLimitConfig.id, 1))
        .limit(1)
      
      if (config.length > 0) {
        const configData = config[0]
        regularUserDailyLimit = configData.regularUserDailyLimit ?? regularUserDailyLimit
        premiumUserDailyLimit = configData.premiumUserDailyLimit ?? premiumUserDailyLimit
      }
    } catch (error) {
      console.error('Error fetching user limit config:', error)
      // 使用环境变量默认值
    }

    // 1. 登录用户调用次数排名
    const userCallRanking = await db
      .select({
        userId: modelUsageStats.userId,
        userName: user.name,
        userEmail: user.email,
        userNickname: user.nickname,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        dailyRequestCount: user.dailyRequestCount,
        // 将 timestamptz 转换为 UTC 时间字符串，确保读取正确（与generate/route.ts中的逻辑一致）
        lastRequestResetDate: sql<string | null>`${user.lastRequestResetDate} AT TIME ZONE 'UTC'`,
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
      .groupBy(modelUsageStats.userId, user.name, user.email, user.nickname, user.isAdmin, user.isPremium, user.dailyRequestCount, sql`${user.lastRequestResetDate} AT TIME ZONE 'UTC'`)
      .orderBy(sql`count(*) DESC`)
      .limit(100)

    // 2. IP调用次数排名（全部用户）
    const allIPRanking = await db
      .select({
        ipAddress: modelUsageStats.ipAddress,
        callCount: sql<number>`count(*)::int`,
        authenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = true)::int`,
        unauthenticatedCount: sql<number>`count(*) filter (where ${modelUsageStats.isAuthenticated} = false)::int`,
        userCount: sql<number>`count(distinct ${modelUsageStats.userId}) filter (where ${modelUsageStats.isAuthenticated} = true and ${modelUsageStats.userId} is not null)::int`,
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
        userCount: sql<number>`count(distinct ${modelUsageStats.userId}) filter (where ${modelUsageStats.userId} is not null)::int`,
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

    // 5. 当timeRange为'today'时，计算未登录用户IP的单小时最高调用次数
    const maxHourlyCallCountMap: Record<string, number> = {}
    if (timeRange === 'today') {
      const hourlyStats = await db
        .select({
          ipAddress: modelUsageStats.ipAddress,
          hourBucket: sql<string>`date_trunc('hour', ${modelUsageStats.createdAt})::text`,
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
        .groupBy(modelUsageStats.ipAddress, sql`date_trunc('hour', ${modelUsageStats.createdAt})`)
      
      // 计算每个IP的单小时最高调用次数
      hourlyStats.forEach((stat) => {
        const ip = stat.ipAddress || ''
        const count = Number(stat.callCount)
        if (!maxHourlyCallCountMap[ip] || count > maxHourlyCallCountMap[ip]) {
          maxHourlyCallCountMap[ip] = count
        }
      })
    }

    // 辅助函数：获取指定日期在东八区的年月日（与generate/route.ts中的逻辑一致）
    const getShanghaiDate = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(date);
      
      return {
        year: parseInt(parts.find(p => p.type === 'year')!.value),
        month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
        day: parseInt(parts.find(p => p.type === 'day')!.value)
      };
    };

    // 获取今天的东八区日期（用于跨天判断）
    const now = new Date();
    const todayShanghai = getShanghaiDate(now);
    const todayShanghaiDate = new Date(Date.UTC(
      todayShanghai.year,
      todayShanghai.month,
      todayShanghai.day
    ));

    return NextResponse.json(
      {
        timeRange,
        userCallRanking: userCallRanking.map((item) => {
          const isAdmin = item.isAdmin || false
          const isPremium = item.isPremium || false
          // 计算用户的最大限额：管理员为null（无限），优质用户使用premiumUserDailyLimit，普通用户使用regularUserDailyLimit
          const maxDailyLimit = isAdmin ? null : (isPremium ? premiumUserDailyLimit : regularUserDailyLimit)
          
          // 判断是否跨天（与generate/route.ts中的逻辑一致）
          let dailyRequestCount = item.dailyRequestCount || 0
          if (item.lastRequestResetDate) {
            // 由于查询时已经使用 AT TIME ZONE 'UTC' 转换为UTC时间字符串
            // 返回的格式是 '2025-11-17 15:17:26.143223' (无时区标识的UTC时间，空格分隔)
            // 需要转换为ISO 8601格式（将空格替换为T，添加Z表示UTC）
            const lastResetDate = new Date(item.lastRequestResetDate.replace(' ', 'T') + 'Z')
            const lastResetDayShanghai = getShanghaiDate(lastResetDate)
            const lastResetDayShanghaiDate = new Date(Date.UTC(
              lastResetDayShanghai.year,
              lastResetDayShanghai.month,
              lastResetDayShanghai.day
            ))
            
            // 如果上次重置日期不是今天（东八区），则显示为0
            const needsReset = !lastResetDayShanghaiDate || lastResetDayShanghaiDate.getTime() !== todayShanghaiDate.getTime()
            if (needsReset) {
              dailyRequestCount = 0
            }
          } else {
            // 如果没有重置日期，说明从未使用过，显示为0
            dailyRequestCount = 0
          }
          
          return {
            userId: item.userId,
            userName: item.userName,
            userEmail: item.userEmail,
            userNickname: item.userNickname,
            isAdmin,
            isPremium,
            dailyRequestCount,
            maxDailyLimit,
            callCount: Number(item.callCount),
          }
        }),
        allIPRanking: allIPRanking.map((item) => ({
          ipAddress: item.ipAddress,
          callCount: Number(item.callCount),
          authenticatedCount: Number(item.authenticatedCount),
          unauthenticatedCount: Number(item.unauthenticatedCount),
          userCount: Number(item.userCount),
        })),
        authenticatedIPRanking: authenticatedIPRanking.map((item) => ({
          ipAddress: item.ipAddress,
          callCount: Number(item.callCount),
          userCount: Number(item.userCount),
        })),
        unauthenticatedIPRanking: unauthenticatedIPRanking.map((item) => ({
          ipAddress: item.ipAddress,
          callCount: Number(item.callCount),
          maxHourlyCallCount: timeRange === 'today' ? (maxHourlyCallCountMap[item.ipAddress || ''] || 0) : undefined,
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

