import { db } from '@/db';
import { userPoints, pointsConfig, user, userLimitConfig } from '@/db/schema';
import { eq, and, gte, sql, inArray, isNotNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getModelThresholds } from '@/utils/modelConfig';

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
  const envRepairCost = parseInt(process.env.REPAIR_WORKFLOW_COST || '5', 10);
  const envUpscaleCost = parseInt(process.env.UPSCALE_WORKFLOW_COST || '5', 10);
  
  // 模型积分消耗默认值
  const envZImageTurboCost = parseInt(process.env.Z_IMAGE_TURBO_COST || '3', 10);
  const envQwenImageEditCost = parseInt(process.env.QWEN_IMAGE_EDIT_COST || '4', 10);
  const envWaiSdxlV150Cost = parseInt(process.env.WAI_SDXL_V150_COST || '2', 10);

  return {
    regularUserDailyPoints: configData?.regularUserDailyPoints ?? envRegularPoints,
    premiumUserDailyPoints: configData?.premiumUserDailyPoints ?? envPremiumPoints,
    pointsExpiryDays: configData?.pointsExpiryDays ?? envExpiryDays,
    repairWorkflowCost: configData?.repairWorkflowCost ?? envRepairCost,
    upscaleWorkflowCost: configData?.upscaleWorkflowCost ?? envUpscaleCost,
    zImageTurboCost: configData?.zImageTurboCost ?? envZImageTurboCost,
    qwenImageEditCost: configData?.qwenImageEditCost ?? envQwenImageEditCost,
    waiSdxlV150Cost: configData?.waiSdxlV150Cost ?? envWaiSdxlV150Cost,
  };
}

/**
 * 获取图片存储配额配置
 * 优先级：数据库配置 > 环境变量 > 默认值
 */
export async function getImageStorageConfig() {
  // 获取数据库配置（从 userLimitConfig 表）
  const config = await db.select()
    .from(userLimitConfig)
    .where(eq(userLimitConfig.id, 1))
    .limit(1);

  const configData = config.length > 0 ? config[0] : null;

  // 获取环境变量默认值
  const envRegularMaxImages = parseInt(process.env.REGULAR_USER_MAX_IMAGES || '3', 10);
  const envSubscribedMaxImages = parseInt(process.env.SUBSCRIBED_USER_MAX_IMAGES || '30', 10);

  // 默认值
  const DEFAULT_REGULAR_MAX_IMAGES = 3;
  const DEFAULT_SUBSCRIBED_MAX_IMAGES = 30;

  return {
    regularUserMaxImages: configData?.regularUserMaxImages ?? envRegularMaxImages ?? DEFAULT_REGULAR_MAX_IMAGES,
    subscribedUserMaxImages: configData?.subscribedUserMaxImages ?? envSubscribedMaxImages ?? DEFAULT_SUBSCRIBED_MAX_IMAGES,
  };
}

/**
 * 获取模型的基础积分消耗
 * @param modelId 模型ID
 * @returns 基础积分消耗，如果模型未配置则返回null
 */
export async function getModelBaseCost(modelId: string): Promise<number | null> {
  const config = await getPointsConfig();
  
  switch (modelId) {
    case 'Z-Image-Turbo':
      return config.zImageTurboCost;
    case 'Qwen-Image-Edit':
      return config.qwenImageEditCost;
    case 'Wai-SDXL-V150':
      return config.waiSdxlV150Cost;
    default:
      return null; // 其他模型未配置积分消耗
  }
}

/**
 * 计算图像生成的积分消耗
 * @param baseCost 基础积分（按模型）
 * @param modelId 模型ID
 * @param steps 步数
 * @param width 图像宽度
 * @param height 图像高度
 * @param hasQuota 是否有额度（未超出每日限额）
 * @returns 需要扣除的积分数量
 */
