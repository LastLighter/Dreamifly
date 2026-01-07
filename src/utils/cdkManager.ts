import { db } from '@/db';
import { cdk, cdkRedemption, userCdkDailyLimit, user, pointsPackage, subscriptionPlan } from '@/db/schema';
import { eq, and, lt, gte, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { addPoints } from '@/utils/points';

export interface CDKData {
  packageType: 'points_package' | 'subscription_plan';
  packageId: number;
  expiresAt?: Date;
}

export interface RedemptionResult {
  success: boolean;
  message: string;
  data?: {
    packageType: string;
    packageName: string;
    packageData: any;
  };
}

/**
 * 检查用户每日兑换限制并重置计数
 * 使用UTC时区计算日期间隔，按UTC时间凌晨刷新
 */
export async function checkAndResetUserDailyLimit(userId: string): Promise<{ canRedeem: boolean; currentCount: number; maxLimit: number; remainingCount: number }> {
  const { getCDKConfig } = await import('@/utils/cdkGenerator');

  const config = await getCDKConfig();

  // 获取或创建用户每日限制记录
  let userLimit = await db.select()
    .from(userCdkDailyLimit)
    .where(eq(userCdkDailyLimit.userId, userId))
    .limit(1);

  if (userLimit.length === 0) {
    // 创建新记录，使用UTC时间
    await db.insert(userCdkDailyLimit).values({
      id: randomUUID(),
      userId,
      dailyRedemptions: 0,
      lastRedemptionResetDate: sql`(now() at time zone 'UTC')`,
      updatedAt: sql`(now() at time zone 'UTC')`,
    });
    userLimit = await db.select()
      .from(userCdkDailyLimit)
      .where(eq(userCdkDailyLimit.userId, userId))
      .limit(1);
  }

  const limitData = userLimit[0];
  let currentDailyCount = limitData.dailyRedemptions;

  // 使用PostgreSQL的UTC日期比较来检查是否需要重置每日计数
  // 比较UTC日期的年月日部分
  // 注意：last_redemption_reset_date 是 timestamp（无时区），存储的是UTC时间戳
  // 所以直接比较日期部分即可，不需要 AT TIME ZONE 转换
  const resetCheck = await db.select({
    shouldReset: sql<boolean>`
      DATE(${userCdkDailyLimit.lastRedemptionResetDate}) < DATE((now() at time zone 'UTC'))
    `,
  })
    .from(userCdkDailyLimit)
    .where(eq(userCdkDailyLimit.userId, userId))
    .limit(1);

  if (resetCheck.length > 0 && resetCheck[0].shouldReset) {
    // 需要重置计数（UTC新的一天开始了）
    currentDailyCount = 0;
    await db.update(userCdkDailyLimit)
      .set({
        dailyRedemptions: 0,
        lastRedemptionResetDate: sql`(now() at time zone 'UTC')`,
        updatedAt: sql`(now() at time zone 'UTC')`,
      })
      .where(eq(userCdkDailyLimit.userId, userId));
  }

  const maxLimit = config.userDailyLimit;
  const remainingCount = Math.max(0, maxLimit - currentDailyCount);
  const canRedeem = currentDailyCount < maxLimit;

  return {
    canRedeem,
    currentCount: currentDailyCount,
    maxLimit,
    remainingCount
  };
}

/**
 * 创建CDK - 关联到具体的积分包或订阅包
 */
export async function createCDK(data: CDKData, createdBy?: string): Promise<string> {
  const { generateCDK } = await import('@/utils/cdkGenerator');

  // 验证包是否存在且有效
  if (data.packageType === 'points_package') {
    const pkg = await db.select()
      .from(pointsPackage)
      .where(and(
        eq(pointsPackage.id, data.packageId),
        eq(pointsPackage.isActive, true)
      ))
      .limit(1);

    if (pkg.length === 0) {
      throw new Error('积分包不存在或已下架');
    }
  } else if (data.packageType === 'subscription_plan') {
    const plan = await db.select()
      .from(subscriptionPlan)
      .where(and(
        eq(subscriptionPlan.id, data.packageId),
        eq(subscriptionPlan.isActive, true)
      ))
      .limit(1);

    if (plan.length === 0) {
      throw new Error('订阅套餐不存在或已下架');
    }
  } else {
    throw new Error('无效的包类型');
  }

  let code: string;
  let attempts = 0;
  const maxAttempts = 10;

  // 确保生成的CDK不重复
  do {
    code = generateCDK();
    attempts++;

    const existing = await db.select()
      .from(cdk)
      .where(eq(cdk.code, code))
      .limit(1);

    if (existing.length === 0) break;
  } while (attempts < maxAttempts);

  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique CDK');
  }

  const cdkId = randomUUID();

  await db.insert(cdk).values({
    id: cdkId,
    code,
    packageType: data.packageType,
    packageId: data.packageId,
    expiresAt: data.expiresAt ? new Date(data.expiresAt.getTime()) : undefined,
    createdAt: sql`(now() at time zone 'UTC')`,
    updatedAt: sql`(now() at time zone 'UTC')`,
    createdBy,
  });

  return code;
}

