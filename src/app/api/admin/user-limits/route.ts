import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, userLimitConfig } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

// 获取用户限额配置
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
      .from(userLimitConfig)
      .where(eq(userLimitConfig.id, 1))
      .limit(1);

    if (config.length === 0) {
      // 创建默认配置
      await db.insert(userLimitConfig).values({
        id: 1,
        regularUserDailyLimit: null,
        premiumUserDailyLimit: null,
        newUserDailyLimit: null,
        unauthenticatedIpDailyLimit: null,
      });
      config = await db.select()
        .from(userLimitConfig)
        .where(eq(userLimitConfig.id, 1))
        .limit(1);
    }

    const configData = config[0];
    
    // 获取环境变量默认值（优质300，首批100，新用户50，未登录IP 100）
    const envRegularLimit = parseInt(process.env.REGULAR_USER_DAILY_LIMIT || '100', 10);
    const envPremiumLimit = parseInt(process.env.PREMIUM_USER_DAILY_LIMIT || '300', 10);
    const envNewLimit = parseInt(process.env.NEW_REGULAR_USER_DAILY_LIMIT || '50', 10);
    const envUnauthIpLimit = parseInt(process.env.UNAUTHENTICATED_IP_DAILY_LIMIT || '100', 10);

    return NextResponse.json(
      {
        regularUserDailyLimit: configData.regularUserDailyLimit ?? envRegularLimit,
        premiumUserDailyLimit: configData.premiumUserDailyLimit ?? envPremiumLimit,
        newUserDailyLimit: configData.newUserDailyLimit ?? envNewLimit,
        unauthenticatedIpDailyLimit: configData.unauthenticatedIpDailyLimit ?? envUnauthIpLimit,
        usingEnvRegular: configData.regularUserDailyLimit === null,
        usingEnvPremium: configData.premiumUserDailyLimit === null,
        usingEnvNew: configData.newUserDailyLimit === null,
        usingEnvUnauthIp: configData.unauthenticatedIpDailyLimit === null,
        envRegularLimit,
        envPremiumLimit,
        envNewLimit,
        envUnauthIpLimit,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching user limit config:', error);
    return NextResponse.json(
      { error: '获取用户限额配置失败' },
      { status: 500 }
    );
  }
}

// 更新用户限额配置
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
      regularUserDailyLimit,
      premiumUserDailyLimit,
      newUserDailyLimit,
      unauthenticatedIpDailyLimit,
      useEnvForRegular,
      useEnvForPremium,
      useEnvForNew,
      useEnvForUnauthIp,
    } = body;

    // 验证参数
    if (useEnvForRegular !== true && useEnvForRegular !== false && regularUserDailyLimit !== undefined) {
      if (typeof regularUserDailyLimit !== 'number' || regularUserDailyLimit < 0) {
        return NextResponse.json(
          { error: '普通用户限额必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    if (useEnvForPremium !== true && useEnvForPremium !== false && premiumUserDailyLimit !== undefined) {
      if (typeof premiumUserDailyLimit !== 'number' || premiumUserDailyLimit < 0) {
        return NextResponse.json(
          { error: '优质用户限额必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    if (useEnvForNew !== true && useEnvForNew !== false && newUserDailyLimit !== undefined) {
      if (typeof newUserDailyLimit !== 'number' || newUserDailyLimit < 0) {
        return NextResponse.json(
          { error: '新用户限额必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    if (useEnvForUnauthIp !== true && useEnvForUnauthIp !== false && unauthenticatedIpDailyLimit !== undefined) {
      if (typeof unauthenticatedIpDailyLimit !== 'number' || unauthenticatedIpDailyLimit < 0) {
        return NextResponse.json(
          { error: '未登录用户IP限额必须是大于等于0的数字' },
          { status: 400 }
        );
      }
    }

    // 检查配置是否存在
    const config = await db.select()
      .from(userLimitConfig)
      .where(eq(userLimitConfig.id, 1))
      .limit(1);

    if (config.length === 0) {
      // 创建默认配置
      await db.insert(userLimitConfig).values({
        id: 1,
        regularUserDailyLimit: null,
        premiumUserDailyLimit: null,
        newUserDailyLimit: null,
        unauthenticatedIpDailyLimit: null,
      });
    }

    // 构建更新数据
    const updateData: {
      regularUserDailyLimit?: number | null;
      premiumUserDailyLimit?: number | null;
      newUserDailyLimit?: number | null;
      unauthenticatedIpDailyLimit?: number | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    if (useEnvForRegular === true) {
      updateData.regularUserDailyLimit = null;
    } else if (regularUserDailyLimit !== undefined) {
      updateData.regularUserDailyLimit = regularUserDailyLimit;
    }

    if (useEnvForPremium === true) {
      updateData.premiumUserDailyLimit = null;
    } else if (premiumUserDailyLimit !== undefined) {
      updateData.premiumUserDailyLimit = premiumUserDailyLimit;
    }

    if (useEnvForNew === true) {
      updateData.newUserDailyLimit = null;
    } else if (newUserDailyLimit !== undefined) {
      updateData.newUserDailyLimit = newUserDailyLimit;
    }

    if (useEnvForUnauthIp === true) {
      updateData.unauthenticatedIpDailyLimit = null;
    } else if (unauthenticatedIpDailyLimit !== undefined) {
      updateData.unauthenticatedIpDailyLimit = unauthenticatedIpDailyLimit;
    }

    // 更新配置
    await db
      .update(userLimitConfig)
      .set(updateData)
      .where(eq(userLimitConfig.id, 1));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user limit config:', error);
    return NextResponse.json(
      { error: '更新用户限额配置失败' },
      { status: 500 }
    );
  }
}

