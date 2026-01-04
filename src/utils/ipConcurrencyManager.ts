// IP并发管理器 - 用于限制基于IP的并发生图请求

import { db } from '@/db'
import { ipConcurrency } from '@/db/schema'
import { eq, sql, and } from 'drizzle-orm'

interface IPConcurrencyInfo {
  ipAddress: string
  currentConcurrency: number
  maxConcurrency: number | null
}

/**
 * 计算IP的最大并发量（基于当前请求用户的身份）
 * 规则：
 * - 如果当前用户是管理员，返回null（不限）
 * - 如果当前用户是会员，返回null（不限）
 * - 如果当前用户是已登录用户（优质/普通），返回MAX_CONCURRENT_GENERATIONS
 * - 如果当前用户未登录，返回1
 */
async function calculateMaxConcurrency(
  ipAddress: string,
  currentUserId: string | null,
  isAdmin: boolean,
  isPremium: boolean,
  isSubscribed: boolean
): Promise<number | null> {
  // 获取环境变量中的最大并发数
  const maxConcurrentFromEnv = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '2', 10)

  // 如果当前用户是管理员，返回null（不限）
  if (isAdmin) {
    return null
  }

  // 如果当前用户是会员，返回null（不限）
  if (isSubscribed) {
    return null
  }

  // 如果当前用户已登录（非管理员、非会员），使用环境变量
  if (currentUserId) {
    return maxConcurrentFromEnv
  }

  // 未登录用户，返回1
  return 1
}

/**
 * 获取或创建IP并发记录
 */
async function getOrCreateIPRecord(ipAddress: string): Promise<IPConcurrencyInfo> {
  const records = await db
    .select()
    .from(ipConcurrency)
    .where(eq(ipConcurrency.ipAddress, ipAddress))
    .limit(1)

  if (records.length > 0) {
    return {
      ipAddress: records[0].ipAddress,
      currentConcurrency: records[0].currentConcurrency || 0,
      maxConcurrency: records[0].maxConcurrency,
    }
  }

  // 创建新记录
  await db.insert(ipConcurrency).values({
    ipAddress,
    currentConcurrency: 0,
    maxConcurrency: null,
    updatedAt: new Date(),
    createdAt: new Date(),
  })

  return {
    ipAddress,
    currentConcurrency: 0,
    maxConcurrency: null,
  }
}

/**
 * 更新IP的最大并发量（如果需要）
 */
async function updateMaxConcurrency(
  ipAddress: string,
  maxConcurrency: number | null
): Promise<void> {
  await db
    .update(ipConcurrency)
    .set({
      maxConcurrency,
      updatedAt: new Date(),
    })
    .where(eq(ipConcurrency.ipAddress, ipAddress))
}

/**
 * 增加IP的当前并发量
 */
async function incrementConcurrency(ipAddress: string): Promise<void> {
  await db
    .update(ipConcurrency)
    .set({
      currentConcurrency: sql`${ipConcurrency.currentConcurrency} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(ipConcurrency.ipAddress, ipAddress))
}

/**
 * 减少IP的当前并发量
 */
async function decrementConcurrency(ipAddress: string): Promise<void> {
  await db
    .update(ipConcurrency)
    .set({
      currentConcurrency: sql`GREATEST(${ipConcurrency.currentConcurrency} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(ipConcurrency.ipAddress, ipAddress))
}

export const ipConcurrencyManager = {
  /**
   * 检查IP是否可以开始新的生成请求（不增加计数）
   * 注意：此方法只进行检查，不会增加并发计数
   * @param ipAddress IP地址
   * @param currentUserId 当前用户ID（如果已登录）
   * @param isAdmin 当前用户是否为管理员
   * @param isPremium 当前用户是否为优质用户
   * @param isSubscribed 当前用户是否为会员
   * @returns 是否可以开始新请求，以及当前并发数和最大并发数
   */
  async canStart(
    ipAddress: string,
    currentUserId: string | null,
    isAdmin: boolean,
    isPremium: boolean,
    isSubscribed: boolean
  ): Promise<{ canStart: boolean; currentConcurrency: number; maxConcurrency: number | null }> {
    if (!ipAddress) {
      return { canStart: false, currentConcurrency: 0, maxConcurrency: null }
    }

    // 先计算最大并发量（基于当前状态）
    const maxConcurrency = await calculateMaxConcurrency(ipAddress, currentUserId, isAdmin, isPremium, isSubscribed)

    // 确保记录存在
    await getOrCreateIPRecord(ipAddress)

    // 更新最大并发量（确保始终是最新的）
    await updateMaxConcurrency(ipAddress, maxConcurrency)

    // 获取当前并发信息
    const ipRecord = await getOrCreateIPRecord(ipAddress)

    // 如果最大并发量为null（管理员或会员），直接允许开始
    if (maxConcurrency === null) {
      return { canStart: true, currentConcurrency: ipRecord.currentConcurrency, maxConcurrency: null }
    }

    // 检查是否还有空位（不增加计数）
    return {
      canStart: ipRecord.currentConcurrency < maxConcurrency,
      currentConcurrency: ipRecord.currentConcurrency,
      maxConcurrency,
    }
  },

  /**
   * 原子性地开始一个新的生成请求（增加并发计数）
   * 只有在还有空位时才会增加计数，使用数据库原子更新来避免竞态条件
   * @param ipAddress IP地址
   * @param maxConcurrency 最大并发数（如果为null表示管理员，不限）
   * @returns 是否成功增加计数
   */
  async start(ipAddress: string, maxConcurrency: number | null): Promise<boolean> {
    if (!ipAddress) {
      return false
    }

    // 如果最大并发为null（管理员），直接增加计数
    if (maxConcurrency === null) {
      await incrementConcurrency(ipAddress)
      return true
    }

    // 使用原子更新：只有在 current_concurrency < max_concurrency 时才增加计数
    // 使用 RETURNING 子句来获取更新后的值，确保原子性
    const result = await db
      .update(ipConcurrency)
      .set({
        currentConcurrency: sql`${ipConcurrency.currentConcurrency} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ipConcurrency.ipAddress, ipAddress),
          sql`${ipConcurrency.currentConcurrency} < ${maxConcurrency}`
        )
      )
      .returning({ currentConcurrency: ipConcurrency.currentConcurrency })

    // 如果更新成功，result 会包含更新后的记录
    // 如果更新失败（条件不满足），result 为空数组
    if (result.length === 0) {
      // 更新失败，说明当前并发数已经达到或超过最大值
      return false
    }

    // 更新成功，返回 true
    return true
  },

  /**
   * 结束一个生成请求（减少并发计数）
   * @param ipAddress IP地址
   */
  async end(ipAddress: string): Promise<void> {
    if (!ipAddress) {
      return
    }

    // 减少并发计数
    await decrementConcurrency(ipAddress)
  },

  /**
   * 获取IP的当前并发信息
   * @param ipAddress IP地址
   */
  async getInfo(ipAddress: string): Promise<IPConcurrencyInfo | null> {
    if (!ipAddress) {
      return null
    }

    const records = await db
      .select()
      .from(ipConcurrency)
      .where(eq(ipConcurrency.ipAddress, ipAddress))
      .limit(1)

    if (records.length === 0) {
      return null
    }

    return {
      ipAddress: records[0].ipAddress,
      currentConcurrency: records[0].currentConcurrency || 0,
      maxConcurrency: records[0].maxConcurrency,
    }
  },
}