/**
 * 兑换CDK - 一个CDK只能兑换一次
 * 注意：只要发了兑换请求，无论成功或失败都算次数（包括格式无效等情况）
 */
export async function redeemCDK(code: string, userId: string, ipAddress?: string): Promise<RedemptionResult> {
  // 先检查每日兑换限制并重置计数
  const dailyLimitCheck = await checkAndResetUserDailyLimit(userId);
  if (!dailyLimitCheck.canRedeem) {
    return {
      success: false,
      message: `今日已兑换${dailyLimitCheck.currentCount}次，明天再来吧（每日最多${dailyLimitCheck.maxLimit}次）`
    };
  }

  // 在请求开始时立即更新每日兑换计数（无论成功失败都算次数，包括格式无效）
  await db.update(userCdkDailyLimit)
    .set({
      dailyRedemptions: sql`${userCdkDailyLimit.dailyRedemptions} + 1`,
      updatedAt: sql`(now() at time zone 'UTC')`,
    })
    .where(eq(userCdkDailyLimit.userId, userId));

  // 验证CDK格式（在增加次数之后验证，确保格式无效也消耗次数）
  const { validateCDKFormat } = await import('@/utils/cdkGenerator');
  if (!validateCDKFormat(code)) {
    return { success: false, message: 'CDK格式无效' };
  }

  // 使用事务进行兑换
  return await db.transaction(async (tx) => {
    // 查找CDK
    const cdkRecord = await tx.select({
      id: cdk.id,
      code: cdk.code,
      packageType: cdk.packageType,
      packageId: cdk.packageId,
      isRedeemed: cdk.isRedeemed,
      expiresAt: cdk.expiresAt,
    })
    .from(cdk)
    .where(eq(cdk.code, code))
    .limit(1);

    if (cdkRecord.length === 0) {
      return { success: false, message: 'CDK不存在或已失效' };
    }

    const cdkData = cdkRecord[0];

    // 检查是否已被兑换
    if (cdkData.isRedeemed) {
      return { success: false, message: '此CDK已被兑换' };
    }

    // 检查是否过期
    const now = new Date();
    if (cdkData.expiresAt && cdkData.expiresAt < now) {
      return { success: false, message: 'CDK已过期' };
    }

    // 获取包信息
    let packageData: any = null;
    let packageName = '';

    if (cdkData.packageType === 'points_package') {
      const pkg = await tx.select()
        .from(pointsPackage)
        .where(and(
          eq(pointsPackage.id, cdkData.packageId),
          eq(pointsPackage.isActive, true)
        ))
        .limit(1);

      if (pkg.length === 0) {
        throw new Error('关联的积分包已下架');
      }
      packageData = pkg[0];
      packageName = packageData.name;
    } else if (cdkData.packageType === 'subscription_plan') {
      const plan = await tx.select()
        .from(subscriptionPlan)
        .where(and(
          eq(subscriptionPlan.id, cdkData.packageId),
          eq(subscriptionPlan.isActive, true)
        ))
        .limit(1);

      if (plan.length === 0) {
        throw new Error('关联的订阅套餐已下架');
      }
      packageData = plan[0];
      packageName = plan[0].name;
    }

    // 执行兑换逻辑
    if (cdkData.packageType === 'points_package') {
      // 兑换积分包 - 检查用户是否存在
      const userRecord = await tx.select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userRecord.length === 0) {
        return { success: false, message: '用户不存在' };
      }

      const pointsAdded = await addPoints(
        userId,
        packageData.points,
        `CDK兑换积分包 - ${packageName}`,
        30 // 30天过期
      );

      if (!pointsAdded) {
        return { success: false, message: '积分添加失败' };
      }
    } else if (cdkData.packageType === 'subscription_plan') {
      // 兑换订阅套餐 - 检查用户是否存在
      const userRecord = await tx.select()
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);

      if (userRecord.length === 0) {
        return { success: false, message: '用户不存在' };
      }

      const currentUser = userRecord[0];

      // 计算订阅时长（根据套餐类型）
      let subscriptionDays = 0;
      if (packageData.type === 'monthly') {
        subscriptionDays = 30;
      } else if (packageData.type === 'quarterly') {
        subscriptionDays = 90;
      } else if (packageData.type === 'yearly') {
        subscriptionDays = 365;
      }

      const currentExpiry = currentUser.subscriptionExpiresAt;
      const newExpiry = currentExpiry && currentExpiry > now
        ? new Date(currentExpiry.getTime() + (subscriptionDays * 24 * 60 * 60 * 1000))
        : new Date(now.getTime() + (subscriptionDays * 24 * 60 * 60 * 1000));

      // 赠送积分
      if (packageData.bonusPoints > 0) {
        await addPoints(
          userId,
          packageData.bonusPoints,
          `订阅赠送积分 - ${packageName}`,
          365
        );
      }

      await tx.update(user)
        .set({
          isSubscribed: true,
          subscriptionExpiresAt: newExpiry,
          updatedAt: now,
        })
        .where(eq(user.id, userId));
    }

    // 记录兑换
    await tx.insert(cdkRedemption).values({
      id: randomUUID(),
      cdkId: cdkData.id,
      userId,
      redeemedAt: sql`(now() at time zone 'UTC')`,
      ipAddress,
      packageType: cdkData.packageType,
      packageName,
      packageData,
    });

    // 更新CDK状态为已兑换
    await tx.update(cdk)
      .set({
        isRedeemed: true,
        updatedAt: sql`(now() at time zone 'UTC')`,
      })
      .where(eq(cdk.id, cdkData.id));

    // 注意：每日兑换计数已在事务外更新，确保无论成功失败都算次数

    return {
      success: true,
      message: '兑换成功',
      data: {
        packageType: cdkData.packageType,
        packageName,
        packageData,
      }
    };
  }).catch((error) => {
    console.error('CDK兑换失败:', error);
    return { success: false, message: error.message || '兑换失败，请稍后重试' };
  });
}

