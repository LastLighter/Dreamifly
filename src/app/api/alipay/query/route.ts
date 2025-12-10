import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { paymentOrder } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { queryAlipayOrder } from '@/lib/alipay';

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
        { status: 400 }
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
        { status: 404 }
      );
    }

    const order = orders[0];

    // 如果订单已支付或已失败，直接返回本地状态
    if (order.status === 'paid' || order.status === 'failed' || order.status === 'refunded') {
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
        // 查询成功
        const tradeStatus = alipayResult.trade_status;

        if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
          // 支付成功，但本地还是pending（可能异步通知延迟）
          // 这里只返回状态，不更新数据库，让异步通知处理
          return NextResponse.json({
            success: true,
            order: {
              id: order.id,
              status: 'processing', // 告诉前端正在处理中
              orderType: order.orderType,
              amount: order.amount,
              pointsAmount: order.pointsAmount,
              alipayStatus: tradeStatus,
            },
          });
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



