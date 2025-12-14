import { NextResponse } from 'next/server'
import { generateImage } from '@/utils/comfyApi'
import { db } from '@/db'
import { siteStats, modelUsageStats, user, userLimitConfig, ipBlacklist, ipDailyUsage } from '@/db/schema'
import { eq, sql, and, lt } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { concurrencyManager } from '@/utils/concurrencyManager'
import { ipConcurrencyManager } from '@/utils/ipConcurrencyManager'
import { randomUUID, createHash } from 'crypto'
import { addWatermark } from '@/utils/watermark'
import { getModelBaseCost, calculateGenerationCost, checkPointsSufficient, deductPoints, getPointsBalance } from '@/utils/points'
import { getModelThresholds } from '@/utils/modelConfig'

/**
 * 验证动态API token
 * 支持±1分钟时间窗口，处理时间边界问题
 * @param providedToken 客户端提供的token
 * @returns 验证是否通过
 */
function validateDynamicToken(providedToken: string): boolean {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (!apiKey) {
    return false
  }

  // 获取服务器当前时间
  const now = new Date()
  
  // 计算当前分钟和上一分钟的token
  const timeSlots = [
    now, // 当前分钟
    new Date(now.getTime() - 60 * 1000), // 上一分钟
  ]

  for (const timeSlot of timeSlots) {
    const year = timeSlot.getFullYear()
    const month = String(timeSlot.getMonth() + 1).padStart(2, '0')
    const day = String(timeSlot.getDate()).padStart(2, '0')
    const hour = String(timeSlot.getHours()).padStart(2, '0')
    const minute = String(timeSlot.getMinutes()).padStart(2, '0')
    
    const salt = `${year}${month}${day}${hour}${minute}`
    
    // 生成MD5哈希: MD5(密钥 + 盐值)
    const expectedToken = createHash('md5')
      .update(apiKey + salt)
      .digest('hex')
    
    // 如果匹配任一有效token，验证通过
    if (providedToken === expectedToken) {
      return true
    }
  }

  return false
}

// 获取客户端IP地址
function getClientIP(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip') // Cloudflare
  
  let ip: string | null = null
  
  if (forwarded) {
    // x-forwarded-for 可能包含多个IP，取第一个
    ip = forwarded.split(',')[0].trim()
  } else if (realIP) {
    ip = realIP.trim()
  } else if (cfConnectingIP) {
    ip = cfConnectingIP.trim()
  }
  
  // 处理本地回环地址：将 IPv6 的 ::1 转换为 IPv4 的 127.0.0.1，便于统一显示
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1'
  }
  
  // 处理IPv4映射的IPv6格式（::ffff:192.168.1.1 -> 192.168.1.1）
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7) // 移除 '::ffff:' 前缀
  }
  
  return ip
}

