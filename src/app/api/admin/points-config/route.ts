import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, pointsConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

// 获取积分配置
export async function GET() {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    // 获取配置（如果不存在则创建默认配置）
    let config = await db.select()
      .from(pointsConfig)
      .where(eq(pointsConfig.id, 1))
      .limit(1);

    if (config.length === 0) {
      // 创建默认配置
      await db.insert(pointsConfig).values({
        id: 1,
        regularUserDailyPoints: null,
        premiumUserDailyPoints: null,
        pointsExpiryDays: null,
        repairWorkflowCost: null,
      });
      config = await db.select()
        .from(pointsConfig)
        .where(eq(pointsConfig.id, 1))
        .limit(1);
    }

    const configData = config[0];
    
    // 获取环境变量默认值
    const envRegularPoints = parseInt(process.env.REGULAR_USER_DAILY_POINTS || '30', 10);
    const envPremiumPoints = parseInt(process.env.PREMIUM_USER_DAILY_POINTS || '60', 10);
    const envExpiryDays = parseInt(process.env.POINTS_EXPIRY_DAYS || '7', 10);
    const envRepairCost = parseInt(process.env.REPAIR_WORKFLOW_COST || '3', 10);

    return NextResponse.json({
      regularUserDailyPoints: configData.regularUserDailyPoints ?? envRegularPoints,
      premiumUserDailyPoints: configData.premiumUserDailyPoints ?? envPremiumPoints,
      pointsExpiryDays: configData.pointsExpiryDays ?? envExpiryDays,
      repairWorkflowCost: configData.repairWorkflowCost ?? envRepairCost,
      usingEnvRegular: configData.regularUserDailyPoints === null,
      usingEnvPremium: configData.premiumUserDailyPoints === null,
      usingEnvExpiry: configData.pointsExpiryDays === null,
      usingEnvRepair: configData.repairWorkflowCost === null,
      envRegularPoints,
      envPremiumPoints,
      envExpiryDays,
      envRepairCost,
    });
  } catch (error) {
    console.error('Error fetching points config:', error);
    return NextResponse.json(
      { error: '获取积分配置失败' },
      { status: 500 }
    );
  }
}

// 更新积分配置
export async function PATCH(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { 
      regularUserDailyPoints, 
      premiumUserDailyPoints, 
      pointsExpiryDays,
      repairWorkflowCost,
      useEnvForRegular, 
      useEnvForPremium,
      useEnvForExpiry,
      useEnvForRepair
    } = body;

    // 验证参数
    if (useEnvForRegular !== true && useEnvForRegular !== false && regularUserDailyPoints !== undefined) {
      if (typeof regularUserDailyPoints !== 'number' || regularUserDailyPoints < 0) {
        return NextResponse.json(
          { error: '普通用户每日积分必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    if (useEnvForPremium !== true && useEnvForPremium !== false && premiumUserDailyPoints !== undefined) {
      if (typeof premiumUserDailyPoints !== 'number' || premiumUserDailyPoints < 0) {
        return NextResponse.json(
          { error: '优质用户每日积分必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    if (useEnvForExpiry !== true && useEnvForExpiry !== false && pointsExpiryDays !== undefined) {
      if (typeof pointsExpiryDays !== 'number' || pointsExpiryDays < 1) {
        return NextResponse.json(
          { error: '积分过期天数必须是大于等于1的数字' },
          { status: 400 }
        );
      }
    }

    if (useEnvForRepair !== true && useEnvForRepair !== false && repairWorkflowCost !== undefined) {
      if (typeof repairWorkflowCost !== 'number' || repairWorkflowCost < 0) {
        return NextResponse.json(
          { error: '工作流修复消耗积分必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    // 检查配置是否存在
    const config = await db.select()
      .from(pointsConfig)
      .where(eq(pointsConfig.id, 1))
      .limit(1);

    if (config.length === 0) {
      // 创建默认配置
      await db.insert(pointsConfig).values({
        id: 1,
        regularUserDailyPoints: null,
        premiumUserDailyPoints: null,
        pointsExpiryDays: null,
        repairWorkflowCost: null,
      });
    }

    // 构建更新数据
    const updateData: {
      regularUserDailyPoints?: number | null;
      premiumUserDailyPoints?: number | null;
      pointsExpiryDays?: number | null;
      repairWorkflowCost?: number | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (useEnvForRegular === true) {
      updateData.regularUserDailyPoints = null;
    } else if (regularUserDailyPoints !== undefined) {
      updateData.regularUserDailyPoints = regularUserDailyPoints;
    }

    if (useEnvForPremium === true) {
      updateData.premiumUserDailyPoints = null;
    } else if (premiumUserDailyPoints !== undefined) {
      updateData.premiumUserDailyPoints = premiumUserDailyPoints;
    }

    if (useEnvForExpiry === true) {
      updateData.pointsExpiryDays = null;
    } else if (pointsExpiryDays !== undefined) {
      updateData.pointsExpiryDays = pointsExpiryDays;
    }

    if (useEnvForRepair === true) {
      updateData.repairWorkflowCost = null;
    } else if (repairWorkflowCost !== undefined) {
      updateData.repairWorkflowCost = repairWorkflowCost;
    }

    // 更新配置
    await db
      .update(pointsConfig)
      .set(updateData)
      .where(eq(pointsConfig.id, 1));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating points config:', error);
    return NextResponse.json(
      { error: '更新积分配置失败' },
      { status: 500 }
    );
  }
}

