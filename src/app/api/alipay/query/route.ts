import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { paymentOrder } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { queryAlipayOrder } from '@/lib/alipay';
import { processOrderPaid } from '@/lib/payment';

/**
 * 查询订单支付状态
 * 用于前端轮询检查支付状态
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId parameter' },
        { status: 400 },
      );
    }

    // 查询本地订单记录
    const orders = await db
      .select()
      .from(paymentOrder)
      .where(
        and(
          eq(paymentOrder.id, orderId),
          eq(paymentOrder.userId, session.user.id)
        )
      )
      .limit(1);

    if (orders.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      );
    }

    const order = orders[0];

    // 如果订单已支付或已失败，直接返回本地状态
    if (
      order.status === 'paid' ||
      order.status === 'failed' ||
      order.status === 'refunded'
    ) {
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          orderType: order.orderType,
          amount: order.amount,
          pointsAmount: order.pointsAmount,
          paidAt: order.paidAt,
        },
      });
    }

    // 订单仍为pending状态，查询支付宝获取最新状态
    try {
      const alipayResult = await queryAlipayOrder({
        outTradeNo: orderId,
      });

      if (alipayResult.code === '10000') {
        // 查询成功（兼容 SDK 返回的两种大小写字段）
        const tradeStatus =
          alipayResult.trade_status ||
          (alipayResult as any).tradeStatus ||
          undefined;
        const tradeNo =
          alipayResult.trade_no || (alipayResult as any).tradeNo || undefined;
        const totalAmountStr =
          alipayResult.total_amount ||
          (alipayResult as any).totalAmount ||
          undefined;

        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
          try {
            const paidResult = await processOrderPaid(order, {
              tradeNo,
              totalAmount: totalAmountStr ? parseFloat(totalAmountStr) : undefined,
            });

            return NextResponse.json({
              success: true,
              order: {
                id: order.id,
                status: 'paid',
                orderType: order.orderType,
                amount: order.amount,
                pointsAmount: order.pointsAmount,
                paidAt: paidResult.paidAt,
                alipayStatus: tradeStatus,
              },
            });
          } catch (err) {
            console.error('支付宝返回成功，但处理订单失败:', err);
            // 返回processing让前端继续轮询，等待后续处理
            return NextResponse.json({
              success: true,
              order: {
                id: order.id,
                status: 'processing',
                orderType: order.orderType,
                amount: order.amount,
                pointsAmount: order.pointsAmount,
                alipayStatus: tradeStatus,
              },
            });
          }
        } else if (tradeStatus === 'TRADE_CLOSED') {
          // 交易关闭
          await db
            .update(paymentOrder)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(paymentOrder.id, orderId));

          return NextResponse.json({
            success: true,
            order: {
              id: order.id,
              status: 'failed',
              orderType: order.orderType,
              amount: order.amount,
              pointsAmount: order.pointsAmount,
            },
          });
        }
      }

      // 其他情况返回当前本地状态
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          orderType: order.orderType,
          amount: order.amount,
          pointsAmount: order.pointsAmount,
        },
      });
    } catch (alipayError) {
      console.error('查询支付宝订单失败:', alipayError);
      // 查询支付宝失败，返回本地状态
      return NextResponse.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          orderType: order.orderType,
          amount: order.amount,
          pointsAmount: order.pointsAmount,
        },
      });
    }
  } catch (error) {
    console.error('查询订单失败:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}



