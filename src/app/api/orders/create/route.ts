import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { paymentOrder, pointsPackage, subscriptionPlan } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateOrderNo, createAlipayPagePayment } from '@/lib/alipay';

const TEST_PLAN_ID = 999001;

// 创建订单并调用支付宝支付
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { orderType, productId, paymentMethod } = body;

    if (!orderType || !productId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 目前仅支持支付宝支付
    if (paymentMethod && paymentMethod !== 'alipay') {
      return NextResponse.json(
        { error: 'Unsupported payment method, only alipay is supported' },
        { status: 400 }
      );
    }

    let amount: number;
    let pointsAmount: number | null = null;
    let productName: string;

    if (orderType === 'points') {
      // 获取积分套餐信息
      const packages = await db
        .select()
        .from(pointsPackage)
        .where(eq(pointsPackage.id, parseInt(productId)))
        .limit(1);

      if (packages.length === 0) {
        return NextResponse.json(
          { error: 'Package not found' },
          { status: 404 }
        );
      }

      const pkg = packages[0];
      amount = pkg.price;
      pointsAmount = pkg.points;
      productName = `Dreamifly积分充值 - ${pkg.name}`;
    } else if (orderType === 'subscription') {
      // 获取订阅套餐信息
      const productIdInt = parseInt(productId);
      if (!Number.isFinite(productIdInt)) {
        return NextResponse.json(
          { error: 'Invalid productId' },
          { status: 400 }
        );
      }

      if (productIdInt === TEST_PLAN_ID && process.env.NODE_ENV !== 'production') {
        // 本地测试计划（0.1元）
        amount = 0.1;
        pointsAmount = 3000; // 与正式月度会员一致的权益积分
        productName = `Dreamifly测试会员 - 本地`;
      } else {
        const plans = await db
          .select()
          .from(subscriptionPlan)
          .where(eq(subscriptionPlan.id, productIdInt))
          .limit(1);

        if (plans.length === 0) {
          return NextResponse.json(
            { error: 'Plan not found' },
            { status: 404 }
          );
        }

        const plan = plans[0];
        amount = plan.price;
        pointsAmount = plan.bonusPoints;
        productName = `Dreamifly会员订阅 - ${plan.name}`;
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid order type' },
        { status: 400 }
      );
    }

    // 生成以dreamifly开头的订单号
    const orderId = generateOrderNo();

    // 创建订单记录
    await db.insert(paymentOrder).values({
      id: orderId,
      userId: session.user.id,
      orderType,
      productId: productId.toString(),
      amount,
      pointsAmount,
      status: 'pending',
      paymentMethod: 'alipay',
    });

    // 调用支付宝创建支付链接
    try {
      const paymentUrl = await createAlipayPagePayment({
        outTradeNo: orderId,
        totalAmount: amount.toFixed(2),
        subject: productName,
      });

      return NextResponse.json({
        success: true,
        orderId,
        amount,
        pointsAmount,
        paymentUrl,
        paymentMethod: 'alipay',
      });
    } catch (alipayError) {
      console.error('创建支付宝支付失败:', alipayError);
      
      // 更新订单状态为失败
      await db
        .update(paymentOrder)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(paymentOrder.id, orderId));

      return NextResponse.json(
        { error: 'Failed to create Alipay payment' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
