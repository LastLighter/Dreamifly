import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { paymentOrder, userPoints, userSubscription, user, subscriptionPlan } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAlipayNotify, AlipayNotifyParams } from '@/lib/alipay';
import { randomUUID } from 'crypto';

const TEST_PLAN_ID = 999001;

/**
 * 支付宝异步通知接口
 * 支付宝在用户支付成功后会POST请求此接口
 */
export async function POST(request: NextRequest) {
  try {
    // 获取通知参数
    const formData = await request.formData();
    const params: Record<string, string> = {};
    
    formData.forEach((value, key) => {
      params[key] = value.toString();
    });

    console.log('收到支付宝异步通知:', JSON.stringify(params, null, 2));

    // 验证签名
    const isValid = verifyAlipayNotify(params);
    if (!isValid) {
      console.error('支付宝异步通知验签失败');
      return new NextResponse('fail', { status: 200 });
    }

    const notifyParams = params as unknown as AlipayNotifyParams;

    // 验证app_id是否正确
    const expectedAppId = process.env.ALIPAY_APP_ID;
    if (notifyParams.app_id !== expectedAppId) {
      console.error('app_id不匹配:', notifyParams.app_id, '!==', expectedAppId);
      return new NextResponse('fail', { status: 200 });
    }

    // 获取订单信息
    const outTradeNo = notifyParams.out_trade_no;
    const orders = await db
      .select()
      .from(paymentOrder)
      .where(eq(paymentOrder.id, outTradeNo))
      .limit(1);

    if (orders.length === 0) {
      console.error('订单不存在:', outTradeNo);
      return new NextResponse('fail', { status: 200 });
    }

    const order = orders[0];

    // 验证订单金额
    const totalAmount = parseFloat(notifyParams.total_amount);
    if (Math.abs(totalAmount - order.amount) > 0.01) {
      console.error('订单金额不匹配:', totalAmount, '!==', order.amount);
      return new NextResponse('fail', { status: 200 });
    }

    // 根据交易状态处理
    const tradeStatus = notifyParams.trade_status;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 检查订单是否已处理过
      if (order.status === 'paid') {
        console.log('订单已处理:', outTradeNo);
        return new NextResponse('success', { status: 200 });
      }

      // 更新订单状态
      await db
        .update(paymentOrder)
        .set({
          status: 'paid',
          paymentId: notifyParams.trade_no,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(paymentOrder.id, outTradeNo));

      // 处理业务逻辑
      if (order.orderType === 'points') {
        // 积分充值：增加用户积分
        if (order.pointsAmount) {
          // 默认过期时间：365天
          const expiryDays = 365;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + expiryDays);

          await db.insert(userPoints).values({
            id: randomUUID(),
            userId: order.userId,
            points: order.pointsAmount,
            type: 'earned',
            description: `积分充值 - 订单号: ${outTradeNo}`,
            expiresAt,
          });

          console.log(`用户 ${order.userId} 充值 ${order.pointsAmount} 积分成功`);
        }
      } else if (order.orderType === 'subscription') {
        // 订阅：更新用户订阅状态
      const productIdInt = parseInt(order.productId);

      // 获取订阅计划，支持本地测试挡位
      let plan =
        productIdInt === TEST_PLAN_ID && process.env.NODE_ENV !== 'production'
          ? {
              id: TEST_PLAN_ID,
              name: '测试会员（本地）',
              type: 'monthly',
              price: 0.1,
              bonusPoints: 0,
            }
          : null;

      if (!plan) {
        const plans = await db
          .select()
          .from(subscriptionPlan)
          .where(eq(subscriptionPlan.id, productIdInt))
          .limit(1);

        if (plans.length > 0) {
          plan = plans[0];
        }
      }

      if (plan) {
          const now = new Date();
          const expiresAt = new Date();

          // 根据订阅类型计算过期时间
          if (plan.type === 'monthly') {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        } else if (plan.type === 'quarterly') {
            expiresAt.setMonth(expiresAt.getMonth() + 3);
          } else if (plan.type === 'yearly') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          }

          // 检查是否有现有订阅
          const existingSubscriptions = await db
            .select()
            .from(userSubscription)
            .where(eq(userSubscription.userId, order.userId))
            .limit(1);

          if (existingSubscriptions.length > 0) {
            // 更新现有订阅
            const existingSub = existingSubscriptions[0];
            const newExpiresAt = existingSub.status === 'active' && existingSub.expiresAt > now
              ? new Date(existingSub.expiresAt.getTime() + (expiresAt.getTime() - now.getTime()))
              : expiresAt;

            await db
              .update(userSubscription)
              .set({
                planType: plan.type,
                status: 'active',
                expiresAt: newExpiresAt,
                updatedAt: now,
              })
              .where(eq(userSubscription.userId, order.userId));
          } else {
            // 创建新订阅
            await db.insert(userSubscription).values({
              id: randomUUID(),
              userId: order.userId,
              planType: plan.type,
              status: 'active',
              startedAt: now,
              expiresAt,
            });
          }

          // 更新用户表的订阅状态
          await db
            .update(user)
            .set({
              isSubscribed: true,
              subscriptionExpiresAt: expiresAt,
              updatedAt: now,
            })
            .where(eq(user.id, order.userId));

          // 赠送订阅积分
          if (plan.bonusPoints > 0) {
            const pointsExpiresAt = new Date();
            pointsExpiresAt.setDate(pointsExpiresAt.getDate() + 365);

            await db.insert(userPoints).values({
              id: randomUUID(),
              userId: order.userId,
              points: plan.bonusPoints,
              type: 'earned',
              description: `订阅赠送积分 - ${plan.name}`,
              expiresAt: pointsExpiresAt,
            });
          }

          console.log(`用户 ${order.userId} 订阅 ${plan.name} 成功`);
        }
      }

      return new NextResponse('success', { status: 200 });
    } else if (tradeStatus === 'TRADE_CLOSED') {
      // 交易关闭
      await db
        .update(paymentOrder)
        .set({
          status: 'failed',
          updatedAt: new Date(),
        })
        .where(eq(paymentOrder.id, outTradeNo));

      return new NextResponse('success', { status: 200 });
    }

    // 其他状态（如等待付款）暂不处理
    return new NextResponse('success', { status: 200 });
  } catch (error) {
    console.error('处理支付宝异步通知失败:', error);
    return new NextResponse('fail', { status: 200 });
  }
}

