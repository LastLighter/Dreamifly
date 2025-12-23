// IP注册限制管理器 - 用于限制基于IP的注册次数

import { db } from '@/db'
import { ipRegistrationLimit } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

interface IPRegistrationInfo {
  ipAddress: string
  registrationCount: number
  firstRegistrationAt: Date | null
  lastRegistrationAt: Date | null
}

/**
 * 获取IP注册限制配置
 * @returns 24小时内允许的最大注册次数（默认2次）
 */
function getMaxRegistrationsPer24Hours(): number {
  return parseInt(process.env.MAX_REGISTRATIONS_PER_24H || '2', 10)
}

/**
 * 获取或创建IP注册记录
 */
async function getOrCreateIPRegistrationRecord(ipAddress: string): Promise<IPRegistrationInfo> {
  const records = await db
    .select()
    .from(ipRegistrationLimit)
    .where(eq(ipRegistrationLimit.ipAddress, ipAddress))
    .limit(1)

  if (records.length > 0) {
    return {
      ipAddress: records[0].ipAddress,
      registrationCount: records[0].registrationCount || 0,
      firstRegistrationAt: records[0].firstRegistrationAt,
      lastRegistrationAt: records[0].lastRegistrationAt,
    }
  }

  // 创建新记录
  await db.insert(ipRegistrationLimit).values({
    ipAddress,
    registrationCount: 0,
    firstRegistrationAt: null,
    lastRegistrationAt: null,
    updatedAt: new Date(),
    createdAt: new Date(),
  })

  return {
    ipAddress,
    registrationCount: 0,
    firstRegistrationAt: null,
    lastRegistrationAt: null,
  }
}

/**
 * 检查IP是否可以在24小时内注册
 * @param ipAddress IP地址
 * @returns 是否可以注册，以及当前注册次数和限制信息
 */
export async function canRegister(
  ipAddress: string
): Promise<{ 
  canRegister: boolean
  registrationCount: number
  maxRegistrations: number
  resetAt: Date | null
  message?: string
}> {
  if (!ipAddress) {
    return {
      canRegister: false,
      registrationCount: 0,
      maxRegistrations: getMaxRegistrationsPer24Hours(),
      resetAt: null,
      message: 'IP地址无效'
    }
  }

  const maxRegistrations = getMaxRegistrationsPer24Hours()
  const record = await getOrCreateIPRegistrationRecord(ipAddress)
  
  // 如果没有注册记录，可以注册
  if (!record.firstRegistrationAt) {
    return {
      canRegister: true,
      registrationCount: 0,
      maxRegistrations,
      resetAt: null
    }
  }

  // 计算24小时窗口
  const now = new Date()
  const firstRegistrationTime = record.firstRegistrationAt
  const hoursSinceFirstRegistration = (now.getTime() - firstRegistrationTime.getTime()) / (1000 * 60 * 60)

  // 如果超过24小时，允许注册（但不在这里重置，由 recordRegistration 统一处理重置逻辑）
  if (hoursSinceFirstRegistration >= 24) {
    return {
      canRegister: true,
      registrationCount: 0, // 返回0表示可以重新开始计数
      maxRegistrations,
      resetAt: null
    }
  }

  // 检查是否达到限制
  const canRegister = record.registrationCount < maxRegistrations
  const resetAt = new Date(firstRegistrationTime.getTime() + 24 * 60 * 60 * 1000)

  return {
    canRegister,
    registrationCount: record.registrationCount,
    maxRegistrations,
    resetAt,
    message: canRegister 
      ? undefined 
      : `24小时内最多只能注册${maxRegistrations}次，请在${resetAt.toLocaleString('zh-CN')}后重试`
  }
}

/**
 * 记录一次注册（增加注册计数）
 * @param ipAddress IP地址
 */
export async function recordRegistration(ipAddress: string): Promise<void> {
  if (!ipAddress) {
    return
  }

  const now = new Date()
  const record = await getOrCreateIPRegistrationRecord(ipAddress)

  // 如果是第一次注册（firstRegistrationAt 为 null），设置时间戳并设置计数为 1
  if (!record.firstRegistrationAt) {
    await db
      .update(ipRegistrationLimit)
      .set({
        registrationCount: 1,
        firstRegistrationAt: now,
        lastRegistrationAt: now,
        updatedAt: now,
      })
      .where(eq(ipRegistrationLimit.ipAddress, ipAddress))
  } else {
    // 检查是否在24小时窗口内
    const hoursSinceFirstRegistration = (now.getTime() - record.firstRegistrationAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceFirstRegistration < 24) {
      // 在24小时窗口内，增加计数
      await db
        .update(ipRegistrationLimit)
        .set({
          registrationCount: sql`${ipRegistrationLimit.registrationCount} + 1`,
          lastRegistrationAt: now,
          updatedAt: now,
        })
        .where(eq(ipRegistrationLimit.ipAddress, ipAddress))
    } else {
      // 超过24小时，重置并开始新的窗口
      await db
        .update(ipRegistrationLimit)
        .set({
          registrationCount: 1,
          firstRegistrationAt: now,
          lastRegistrationAt: now,
          updatedAt: now,
        })
        .where(eq(ipRegistrationLimit.ipAddress, ipAddress))
    }
  }
}

/**
 * 获取IP注册信息
 * @param ipAddress IP地址
 */
export async function getRegistrationInfo(ipAddress: string): Promise<IPRegistrationInfo | null> {
  if (!ipAddress) {
    return null
  }

  const records = await db
    .select()
    .from(ipRegistrationLimit)
    .where(eq(ipRegistrationLimit.ipAddress, ipAddress))
    .limit(1)

  if (records.length === 0) {
    return null
  }

  return {
    ipAddress: records[0].ipAddress,
    registrationCount: records[0].registrationCount || 0,
    firstRegistrationAt: records[0].firstRegistrationAt,
    lastRegistrationAt: records[0].lastRegistrationAt,
  }
}

