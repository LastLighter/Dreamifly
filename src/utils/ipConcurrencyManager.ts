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
 * - 如果当前用户是已登录用户（优质/普通），返回MAX_CONCURRENT_GENERATIONS
 * - 如果当前用户未登录，返回1
 */
async function calculateMaxConcurrency(
  ipAddress: string,
  currentUserId: string | null,
  isAdmin: boolean,
  isPremium: boolean
): Promise<number | null> {
  // 获取环境变量中的最大并发数
  const maxConcurrentFromEnv = parseInt(process.env.MAX_CONCURRENT_GENERATIONS || '2', 10)

  // 如果当前用户是管理员，返回null（不限）
  if (isAdmin) {
    console.log(`[IPConcurrency] IP ${ipAddress}: 当前请求用户是管理员，返回null（不限）`)
    return null
  }

  // 如果当前用户已登录（非管理员），使用环境变量
  if (currentUserId) {
    console.log(`[IPConcurrency] IP ${ipAddress}: 当前请求用户是已登录用户（${isPremium ? '优质' : '普通'}），返回${maxConcurrentFromEnv}`)
    return maxConcurrentFromEnv
  }

  // 未登录用户，返回1
  console.log(`[IPConcurrency] IP ${ipAddress}: 当前请求用户未登录，返回1`)
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
   * 原子操作：检查IP是否可以开始新的生成请求，如果可以则立即增加并发计数
   * 使用数据库原子更新来避免竞态条件
   * @param ipAddress IP地址
   * @param currentUserId 当前用户ID（如果已登录）
   * @param isAdmin 当前用户是否为管理员
   * @param isPremium 当前用户是否为优质用户
   * @returns 是否可以开始新请求，以及当前并发数和最大并发数
   */
  async canStart(
    ipAddress: string,
    currentUserId: string | null,
    isAdmin: boolean,
    isPremium: boolean
  ): Promise<{ canStart: boolean; currentConcurrency: number; maxConcurrency: number | null }> {
    if (!ipAddress) {
      return { canStart: false, currentConcurrency: 0, maxConcurrency: null }
    }

    // 先计算最大并发量（基于当前状态）
    const maxConcurrency = await calculateMaxConcurrency(ipAddress, currentUserId, isAdmin, isPremium)

    // 确保记录存在
    await getOrCreateIPRecord(ipAddress)

    // 更新最大并发量（确保始终是最新的）
    await updateMaxConcurrency(ipAddress, maxConcurrency)

    // 如果最大并发量为null（管理员），直接增加计数并允许开始
    if (maxConcurrency === null) {
      await incrementConcurrency(ipAddress)
      const ipRecord = await getOrCreateIPRecord(ipAddress)
      return { canStart: true, currentConcurrency: ipRecord.currentConcurrency, maxConcurrency: null }
    }

    // 使用原子更新：只有在 current_concurrency < max_concurrency 时才增加计数
    // 这样可以避免竞态条件
    // 先获取当前值
    const beforeUpdate = await getOrCreateIPRecord(ipAddress)
    const expectedNewValue = beforeUpdate.currentConcurrency + 1
    
    // 原子更新：只有在 current_concurrency < max_concurrency 时才增加
    await db
      .update(ipConcurrency)
      .set({
        currentConcurrency: sql`${ipConcurrency.currentConcurrency} + 1`,
        maxConcurrency,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ipConcurrency.ipAddress, ipAddress),
          sql`${ipConcurrency.currentConcurrency} < ${maxConcurrency}`
        )
      )

    // 重新查询以获取更新后的值
    const afterUpdate = await getOrCreateIPRecord(ipAddress)
    
    // 如果 currentConcurrency 等于预期的新值，说明更新成功
    if (afterUpdate.currentConcurrency === expectedNewValue) {
      return {
        canStart: true,
        currentConcurrency: afterUpdate.currentConcurrency,
        maxConcurrency,
      }
    }

    // 更新失败，说明已经超过限制（可能被其他请求抢先更新了）
    return {
      canStart: false,
      currentConcurrency: afterUpdate.currentConcurrency,
      maxConcurrency,
    }
  },

  /**
   * 开始一个新的生成请求（增加并发计数）
   * 注意：这个方法现在主要用于向后兼容，实际计数已经在 canStart 中完成
   * @param ipAddress IP地址
   */
  async start(ipAddress: string): Promise<void> {
    // 计数已经在 canStart 中原子性地增加了，这里不需要再做任何操作
    // 保留这个方法是为了向后兼容，但实际上不会执行任何操作
    if (!ipAddress) {
      return
    }
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