/**
 * 获取CDK列表（管理员）
 */
export async function getCDKList(page = 1, pageSize = 20, filters?: {
  packageType?: string;
  isRedeemed?: boolean;
  code?: string;
}) {
  const whereConditions = [];

  if (filters?.packageType) {
    whereConditions.push(eq(cdk.packageType, filters.packageType));
  }

  if (filters?.isRedeemed !== undefined) {
    whereConditions.push(eq(cdk.isRedeemed, filters.isRedeemed));
  }

  if (filters?.code) {
    whereConditions.push(sql`${cdk.code} ILIKE ${`%${filters.code}%`}`);
  }

  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [cdks, total] = await Promise.all([
    db.select({
      id: cdk.id,
      code: cdk.code,
      packageType: cdk.packageType,
      packageId: cdk.packageId,
      isRedeemed: cdk.isRedeemed,
      expiresAt: cdk.expiresAt,
      createdAt: cdk.createdAt,
      createdBy: cdk.createdBy,
      // 关联包信息
      package: sql`
        CASE
          WHEN ${cdk.packageType} = 'points_package' THEN (
            SELECT json_build_object(
              'id', pp.id,
              'name', pp.name,
              'points', pp.points,
              'price', pp.price
            )
            FROM points_package pp
            WHERE pp.id = ${cdk.packageId} AND pp.is_active = true
          )
          WHEN ${cdk.packageType} = 'subscription_plan' THEN (
            SELECT json_build_object(
              'id', sp.id,
              'name', sp.name,
              'type', sp.type,
              'price', sp.price,
              'bonusPoints', sp.bonus_points
            )
            FROM subscription_plan sp
            WHERE sp.id = ${cdk.packageId} AND sp.is_active = true
          )
        END
      `,
    })
    .from(cdk)
    .where(whereClause)
    .orderBy(sql`${cdk.createdAt} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize),

    db.select({ count: sql<number>`count(*)` })
      .from(cdk)
      .where(whereClause)
  ]);

  return {
    cdks: cdks.map(item => ({
      ...item,
      package: item.package || null,
    })),
    total: total[0].count,
    page,
    pageSize,
    totalPages: Math.ceil(total[0].count / pageSize)
  };
}

/**
 * 获取兑换记录（管理员）
 */
export async function getRedemptionHistory(page = 1, pageSize = 20, filters?: {
  userId?: string;
  cdkId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const whereConditions = [];

  if (filters?.userId) {
    whereConditions.push(sql`${user.email} ILIKE ${`%${filters.userId}%`}`);
  }

  if (filters?.cdkId) {
    whereConditions.push(sql`${cdk.code} ILIKE ${`%${filters.cdkId}%`}`);
  }

  if (filters?.startDate) {
    whereConditions.push(gte(cdkRedemption.redeemedAt, filters.startDate));
  }

  if (filters?.endDate) {
    whereConditions.push(lt(cdkRedemption.redeemedAt, filters.endDate));
  }

  const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

  const [redemptions, total] = await Promise.all([
    db.select({
      id: cdkRedemption.id,
      redeemedAt: cdkRedemption.redeemedAt,
      ipAddress: cdkRedemption.ipAddress,
      packageType: cdkRedemption.packageType,
      packageName: cdkRedemption.packageName,
      packageData: cdkRedemption.packageData,
      cdk: {
        id: cdk.id,
        code: cdk.code,
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    })
    .from(cdkRedemption)
    .innerJoin(cdk, eq(cdkRedemption.cdkId, cdk.id))
    .innerJoin(user, eq(cdkRedemption.userId, user.id))
    .where(whereClause)
    .orderBy(sql`${cdkRedemption.redeemedAt} DESC`)
    .limit(pageSize)
    .offset((page - 1) * pageSize),

    db.select({ count: sql<number>`count(*)` })
      .from(cdkRedemption)
      .innerJoin(cdk, eq(cdkRedemption.cdkId, cdk.id))
      .innerJoin(user, eq(cdkRedemption.userId, user.id))
      .where(whereClause)
  ]);

  return {
    redemptions,
    total: total[0].count,
    page,
    pageSize,
    totalPages: Math.ceil(total[0].count / pageSize)
  };
}

/**
 * 获取可用的积分包列表
 */
export async function getAvailablePointsPackages() {
  return await db.select({
    id: pointsPackage.id,
    name: pointsPackage.name,
    nameTag: pointsPackage.nameTag,
    points: pointsPackage.points,
    price: pointsPackage.price,
    isPopular: pointsPackage.isPopular,
  })
  .from(pointsPackage)
  .where(eq(pointsPackage.isActive, true))
  .orderBy(pointsPackage.sortOrder);
}

/**
 * 获取可用的订阅套餐列表
 */
export async function getAvailableSubscriptionPlans() {
  return await db.select({
    id: subscriptionPlan.id,
    name: subscriptionPlan.name,
    type: subscriptionPlan.type,
    price: subscriptionPlan.price,
    bonusPoints: subscriptionPlan.bonusPoints,
    isPopular: subscriptionPlan.isPopular,
  })
  .from(subscriptionPlan)
  .where(eq(subscriptionPlan.isActive, true))
  .orderBy(subscriptionPlan.sortOrder);
}

/**
 * 更新CDK过期时间
 */
export async function updateCDKExpiry(id: string, expiresAt?: Date) {
  await db.update(cdk)
    .set({
      expiresAt,
      updatedAt: sql`(now() at time zone 'UTC')`,
    })
    .where(eq(cdk.id, id));
}

/**
 * 删除CDK（只有未兑换的才能删除）
 */
export async function deleteCDK(id: string) {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdkManager.ts:569',message:'deleteCDK called',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  // 检查是否已被兑换
  const cdkRecord = await db.select()
    .from(cdk)
    .where(eq(cdk.id, id))
    .limit(1);

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdkManager.ts:575',message:'CDK record fetched',data:{id,found:cdkRecord.length>0,isRedeemed:cdkRecord[0]?.isRedeemed},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion

  if (cdkRecord.length === 0) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdkManager.ts:577',message:'CDK not found error',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    throw new Error('CDK不存在');
  }

  if (cdkRecord[0].isRedeemed) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdkManager.ts:581',message:'CDK already redeemed error',data:{id,isRedeemed:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    throw new Error('已兑换的CDK不能删除');
  }

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdkManager.ts:584',message:'Before database delete',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  await db.delete(cdk)
    .where(eq(cdk.id, id));
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdkManager.ts:586',message:'Database delete completed',data:{id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
}
