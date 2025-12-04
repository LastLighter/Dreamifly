import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, userLimitConfig } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';

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

export async function GET(request: NextRequest) {
  try {
    // 验证动态token
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // 获取用户信息
    const userData = await db
      .select({
        isAdmin: user.isAdmin,
        isPremium: user.isPremium,
        isOldUser: user.isOldUser,
        dailyRequestCount: user.dailyRequestCount,
        lastRequestResetDate: sql<string | null>`${user.lastRequestResetDate} AT TIME ZONE 'UTC'`,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (userData.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userInfo = userData[0];
    const isAdmin = userInfo.isAdmin || false;
    const isPremium = userInfo.isPremium || false;
    const isOldUser = userInfo.isOldUser || false;

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

    // 计算今日使用次数并检查是否需要重置
    let todayCount = 0;
    let needsReset = false;
    
    if (userInfo.lastRequestResetDate) {
      // 由于查询时已经使用 AT TIME ZONE 'UTC' 转换为UTC时间字符串
      // 返回的格式是 '2025-11-17 15:17:26.143223' (无时区标识的UTC时间，空格分隔)
      // 需要转换为ISO 8601格式（将空格替换为T，添加Z表示UTC）
      const lastResetDate = new Date(userInfo.lastRequestResetDate.replace(' ', 'T') + 'Z');
      const lastResetDayShanghai = getShanghaiDate(lastResetDate);
      const lastResetDayShanghaiDate = new Date(Date.UTC(
        lastResetDayShanghai.year,
        lastResetDayShanghai.month,
        lastResetDayShanghai.day
      ));
      
      // 检查是否需要重置（上次重置日期不是今天）
      needsReset = lastResetDayShanghaiDate.getTime() !== todayShanghaiDate.getTime();
      
      // 如果上次重置日期是今天（东八区），使用当前计数；否则为0
      if (!needsReset) {
        todayCount = userInfo.dailyRequestCount || 0;
      }
      // 如果需要重置，todayCount 保持为 0
    } else {
      // 如果没有重置日期，也需要重置
      needsReset = true;
    }
    
    // 如果需要重置，更新数据库（确保数据一致性）
    if (needsReset) {
      await db
        .update(user)
        .set({
          dailyRequestCount: 0,
          lastRequestResetDate: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(user.id, userId));
      todayCount = 0;
    }

    // 获取用户限额配置
    let maxDailyRequests: number | null = null;
    if (!isAdmin) {
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
            console.log(`[Quota API] Premium user limit - DB: ${dbPremiumLimit}, Env: ${envPremiumLimit}, Final: ${maxDailyRequests}`);
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
    }

    return NextResponse.json({
      todayCount,
      maxDailyRequests,
      isAdmin,
      isPremium,
      isOldUser,
    });
  } catch (error) {
    console.error('Error fetching user quota:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

