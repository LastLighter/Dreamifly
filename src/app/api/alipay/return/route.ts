import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { paymentOrder } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 支付宝同步回调接口
 * 用户支付完成后，支付宝会将用户重定向到此页面
 * 注意：同步回调仅用于展示，不能作为支付成功的依据
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const outTradeNo = searchParams.get('out_trade_no');

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    if (!outTradeNo) {
      // 无订单号，重定向到首页
      return NextResponse.redirect(`${baseUrl}/`);
    }

    // 查询订单状态
    const orders = await db
      .select()
      .from(paymentOrder)
      .where(eq(paymentOrder.id, outTradeNo))
      .limit(1);

    if (orders.length === 0) {
      // 订单不存在，重定向到首页
      return NextResponse.redirect(`${baseUrl}/`);
    }

    const order = orders[0];

    // 根据订单状态重定向到不同页面
    if (order.status === 'paid') {
      // 支付成功，重定向到成功页面
      return NextResponse.redirect(
        `${baseUrl}/payment/success?orderId=${outTradeNo}&type=${order.orderType}`
      );
    } else if (order.status === 'pending') {
      // 支付处理中，可能异步通知还未到达
      // 重定向到等待页面或查询页面
      return NextResponse.redirect(
        `${baseUrl}/payment/processing?orderId=${outTradeNo}`
      );
    } else {
      // 其他状态（失败等）
      return NextResponse.redirect(
        `${baseUrl}/payment/failed?orderId=${outTradeNo}`
      );
    }
  } catch (error) {
    console.error('处理支付宝同步回调失败:', error);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${baseUrl}/`);
  }
}









