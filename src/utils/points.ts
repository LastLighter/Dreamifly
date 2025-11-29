import { db } from '@/db';
import { userPoints, pointsConfig } from '@/db/schema';
import { eq, and, gte, lt, sql, inArray, isNotNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/**
 * 获取积分配置
 * 优先级：数据库配置 > 环境变量默认值
 */
export async function getPointsConfig() {
  // 获取数据库配置
  const config = await db.select()
    .from(pointsConfig)
    .where(eq(pointsConfig.id, 1))
    .limit(1);

  const configData = config.length > 0 ? config[0] : null;

  // 获取环境变量默认值
  const envRegularPoints = parseInt(process.env.REGULAR_USER_DAILY_POINTS || '20', 10);
  const envPremiumPoints = parseInt(process.env.PREMIUM_USER_DAILY_POINTS || '40', 10);
  const envExpiryDays = parseInt(process.env.POINTS_EXPIRY_DAYS || '7', 10);
  const envRepairCost = parseInt(process.env.REPAIR_WORKFLOW_COST || '3', 10);

  return {
    regularUserDailyPoints: configData?.regularUserDailyPoints ?? envRegularPoints,
    premiumUserDailyPoints: configData?.premiumUserDailyPoints ?? envPremiumPoints,
    pointsExpiryDays: configData?.pointsExpiryDays ?? envExpiryDays,
    repairWorkflowCost: configData?.repairWorkflowCost ?? envRepairCost,
  };
}

/**
 * 获取用户积分余额
 * 只统计未过期的获得积分，减去所有消费积分
 */
export async function getPointsBalance(userId: string): Promise<number> {
  const now = new Date();

  // 获取所有未过期且仍有剩余的积分
  const earnedPoints = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userPoints.points}), 0)`,
    })
    .from(userPoints)
    .where(
      and(
        eq(userPoints.userId, userId),
        eq(userPoints.type, 'earned'),
        isNotNull(userPoints.expiresAt),
        gte(userPoints.expiresAt, now)
      )
    );

  const earned = Number(earnedPoints[0]?.total || 0);

  return Math.max(0, earned);
}

/**
 * 检查积分是否足够
 */
export async function checkPointsSufficient(userId: string, amount: number): Promise<boolean> {
  const balance = await getPointsBalance(userId);
  return balance >= amount;
}

/**
 * 扣除用户积分
 * 使用FIFO（先进先出）原则，优先扣除即将过期的积分
 * @param userId 用户ID
 * @param amount 扣除的积分数量
 * @param description 描述
 * @returns 是否扣除成功
 */
export async function deductPoints(
  userId: string,
  amount: number,
  description: string = '积分消费'
): Promise<boolean> {
  // 检查积分是否足够
  const balance = await getPointsBalance(userId);
  if (balance < amount) {
    return false;
  }

  // 获取所有未过期的获得积分，按过期时间升序排列（FIFO）
  const now = new Date();
  const availablePoints = await db
    .select()
    .from(userPoints)
    .where(
      and(
        eq(userPoints.userId, userId),
        eq(userPoints.type, 'earned'),
        isNotNull(userPoints.expiresAt),
        gte(userPoints.expiresAt, now)
      )
    )
    .orderBy(userPoints.expiresAt);

  let remaining = amount;
  const deductions: Array<{ id: string; points: number }> = [];

  // 按FIFO原则扣除积分
  for (const pointRecord of availablePoints) {
    if (remaining <= 0) break;

    const recordPoints = pointRecord.points;
    if (recordPoints <= remaining) {
      // 整条记录全部扣除
      deductions.push({ id: pointRecord.id, points: recordPoints });
      remaining -= recordPoints;
    } else {
      // 部分扣除（需要拆分记录）
      deductions.push({ id: pointRecord.id, points: remaining });
      // 更新原记录，减少积分
      await db
        .update(userPoints)
        .set({ points: recordPoints - remaining })
        .where(eq(userPoints.id, pointRecord.id));
      remaining = 0;
    }
  }

  // 删除已完全扣除的记录
  if (deductions.length > 0) {
    const idsToDelete = deductions
      .filter(d => {
        const originalRecord = availablePoints.find(p => p.id === d.id);
        return originalRecord && originalRecord.points === d.points;
      })
      .map(d => d.id);

    if (idsToDelete.length > 0) {
      await db
        .delete(userPoints)
        .where(
          and(
            eq(userPoints.userId, userId),
            inArray(userPoints.id, idsToDelete)
          )
        );
    }
  }

  // 创建消费记录
  await db.insert(userPoints).values({
    id: randomUUID(),
    userId,
    points: -amount,
    type: 'spent',
    description,
    earnedAt: new Date(),
    expiresAt: null,
  });

  return true;
}

/**
 * 检查今天是否已发放过积分
 */
export async function hasAwardedToday(userId: string): Promise<boolean> {
  // 以东八区（GMT+8）作为“自然日”边界
  const timezoneOffsetHours = 8;
  const timezoneOffsetMs = timezoneOffsetHours * 60 * 60 * 1000;

  const nowUtc = new Date();
  // 转换到东八区时间
  const gmt8Now = new Date(nowUtc.getTime() + timezoneOffsetMs);

  const gmt8StartOfDay = new Date(gmt8Now);
  gmt8StartOfDay.setHours(0, 0, 0, 0);

  const gmt8EndOfDay = new Date(gmt8StartOfDay);
  gmt8EndOfDay.setDate(gmt8EndOfDay.getDate() + 1);

  // 转回 UTC，用于与数据库中的 UTC 时间进行比较
  const utcStart = new Date(gmt8StartOfDay.getTime() - timezoneOffsetMs);
  const utcEnd = new Date(gmt8EndOfDay.getTime() - timezoneOffsetMs);

  const todayAwards = await db
    .select()
    .from(userPoints)
    .where(
      and(
        eq(userPoints.userId, userId),
        eq(userPoints.type, 'earned'),
        gte(userPoints.earnedAt, utcStart),
        lt(userPoints.earnedAt, utcEnd)
      )
    )
    .limit(1);

  return todayAwards.length > 0;
}

