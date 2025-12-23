import { randomUUID } from 'crypto';
import { db } from '@/db';
import {
  paymentOrder,
  subscriptionPlan,
  user,
  userPoints,
  userSubscription,
} from '@/db/schema';
import { eq } from 'drizzle-orm';

export const TEST_PLAN_ID = 999001;

type PaymentOrderRecord = typeof paymentOrder.$inferSelect;

type ProcessOptions = {
  tradeNo?: string;
  totalAmount?: number | null;
};

type ProcessResult = {
  status: 'processed' | 'already_paid';
  paidAt: Date;
};

/**
 * 将订单标记为已支付，并执行对应的业务发放（订阅 / 积分）。
 * 用于支付宝异步通知和主动查询的兜底处理，幂等。
 */
export async function processOrderPaid(
  order: PaymentOrderRecord,
  options: ProcessOptions,
): Promise<ProcessResult> {
  const amountFromGateway =
    typeof options.totalAmount === 'number' && Number.isFinite(options.totalAmount)
      ? options.totalAmount
      : null;

  if (amountFromGateway !== null && Math.abs(amountFromGateway - order.amount) > 0.01) {
    throw new Error(
      `订单金额不匹配：gateway=${amountFromGateway}, local=${order.amount}`,
    );
  }

  if (order.status === 'paid') {
    return { status: 'already_paid', paidAt: order.paidAt ?? new Date() };
  }

  const now = new Date();

  await db
    .update(paymentOrder)
    .set({
      status: 'paid',
      paymentId: options.tradeNo ?? order.paymentId ?? null,
      paidAt: now,
      updatedAt: now,
    })
    .where(eq(paymentOrder.id, order.id));

  if (order.orderType === 'points') {
    if (order.pointsAmount) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 365);

      await db.insert(userPoints).values({
        id: randomUUID(),
        userId: order.userId,
        points: order.pointsAmount,
        type: 'earned',
        description: `积分充值 - 订单号: ${order.id}`,
        expiresAt,
      });
    }
  } else if (order.orderType === 'subscription') {
    const productIdInt = parseInt(order.productId, 10);

    type SubscriptionPlanLite = {
      id: number;
      name: string;
      type: string;
      price: number;
      bonusPoints: number;
    };

    let plan: SubscriptionPlanLite | null = null;

    if (productIdInt === TEST_PLAN_ID && process.env.NODE_ENV !== 'production') {
      plan = {
        id: TEST_PLAN_ID,
        name: '测试会员（本地）',
        type: 'monthly',
        price: 0.1,
        bonusPoints: 3000, // 与正式月度会员一致的赠送积分
      };
    } else if (Number.isInteger(productIdInt)) {
      const plans = await db
        .select({
          id: subscriptionPlan.id,
          name: subscriptionPlan.name,
          type: subscriptionPlan.type,
          price: subscriptionPlan.price,
          bonusPoints: subscriptionPlan.bonusPoints,
        })
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.id, productIdInt))
        .limit(1);

      if (plans.length > 0) {
        plan = plans[0];
      }
    }

    if (plan) {
      const expiresAt = new Date();

      if (plan.type === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (plan.type === 'quarterly') {
        expiresAt.setMonth(expiresAt.getMonth() + 3);
      } else if (plan.type === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      const existingSubscriptions = await db
        .select()
        .from(userSubscription)
        .where(eq(userSubscription.userId, order.userId))
        .limit(1);

      if (existingSubscriptions.length > 0) {
        const existingSub = existingSubscriptions[0];
        const nowTs = Date.now();
        const base =
          existingSub.status === 'active' && existingSub.expiresAt && existingSub.expiresAt.getTime() > nowTs
            ? existingSub.expiresAt
            : new Date();

        const newExpiresAt = new Date(
          base.getTime() + (expiresAt.getTime() - now.getTime()),
        );

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
        await db.insert(userSubscription).values({
          id: randomUUID(),
          userId: order.userId,
          planType: plan.type,
          status: 'active',
          startedAt: now,
          expiresAt,
        });
      }

      await db
        .update(user)
        .set({
          isSubscribed: true,
          subscriptionExpiresAt: expiresAt,
          updatedAt: now,
        })
        .where(eq(user.id, order.userId));

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
    } else {
      console.warn(`未找到订阅计划，订单 ${order.id} 无法发放订阅权益`);
    }
  }

  return { status: 'processed', paidAt: now };
}


