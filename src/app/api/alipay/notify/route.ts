import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { paymentOrder } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAlipayNotify, AlipayNotifyParams } from '@/lib/alipay';
import { processOrderPaid } from '@/lib/payment';

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

    // 根据交易状态处理
    const tradeStatus = notifyParams.trade_status;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      try {
        await processOrderPaid(order, {
          tradeNo: notifyParams.trade_no,
          totalAmount: parseFloat(notifyParams.total_amount),
        });
        return new NextResponse('success', { status: 200 });
      } catch (err) {
        console.error('处理支付成功通知失败:', err);
        return new NextResponse('fail', { status: 200 });
      }
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