export function calculateGenerationCost(
  baseCost: number,
  modelId: string,
  steps: number,
  width: number,
  height: number,
  hasQuota: boolean
): number {
  // 获取模型的阈值配置
  const thresholds = getModelThresholds(modelId);
  
  // 判断是否为高步数
  let isHighSteps = false;
  if (thresholds.normalSteps !== null && thresholds.highSteps !== null) {
    // 如果步数 >= 高步数阈值，则为高步数
    isHighSteps = steps >= thresholds.highSteps;
  }
  
  // 判断是否为高分辨率
  let isHighResolution = false;
  const totalPixels = width * height;
  if (thresholds.normalResolutionPixels !== null && thresholds.highResolutionPixels !== null) {
    // 如果总像素 > 普通分辨率阈值，则为高分辨率
    isHighResolution = totalPixels > thresholds.normalResolutionPixels;
  }
  
  // 计算总积分消耗
  let multiplier = 1;
  if (isHighSteps) multiplier *= 2;
  if (isHighResolution) multiplier *= 2;
  
  const totalCost = baseCost * multiplier;
  
  // 如果有额度，只扣除额外部分（总消耗 - 基础消耗）
  if (hasQuota) {
    return Math.max(0, totalCost - baseCost);
  } else {
    // 超出额度，扣除全部积分
    return totalCost;
  }
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
 * 使用数据库事务和行级锁确保并发安全
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
  // 使用事务确保原子性
  return await db.transaction(async (tx) => {
    const now = new Date();
    
    // 使用 FOR UPDATE 锁定行，防止并发修改
    // 获取所有未过期的获得积分，按过期时间升序排列（FIFO）
    // 在事务中直接计算积分余额，确保使用锁定的数据
    // 使用原生 SQL 的 FOR UPDATE 来锁定行
    // 注意：postgres-js 的 sql 模板需要将 Date 转换为 ISO 字符串
    const nowISO = now.toISOString();
    const availablePointsResult = await tx
      .execute(sql`
        SELECT id, points, earned_at, expires_at
        FROM user_points
        WHERE user_id = ${userId}
          AND type = 'earned'
          AND expires_at IS NOT NULL
          AND expires_at >= ${nowISO}::timestamptz
        ORDER BY expires_at ASC
        FOR UPDATE
      `);

    // 计算可用积分总额
    let totalAvailable = 0;
    const availablePoints = (availablePointsResult as any[]).map((row: any) => {
      const points = Number(row.points);
      totalAvailable += points;
      return {
        id: String(row.id),
        points: points,
        earnedAt: row.earned_at instanceof Date ? row.earned_at : new Date(row.earned_at),
        expiresAt: row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at),
      };
    });

    // 检查积分是否足够（使用锁定的数据）
    if (totalAvailable < amount) {
      return false;
    }

    let remaining = amount;
    const deductions: Array<{ id: string; points: number; originalPoints: number; earnedAt: Date }> = [];

    // 按FIFO原则扣除积分
    for (const pointRecord of availablePoints) {
      if (remaining <= 0) break;

      const recordPoints = pointRecord.points;
      
      if (recordPoints <= remaining) {
        // 整条记录全部扣除
        deductions.push({ 
          id: pointRecord.id, 
          points: recordPoints,
          originalPoints: recordPoints,
          earnedAt: pointRecord.earnedAt
        });
        remaining -= recordPoints;
        
        // 如果是今天的签到记录，即使积分用完了也要保留，但将points设为0
        // 注意：这里不能直接更新，因为后面会统一处理
      } else {
        // 部分扣除（需要拆分记录）
        deductions.push({ 
          id: pointRecord.id, 
          points: remaining,
          originalPoints: recordPoints,
          earnedAt: pointRecord.earnedAt
        });
        // 更新原记录，减少积分
        // 如果是今天的签到记录，即使剩余积分为0也要保留
        const newPoints = recordPoints - remaining;
        await tx
          .update(userPoints)
          .set({ points: newPoints })
          .where(eq(userPoints.id, pointRecord.id));
        remaining = 0;
      }
    }

    // 如果剩余积分不足，回滚事务
    if (remaining > 0) {
      throw new Error('Insufficient points');
    }

    // 删除已完全扣除的记录
    // 现在使用 user 表的 lastDailyAwardDate 字段来判断是否已签到，所以可以正常删除记录
    if (deductions.length > 0) {
      const idsToDelete = deductions
        .filter(d => d.points === d.originalPoints) // 只删除完全扣除的记录
        .map(d => d.id);

      if (idsToDelete.length > 0) {
        await tx
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
    await tx.insert(userPoints).values({
      id: randomUUID(),
      userId,
      points: -amount,
      type: 'spent',
      description,
      earnedAt: new Date(),
      expiresAt: null,
    });

    return true;
  }).catch((error) => {
    console.error('Error deducting points:', error);
    return false;
  });
}

/**
 * 检查今天是否已发放过积分
 * 使用 user 表的 lastDailyAwardDate 字段判断，以东八区凌晨4点作为刷新时间
 */
export async function hasAwardedToday(userId: string): Promise<boolean> {
  // 获取用户信息
  const userData = await db
    .select({
      lastDailyAwardDate: user.lastDailyAwardDate,
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);

  if (userData.length === 0 || !userData[0].lastDailyAwardDate) {
    return false;
  }

  const lastAwardDate = userData[0].lastDailyAwardDate;

  // 以东八区（GMT+8）凌晨4点作为"自然日"边界
  const timezoneOffsetHours = 8;
  const timezoneOffsetMs = timezoneOffsetHours * 60 * 60 * 1000;

  const nowUtc = new Date();
  
  // 计算当前东八区时间（用于判断是"今天"还是"昨天"）
  const nowUtcTime = nowUtc.getTime();
  // 计算当前东八区时间的时间戳（用于日期判断）
  const gmt8NowTime = nowUtcTime + timezoneOffsetMs;
  const gmt8NowDate = new Date(gmt8NowTime);
  
  // 获取当前东八区的年月日
  const gmt8Year = gmt8NowDate.getUTCFullYear();
  const gmt8Month = gmt8NowDate.getUTCMonth();
  const gmt8Date = gmt8NowDate.getUTCDate();
  
  // 计算今天凌晨4点（东八区）对应的UTC时间
  // 东八区凌晨4点 = UTC前一天20点（4 - 8 = -4，即前一天的20点）
  let gmt8Today4AMUtc = new Date(Date.UTC(gmt8Year, gmt8Month, gmt8Date, 4 - timezoneOffsetHours, 0, 0, 0));
  
  // 如果当前东八区时间还没到凌晨4点，则使用昨天的凌晨4点（东八区）
  // 判断：当前东八区时间是否 >= 今天凌晨4点（东八区）
  // gmt8Today4AMUtc 是今天凌晨4点（东八区）对应的UTC时间
  // 需要将其转换为东八区时间戳来比较
  const gmt8Today4AMTime = gmt8Today4AMUtc.getTime() + timezoneOffsetMs;
  if (gmt8NowTime < gmt8Today4AMTime) {
    // 还没到凌晨4点，使用昨天的凌晨4点
    gmt8Today4AMUtc = new Date(Date.UTC(gmt8Year, gmt8Month, gmt8Date - 1, 4 - timezoneOffsetHours, 0, 0, 0));
  }

  // 如果最后签到时间 >= 今天凌晨4点（东八区对应的UTC时间），说明今天已签到
  return lastAwardDate >= gmt8Today4AMUtc;
}