export async function POST(request: Request) {
  let generationId: string | null = null;
  const clientIP = getClientIP(request)
  
  // 在 try 块外声明，以便在 catch 块中也能访问
  let isAdmin = false
  let isSubscribed = false
  
  try {
    // 记录总开始时间（包含排队延迟）
    const totalStartTime = Date.now()
    
    // 首先检查IP黑名单（在所有其他检查之前）
    if (clientIP) {
      const blacklistedIP = await db.select()
        .from(ipBlacklist)
        .where(eq(ipBlacklist.ipAddress, clientIP))
        .limit(1)
      
      if (blacklistedIP.length > 0) {
        return NextResponse.json({ 
          error: '您的IP地址已被加入黑名单，无法使用此服务',
          code: 'IP_BLACKLISTED'
        }, { status: 403 })
      }
    }
    
    // 验证认证头
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 检查用户是否已登录
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    // 获取用户信息（用于IP并发控制）
    let isPremium = false
    let currentUserId: string | null = null
    
    // 检查用户订阅是否有效的辅助函数
    const isSubscriptionActive = (isSubscribed: boolean | null, subscriptionExpiresAt: Date | null): boolean => {
      if (!isSubscribed) return false;
      if (!subscriptionExpiresAt) return false;
      return new Date(subscriptionExpiresAt) > new Date();
    }
    
    if (session?.user) {
      currentUserId = session.user.id
      const currentUser = await db.select({
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        isSubscribed: user.isSubscribed,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
      })
        .from(user)
        .where(eq(user.id, currentUserId))
        .limit(1)
      
      if (currentUser.length > 0) {
        isAdmin = currentUser[0].isAdmin || false
        isPremium = currentUser[0].isPremium || false
        isSubscribed = isSubscriptionActive(currentUser[0].isSubscribed, currentUser[0].subscriptionExpiresAt)
      }
    }
    
    // 检查IP并发限制（在所有其他检查之前）
    let ipMaxConcurrency: number | null = null
    if (clientIP) {
      const ipConcurrencyCheck = await ipConcurrencyManager.canStart(
        clientIP,
        currentUserId,
        isAdmin,
        isPremium,
        isSubscribed
      )
      
      if (!ipConcurrencyCheck.canStart) {
        return NextResponse.json({
          error: `当前有 ${ipConcurrencyCheck.currentConcurrency} 个生图任务正在执行，请等待其他任务执行完成后再试。`,
          code: 'IP_CONCURRENCY_LIMIT_EXCEEDED',
          currentConcurrency: ipConcurrencyCheck.currentConcurrency,
          maxConcurrency: ipConcurrencyCheck.maxConcurrency
        }, { status: 429 })
      }
      
      // 保存最大并发数，用于后续增加计数
      ipMaxConcurrency = ipConcurrencyCheck.maxConcurrency
      
      // 对于未登录用户，在进入排队前就增加IP并发计数，避免多个请求同时排队
      // 已登录用户的IP并发计数在后续统一增加（在用户并发检查之后）
      if (!session?.user) {
        const ipStartSuccess = await ipConcurrencyManager.start(clientIP, ipMaxConcurrency)
        if (!ipStartSuccess) {
          // 如果增加计数失败（可能因为并发冲突），返回错误
          const currentInfo = await ipConcurrencyManager.getInfo(clientIP)
          return NextResponse.json({
            error: `当前有 ${currentInfo?.currentConcurrency || 0} 个生图任务正在执行，请等待其他任务执行完成后再试。`,
            code: 'IP_CONCURRENCY_LIMIT_EXCEEDED',
            currentConcurrency: currentInfo?.currentConcurrency || 0,
            maxConcurrency: ipMaxConcurrency
          }, { status: 429 })
        }
      }
    }
    
    // 如果用户未登录，检查IP每日调用次数限制
    if (!session?.user && clientIP) {
      // 获取未登录用户IP每日限额配置（优先使用数据库配置，否则使用环境变量，最后使用默认值100）
      let maxDailyRequests: number;
      try {
        const config = await db.select()
          .from(userLimitConfig)
          .where(eq(userLimitConfig.id, 1))
          .limit(1);
        
        if (config.length > 0) {
          const configData = config[0];
          const dbUnauthLimit = configData.unauthenticatedIpDailyLimit;
          const envUnauthLimit = parseInt(process.env.UNAUTHENTICATED_IP_DAILY_LIMIT || '100', 10);
          maxDailyRequests = dbUnauthLimit ?? envUnauthLimit;
        } else {
          // 配置不存在，使用环境变量或默认值
          maxDailyRequests = parseInt(process.env.UNAUTHENTICATED_IP_DAILY_LIMIT || '100', 10);
        }
      } catch (error) {
        // 如果查询配置失败，使用环境变量或默认值作为后备
        console.error('Error fetching unauthenticated IP limit config:', error);
        maxDailyRequests = parseInt(process.env.UNAUTHENTICATED_IP_DAILY_LIMIT || '100', 10);
      }
      
      // 获取或创建IP每日使用记录
      // 注意：ipDailyUsage.lastRequestResetDate 是 timestamp（不带时区），不是 timestamptz
      // 所以不需要使用 AT TIME ZONE 转换，直接查询即可
      let ipUsageRecord = await db.select({
        ipAddress: ipDailyUsage.ipAddress,
        dailyRequestCount: ipDailyUsage.dailyRequestCount,
        lastRequestResetDate: ipDailyUsage.lastRequestResetDate,
      })
        .from(ipDailyUsage)
        .where(eq(ipDailyUsage.ipAddress, clientIP))
        .limit(1);
      
      // 辅助函数：获取指定日期在东八区的年月日和时分秒
      const getShanghaiDateTime = (date: Date) => {
        // 验证日期是否有效
        if (!date || isNaN(date.getTime())) {
          throw new Error('Invalid date value');
        }
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).formatToParts(date);
        
        return {
          year: parseInt(parts.find(p => p.type === 'year')!.value),
          month: parseInt(parts.find(p => p.type === 'month')!.value) - 1,
          day: parseInt(parts.find(p => p.type === 'day')!.value),
          hour: parseInt(parts.find(p => p.type === 'hour')!.value),
          minute: parseInt(parts.find(p => p.type === 'minute')!.value),
          second: parseInt(parts.find(p => p.type === 'second')!.value)
        };
      };
      
      // 辅助函数：根据东八区时间计算重置日期
      // 未登录用户的重置时间是东八区凌晨4点（UTC 20点）
      // 如果当前时间 >= 今天4点，重置日期是今天
      // 如果当前时间 < 今天4点，重置日期是昨天
      const getResetDate = (shanghaiDateTime: { year: number; month: number; day: number; hour: number; minute: number; second: number }) => {
        const resetHour = 4; // 东八区凌晨4点
        let resetYear = shanghaiDateTime.year;
        let resetMonth = shanghaiDateTime.month;
        let resetDay = shanghaiDateTime.day;
        
        // 如果当前时间还没到今天的4点，重置日期是昨天
        if (shanghaiDateTime.hour < resetHour) {
          // 计算昨天的日期
          const yesterday = new Date(Date.UTC(resetYear, resetMonth, resetDay));
          yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          resetYear = yesterday.getUTCFullYear();
          resetMonth = yesterday.getUTCMonth();
          resetDay = yesterday.getUTCDate();
        }
        
        return {
          year: resetYear,
          month: resetMonth,
          day: resetDay
        };
      };
      
      const now = new Date();
      const nowShanghai = getShanghaiDateTime(now);
      const currentResetDate = getResetDate(nowShanghai);
      const currentResetDateUTC = new Date(Date.UTC(
        currentResetDate.year,
        currentResetDate.month,
        currentResetDate.day
      ));
      
      if (ipUsageRecord.length === 0) {
        // 创建新记录
        // 注意：所有 timestamp 字段都需要明确使用 UTC 时间存储
        await db.insert(ipDailyUsage).values({
          ipAddress: clientIP,
          dailyRequestCount: 0,
          lastRequestResetDate: sql`(now() at time zone 'UTC')`,
          createdAt: sql`(now() at time zone 'UTC')`,
          updatedAt: sql`(now() at time zone 'UTC')`,
        });
        ipUsageRecord = await db.select({
          ipAddress: ipDailyUsage.ipAddress,
          dailyRequestCount: ipDailyUsage.dailyRequestCount,
          lastRequestResetDate: ipDailyUsage.lastRequestResetDate,
        })
          .from(ipDailyUsage)
          .where(eq(ipDailyUsage.ipAddress, clientIP))
          .limit(1);
      }
      
      if (ipUsageRecord.length > 0) {
        const ipUsageData = ipUsageRecord[0];
        
        // 检查是否需要重置每日计数（使用东八区时区判断）
        // 注意：ipDailyUsage.lastRequestResetDate 是 timestamp（不带时区），存储的是 UTC 时间
        // 需要将其解析为 UTC 时间的 Date 对象
        let lastResetDate: Date | null = null;
        if (ipUsageData.lastRequestResetDate) {
          try {
            // timestamp 字段返回的可能是 Date 对象或字符串
            // 由于存储的是 UTC 时间，需要将其解析为 UTC 时间
            let dateValue: Date;
            if (ipUsageData.lastRequestResetDate instanceof Date) {
              // 如果是 Date 对象，直接使用（JavaScript Date 内部存储为 UTC 时间戳）
              dateValue = ipUsageData.lastRequestResetDate;
            } else {
              // 处理字符串格式
              // 由于存储的是 UTC 时间（不带时区），PostgreSQL 可能返回带时区信息的字符串
              // 但实际值应该是 UTC 时间，需要将其解析为 UTC
              const dateStr = String(ipUsageData.lastRequestResetDate);
              // 移除时区信息（如果有），因为存储的是 UTC 时间
              // 格式可能是 '2025-12-11 20:57:41.182572' 或 '2025-12-11 20:57:41.182572+08'
              let cleanDateStr = dateStr;
              // 如果包含时区信息，移除它（因为存储的是 UTC，时区信息是会话时区，不是实际存储的时区）
              if (dateStr.includes('+') || dateStr.match(/-\d{2}(:\d{2})?$/)) {
                // 移除时区部分（+08 或 +08:00 或 -05:00）
                cleanDateStr = dateStr.replace(/[+-]\d{2}(:\d{2})?$/, '').trim();
              }
              // 将空格替换为 T，添加 Z 表示 UTC
              const isoStr = cleanDateStr.replace(' ', 'T') + 'Z';
              dateValue = new Date(isoStr);
            }
            // 验证日期是否有效
            if (!isNaN(dateValue.getTime())) {
              lastResetDate = dateValue;
            } else {
              console.error('Invalid date value:', ipUsageData.lastRequestResetDate);
            }
          } catch (error) {
            console.error('Error parsing date:', ipUsageData.lastRequestResetDate, error);
          }
        }
        // 计算上次重置时间对应的重置日期
        let lastResetDateUTC: Date | null = null;
        
        if (lastResetDate) {
          try {
            const lastResetShanghai = getShanghaiDateTime(lastResetDate);
            const lastResetDateInfo = getResetDate(lastResetShanghai);
            lastResetDateUTC = new Date(Date.UTC(
              lastResetDateInfo.year,
              lastResetDateInfo.month,
              lastResetDateInfo.day
            ));
          } catch (error) {
            console.error('Error getting reset date from lastResetDate:', lastResetDate, error);
            // 如果日期解析失败，视为需要重置
            lastResetDateUTC = null;
          }
        }
        
        let currentCount = ipUsageData.dailyRequestCount || 0;
        // 比较当前重置日期和上次重置日期是否相同
        const needsReset = !lastResetDateUTC || lastResetDateUTC.getTime() !== currentResetDateUTC.getTime();
        
        // 如果上次重置日期不是今天（东八区），重置计数
        if (needsReset) {
          currentCount = 0;
          // 注意：所有 timestamp 字段都需要明确使用 UTC 时间存储
          await db
            .update(ipDailyUsage)
            .set({
              dailyRequestCount: 0,
              lastRequestResetDate: sql`(now() at time zone 'UTC')`,
              updatedAt: sql`(now() at time zone 'UTC')`,
            })
            .where(eq(ipDailyUsage.ipAddress, clientIP));
        }
        
        // 检查是否超过每日限制
        if (currentCount >= maxDailyRequests) {
          // 清理已增加的IP并发计数
          await ipConcurrencyManager.end(clientIP).catch(err => {
            console.error('Error decrementing IP concurrency after daily limit check:', err)
          })
          return NextResponse.json({ 
            error: `今日生图次数已达上限。未登录用户每日可使用${maxDailyRequests}次生图功能。`,
            code: 'IP_DAILY_LIMIT_EXCEEDED',
            dailyCount: currentCount,
            maxDailyRequests
          }, { status: 429 });
        }
        
        // 使用条件更新确保并发安全：只有在 dailyRequestCount < maxDailyRequests 时才更新
        // 注意：所有 timestamp 字段都需要明确使用 UTC 时间存储
        const updateResult = await db
          .update(ipDailyUsage)
          .set({
            dailyRequestCount: sql`${ipDailyUsage.dailyRequestCount} + 1`,
            updatedAt: sql`(now() at time zone 'UTC')`,
          })
          .where(
            and(
              eq(ipDailyUsage.ipAddress, clientIP),
              lt(ipDailyUsage.dailyRequestCount, maxDailyRequests)
            )
          )
          .returning({ dailyRequestCount: ipDailyUsage.dailyRequestCount });
        
        // 如果更新失败（返回空数组），说明已经达到或超过限制
        if (updateResult.length === 0) {
          // 重新查询当前计数以获取准确值
          const currentIpUsageData = await db
            .select({ dailyRequestCount: ipDailyUsage.dailyRequestCount })
            .from(ipDailyUsage)
            .where(eq(ipDailyUsage.ipAddress, clientIP))
            .limit(1);
          
          const finalCount = currentIpUsageData[0]?.dailyRequestCount || 0;
          
          // 清理已增加的IP并发计数
          await ipConcurrencyManager.end(clientIP).catch(err => {
            console.error('Error decrementing IP concurrency after daily limit check:', err)
          })
          
          return NextResponse.json({ 
            error: `今日生图次数已达上限。未登录用户每日可使用${maxDailyRequests}次生图功能。`,
            code: 'IP_DAILY_LIMIT_EXCEEDED',
            dailyCount: finalCount,
            maxDailyRequests
          }, { status: 429 });
        }
      }
    }
    
    // 如果用户已登录，检查用户并发限制和每日请求次数
    if (session?.user) {
      const userId = session.user.id;
      
      // 先获取用户信息，检查是否是管理员
      // 使用数据库原子操作来确保并发安全
      // 注意：查询时使用 AT TIME ZONE 'UTC' 确保读取的是UTC时间，避免时区转换问题
      const currentUser = await db.select({
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        isOldUser: user.isOldUser,
        isActive: user.isActive,
        dailyRequestCount: user.dailyRequestCount,
        isSubscribed: user.isSubscribed,
        subscriptionExpiresAt: user.subscriptionExpiresAt,
        // 将 timestamptz 转换为 UTC 时间字符串，确保读取正确
        lastRequestResetDate: sql<string | null>`${user.lastRequestResetDate} AT TIME ZONE 'UTC'`,
        updatedAt: user.updatedAt,
      })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (currentUser.length > 0) {
        const userData = currentUser[0];
        
        // 检查用户是否被封禁
        if (!userData.isActive) {
          return NextResponse.json({ 
            error: '您的账号已被封禁，无法使用此服务',
            code: 'USER_BANNED'
          }, { status: 403 })
        }
        
        // 更新isAdmin、isPremium和isSubscribed（如果之前没有获取到）
        if (!isAdmin) isAdmin = userData.isAdmin || false;
        if (!isPremium) isPremium = userData.isPremium || false;
        // 检查会员状态（如果用户既是管理员又是会员，按管理员处理，所以这里只在非管理员时更新）
        if (!isAdmin) {
          isSubscribed = isSubscriptionActive(userData.isSubscribed, userData.subscriptionExpiresAt)
        }
        const isOldUser = userData.isOldUser || false;
        
        // 管理员和会员不受用户并发限制
        if (!isAdmin && !isSubscribed) {
          const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '2', 10);
          
          // 检查是否超过用户并发限制
          if (!concurrencyManager.canStart(userId, maxConcurrent)) {
            const currentCount = concurrencyManager.getCurrentCount(userId);
            return NextResponse.json({ 
              error: `您当前有 ${currentCount} 个生图任务正在进行，最多允许 ${maxConcurrent} 个任务同时进行。请等待其中一个完成后再试。`,
              code: 'CONCURRENCY_LIMIT_EXCEEDED',
              currentCount,
              maxConcurrent
            }, { status: 429 }) // 429 Too Many Requests
          }
        }

        // 检查是否需要重置每日计数（使用东八区时区判断）
        // 辅助函数：获取指定日期在东八区的年月日
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

        const now = new Date();
        const todayShanghai = getShanghaiDate(now);
        // 创建东八区今天的UTC日期对象（用于比较）
        const todayShanghaiDate = new Date(Date.UTC(
          todayShanghai.year,
          todayShanghai.month,
          todayShanghai.day
        ));

        // 由于查询时已经使用 AT TIME ZONE 'UTC' 转换为UTC时间字符串
        // 返回的格式是 '2025-11-17 15:17:26.143223' (无时区标识的UTC时间，空格分隔)
        // 需要转换为ISO 8601格式（将空格替换为T，添加Z表示UTC）
        const lastResetDate = userData.lastRequestResetDate 
          ? new Date(userData.lastRequestResetDate.replace(' ', 'T') + 'Z') 
          : null;
        const lastResetDayShanghai = lastResetDate ? getShanghaiDate(lastResetDate) : null;
        const lastResetDayShanghaiDate = lastResetDayShanghai ? new Date(Date.UTC(
          lastResetDayShanghai.year,
          lastResetDayShanghai.month,
          lastResetDayShanghai.day
        )) : null;

        // 先检查并重置（如果需要）- 所有用户都需要统计
        const needsReset = !lastResetDayShanghaiDate || lastResetDayShanghaiDate.getTime() !== todayShanghaiDate.getTime();
        
        // 如果上次重置日期不是今天（东八区），重置计数
        if (needsReset) {
          // 先重置计数
          // 注意：字段类型是 timestamptz，PostgreSQL 会自动处理时区转换
          // 直接使用 now() 即可，PostgreSQL 会以 UTC 存储
          await db
            .update(user)
            .set({
              dailyRequestCount: 0,
              lastRequestResetDate: sql`now()`,
              updatedAt: sql`now()`,
            })
            .where(eq(user.id, userId));
        }

        // 管理员不限次，其他用户检查次数限制
        if (!isAdmin) {
          // 获取用户限额配置（优先使用数据库配置，否则使用环境变量）
          let maxDailyRequests: number;
          try {
            const config = await db.select()
              .from(userLimitConfig)
              .where(eq(userLimitConfig.id, 1))
              .limit(1);
            
            if (config.length > 0) {
              const configData = config[0];
              if (isPremium) {
                // 优质用户额度：数据库 > 环境变量 > 默认
                const dbPremiumLimit = configData.premiumUserDailyLimit;
                const envPremiumLimit = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
                maxDailyRequests = dbPremiumLimit ?? envPremiumLimit;
                console.log(`[Generate API] Premium user limit - DB: ${dbPremiumLimit}, Env: ${envPremiumLimit}, Final: ${maxDailyRequests}`);
              } else {
                // 首批用户 & 新用户额度：数据库 > 环境变量 > 默认
                if (isOldUser) {
                  const dbRegularLimit = configData.regularUserDailyLimit;
                  const envRegularLimit = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
                  maxDailyRequests = dbRegularLimit ?? envRegularLimit;
                } else {
                  const dbNewLimit = configData.newUserDailyLimit;
                  const envNewLimit = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
                  maxDailyRequests = dbNewLimit ?? envNewLimit;
                }
              }
            } else {
              // 配置不存在，仅使用环境变量 > 默认
              if (isPremium) {
                maxDailyRequests = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
              } else {
                if (isOldUser) {
                  maxDailyRequests = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
                } else {
                  maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
                }
              }
            }
          } catch (error) {
            // 如果查询配置失败，使用环境变量作为后备
            console.error('Error fetching user limit config:', error);
            if (isPremium) {
              maxDailyRequests = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
            } else {
              if (isOldUser) {
                maxDailyRequests = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
              } else {
                maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
              }
            }
          }
          
          // 使用条件更新确保并发安全：只有在 dailyRequestCount < maxDailyRequests 时才更新
          // 这样可以防止两个并发请求同时通过检查并都增加计数
          // 
          // 并发安全性说明：
          // 1. PostgreSQL 的 UPDATE 语句是原子的，WHERE 条件在数据库层面执行
          // 2. 当两个请求同时到达时：
          //    - 请求A：读取计数39，执行 UPDATE WHERE dailyRequestCount < 40，条件为真，更新成功（变成40）
          //    - 请求B：读取计数39，执行 UPDATE WHERE dailyRequestCount < 40，但此时数据库中的值已经是40
          //      数据库在执行 WHERE 条件时会检查当前值（40），40 < 40 为假，更新失败（返回空数组）
          // 3. 这样确保即使在高并发情况下，计数也不会超出限制
          const updateData: any = {
            dailyRequestCount: sql`${user.dailyRequestCount} + 1`,
            updatedAt: sql`now()`,
          };
          
          // 使用条件更新，在 WHERE 子句中检查计数是否小于限制
          // 注意：WHERE 条件是在数据库执行更新时检查的，不是在我们代码中检查的
          // 这确保了即使两个请求同时到达，也只有一个能成功更新
          const updateResult = await db
            .update(user)
            .set(updateData)
            .where(
              and(
                eq(user.id, userId),
                lt(user.dailyRequestCount, maxDailyRequests)
              )
            )
            .returning({ dailyRequestCount: user.dailyRequestCount });
          
          // 如果更新失败（返回空数组），说明已经达到或超过限制
          // 注意：此时不立即返回错误，而是在解析请求体后检查积分
          // 如果模型支持积分消费且用户积分足够，则允许继续生成
          // 这部分逻辑在解析请求体后统一处理
          if (updateResult.length === 0) {
            // 标记为超出额度，但不立即返回错误
            // 后续在解析请求体后会检查积分
          }
        } else {
          // 管理员不限次，直接更新计数
          const updateData: any = {
            dailyRequestCount: sql`${user.dailyRequestCount} + 1`,
            updatedAt: sql`now()`,
          };
          await db
            .update(user)
            .set(updateData)
            .where(eq(user.id, userId));
        }
      }
      
      // 开始跟踪这个生成请求（用户并发）
      // 管理员和会员不受用户并发限制，不需要跟踪
      if (!isAdmin && !isSubscribed) {
        generationId = concurrencyManager.start(userId);
      }
    }
    
    // 解析请求体（提前解析，以便检查积分和额度）
    const body = await request.json()
    const { prompt, width, height, steps, seed, batch_size, model, images, negative_prompt } = body
    
    // 对于已登录用户，在解析请求体后检查积分和额度
    if (session?.user && !isAdmin) {
      const userId = session.user.id;
      
      // 重新查询用户当前计数和限额（因为可能已经更新）
      const currentUserData = await db
        .select({
          dailyRequestCount: user.dailyRequestCount,
          isPremium: user.isPremium,
          isOldUser: user.isOldUser,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      
      if (currentUserData.length > 0) {
        const userData = currentUserData[0];
        const currentCount = userData.dailyRequestCount || 0;
        const isPremium = userData.isPremium || false;
        const isOldUser = userData.isOldUser || false;
        
        // 获取用户限额
        let maxDailyRequests: number;
        try {
          const config = await db.select()
            .from(userLimitConfig)
            .where(eq(userLimitConfig.id, 1))
            .limit(1);
          
          if (config.length > 0) {
            const configData = config[0];
            if (isPremium) {
              const dbPremiumLimit = configData.premiumUserDailyLimit;
              const envPremiumLimit = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
              maxDailyRequests = dbPremiumLimit ?? envPremiumLimit;
            } else {
              if (isOldUser) {
                const dbRegularLimit = configData.regularUserDailyLimit;
                const envRegularLimit = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
                maxDailyRequests = dbRegularLimit ?? envRegularLimit;
              } else {
                const dbNewLimit = configData.newUserDailyLimit;
                const envNewLimit = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
                maxDailyRequests = dbNewLimit ?? envNewLimit;
              }
            }
          } else {
            if (isPremium) {
              maxDailyRequests = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
            } else {
              if (isOldUser) {
                maxDailyRequests = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
              } else {
                maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
              }
            }
          }
        } catch {
          if (isPremium) {
            maxDailyRequests = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
          } else {
            if (isOldUser) {
              maxDailyRequests = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
            } else {
              maxDailyRequests = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
            }
          }
        }
        
        const hasQuota = currentCount < maxDailyRequests;
        
        // 获取模型基础积分消耗
        const baseCost = await getModelBaseCost(model);
        
        if (baseCost !== null) {
          // 计算积分消耗
          const pointsCost = calculateGenerationCost(baseCost, model, steps, width, height, hasQuota);
          
          // 如果需要扣除积分（pointsCost > 0）
          if (pointsCost > 0) {
            // 检查积分是否足够
            const hasEnoughPoints = await checkPointsSufficient(userId, pointsCost);
            
            if (!hasEnoughPoints) {
              // 清理并发跟踪
              if (generationId) {
                concurrencyManager.end(generationId);
              }
              // 管理员和会员不受IP并发限制，不需要清理计数
              if (clientIP && !isAdmin && !isSubscribed) {
                await ipConcurrencyManager.end(clientIP).catch(err => {
                  console.error('Error decrementing IP concurrency:', err)
                })
              }
              
              return NextResponse.json({
                error: `积分不足。本次生成需要消耗 ${pointsCost} 积分，但您的积分余额不足。`,
                code: 'INSUFFICIENT_POINTS',
                requiredPoints: pointsCost
              }, { status: 402 }); // 402 Payment Required
            }
            
            // 扣除积分
            const deductSuccess = await deductPoints(
              userId,
              pointsCost,
              `图像生成 - ${model} (步数: ${steps}, 分辨率: ${width}x${height})`
            );
            
            if (!deductSuccess) {
              // 清理并发跟踪
              if (generationId) {
                concurrencyManager.end(generationId);
              }
              // 管理员和会员不受IP并发限制，不需要清理计数
              if (clientIP && !isAdmin && !isSubscribed) {
                await ipConcurrencyManager.end(clientIP).catch(err => {
                  console.error('Error decrementing IP concurrency:', err)
                })
              }
              
              // 再次检查积分余额，判断是积分不足还是其他错误
              const currentBalance = await getPointsBalance(userId);
              if (currentBalance < pointsCost) {
                // 积分不足
                return NextResponse.json({
                  error: `积分不足。本次生成需要消耗 ${pointsCost} 积分，但您的积分余额不足（当前余额：${currentBalance} 积分）。`,
                  code: 'INSUFFICIENT_POINTS',
                  requiredPoints: pointsCost,
                  currentBalance: currentBalance
                }, { status: 402 }); // 402 Payment Required
              } else {
                // 其他错误（如数据库错误）
                return NextResponse.json({
                  error: '积分扣除失败，请稍后重试',
                  code: 'POINTS_DEDUCTION_FAILED'
                }, { status: 500 });
              }
            }
          }
        } else if (!hasQuota) {
          // 模型未配置积分消耗，且用户已超出额度
          // 清理并发跟踪
          if (generationId) {
            concurrencyManager.end(generationId);
          }
          // 管理员和会员不受IP并发限制，不需要清理计数
          if (clientIP && !isAdmin && !isSubscribed) {
            await ipConcurrencyManager.end(clientIP).catch(err => {
              console.error('Error decrementing IP concurrency:', err)
            })
          }
          
          return NextResponse.json({
            error: `您今日的生图次数已达上限（${maxDailyRequests}次）。${isPremium ? '优质用户' : '普通用户'}每日可使用${maxDailyRequests}次生图功能。`,
            code: 'DAILY_LIMIT_EXCEEDED',
            dailyCount: currentCount,
            maxDailyRequests
          }, { status: 429 });
        }
      }
    }
    
    // 检查图改图模型的登录限制
    // 如果用户未登录且使用图改图模型（有上传图片且模型支持I2I），返回401
    if (!session?.user && images && images.length > 0) {
      // 检查模型是否支持I2I（图改图）
      const i2iModels = ['Qwen-Image-Edit', 'Flux-Dev', 'Flux-Kontext']
      if (i2iModels.includes(model)) {
        // 清理已增加的并发计数
        if (clientIP) {
          await ipConcurrencyManager.end(clientIP).catch(err => {
            console.error('Error decrementing IP concurrency after I2I login check:', err)
          })
        }
        return NextResponse.json({ 
          error: '图改图功能仅限登录用户使用，请先登录后再使用',
          code: 'LOGIN_REQUIRED_FOR_I2I'
        }, { status: 401 })
      }
    }
    
    // 如果用户未登录，添加延迟（未登录用户不受用户并发限制）
    // 注意：未登录用户的IP并发计数已在前面增加，所以排队期间也算IP并发
    if (!session?.user) {
      const unauthDelay = parseInt(process.env.UNAUTHENTICATED_USER_DELAY || '20', 10)
      await new Promise(resolve => setTimeout(resolve, unauthDelay * 1000))
    }

    // 验证输入
    // 只检查最小尺寸，不限制最大尺寸
    if (width < 64 || height < 64) {
      // 如果输入验证失败，需要清理已增加的并发计数
      if (!session?.user && clientIP) {
        // 未登录用户：清理IP并发计数
        await ipConcurrencyManager.end(clientIP).catch(err => {
          console.error('Error decrementing IP concurrency after validation error:', err)
        })
      } else if (session?.user && generationId) {
        // 已登录用户：清理用户并发跟踪（IP并发计数此时还未增加）
        concurrencyManager.end(generationId)
      }
      return NextResponse.json({ error: 'Invalid image dimensions' }, { status: 400 })
    }
    // 验证步数：根据模型配置验证
    const thresholds = getModelThresholds(model);
    if (thresholds.normalSteps !== null && thresholds.highSteps !== null) {
      // 如果模型支持步数修改，验证步数是否在允许范围内
      if (steps !== thresholds.normalSteps && steps !== thresholds.highSteps) {
        // 如果输入验证失败，需要清理已增加的并发计数
        if (!session?.user && clientIP) {
          // 未登录用户：清理IP并发计数
          await ipConcurrencyManager.end(clientIP).catch(err => {
            console.error('Error decrementing IP concurrency after validation error:', err)
          })
        } else if (session?.user && generationId) {
          // 已登录用户：清理用户并发跟踪（IP并发计数此时还未增加）
          concurrencyManager.end(generationId)
        }
        return NextResponse.json({ 
          error: `Invalid steps value. Only ${thresholds.normalSteps} or ${thresholds.highSteps} steps are allowed for this model.` 
        }, { status: 400 })
      }
    }

    // 对于已登录用户，在所有检查都通过后，原子性地增加IP并发计数
    // 未登录用户的IP并发计数已在前面增加
    // 管理员和会员不受IP并发限制，不需要增加计数
    if (clientIP && session?.user && !isAdmin && !isSubscribed) {
      const ipStartSuccess = await ipConcurrencyManager.start(clientIP, ipMaxConcurrency)
      if (!ipStartSuccess) {
        // 如果增加计数失败，需要清理用户并发跟踪
        if (generationId) {
          concurrencyManager.end(generationId)
        }
        const currentInfo = await ipConcurrencyManager.getInfo(clientIP)
        return NextResponse.json({
          error: `当前有 ${currentInfo?.currentConcurrency || 0} 个生图任务正在执行，请等待其他任务执行完成后再试。`,
          code: 'IP_CONCURRENCY_LIMIT_EXCEEDED',
          currentConcurrency: currentInfo?.currentConcurrency || 0,
          maxConcurrency: ipMaxConcurrency
        }, { status: 429 })
      }
    }

    // 调用 ComfyUI API
    let imageUrl = await generateImage({
      prompt,
      width,
      height,
      steps,
      seed: seed ? parseInt(seed) : undefined,
      batch_size,
      model,
      images,
      negative_prompt,
    })

    // 如果用户未登录，检查是否需要添加水印
    if (!session?.user) {
      // 检查是否启用水印（默认启用）
      const enableWatermark = process.env.ENABLE_WATERMARK !== 'false'
      
      if (enableWatermark) {
        // 获取水印文本（默认为"Dreamifly"）
        const watermarkText = process.env.WATERMARK_TEXT || 'Dreamifly'
        
        try {
          // 添加水印
          imageUrl = await addWatermark(imageUrl, watermarkText)
        } catch (error) {
          console.error('添加水印失败，返回原图:', error)
          // 如果添加水印失败，继续使用原图
        }
      }
    }

    // 计算总响应时间（秒），包含排队延迟
    const responseTime = (Date.now() - totalStartTime) / 1000

    // 更新统计数据
    await db.update(siteStats)
      .set({
        totalGenerations: sql`${siteStats.totalGenerations} + 1`,
        dailyGenerations: sql`${siteStats.dailyGenerations} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(siteStats.id, 1))

    // 记录模型使用统计
    try {
      // 创建当前时间的Date对象（JavaScript Date内部存储为UTC时间戳）
      // PostgreSQL的timestamptz会自动处理时区转换
      const now = new Date()
      
      await db.insert(modelUsageStats).values({
        id: randomUUID(),
        modelName: model,
        userId: session?.user?.id || null,
        responseTime,
        isAuthenticated: !!session?.user,
        ipAddress: clientIP,
        createdAt: now,
      })
    } catch (error) {
      // 记录统计失败不应该影响主流程
      console.error('Failed to record model usage stats:', error)
    }

    // 成功完成，清理并发跟踪
    if (generationId) {
      concurrencyManager.end(generationId);
    }
    
    // 清理IP并发跟踪
    // 管理员和会员不受IP并发限制，不需要清理计数
    if (clientIP && !isAdmin && !isSubscribed) {
      await ipConcurrencyManager.end(clientIP)
    }

    // 如果用户已登录，保存生成的图片
    if (session?.user) {
      try {
        const { saveUserGeneratedImage } = await import('@/utils/userImageStorage')
        await saveUserGeneratedImage(
          session.user.id,
          imageUrl, // base64格式的图片
          {
            prompt,
            model,
            width,
            height,
          }
        )
        console.log('用户生成图片已保存')
      } catch (error) {
        console.error('保存用户生成图片失败:', error)
        // 不阻止主流程，继续返回图片给用户
      }
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Error generating image:', error)
    
    // 发生错误，清理并发跟踪
    if (generationId) {
      concurrencyManager.end(generationId);
    }
    
    // 清理IP并发跟踪
    // 管理员和会员不受IP并发限制，不需要清理计数
    if (clientIP && !isAdmin && !isSubscribed) {
      await ipConcurrencyManager.end(clientIP).catch(err => {
        console.error('Error decrementing IP concurrency:', err)
      })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    )
  }
} 