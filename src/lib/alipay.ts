import { createRequire } from 'module';

// 使用 createRequire 以 CJS 方式加载，避免打包器对 default 的处理差异
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const alipaySdkPkg = require('alipay-sdk');

// alipay-sdk 的导出在 CJS/ESM 场景下形态不同，这里做兼容处理
const AlipaySdkCtor =
  (alipaySdkPkg as any).AlipaySdk ||
  (alipaySdkPkg as any).default ||
  alipaySdkPkg;

// 支付宝SDK实例（单例模式）
let alipaySdkInstance: any = null;

/**
 * 获取支付宝SDK实例
 */
export function getAlipaySdk(): any {
  if (!alipaySdkInstance) {
    const appId = process.env.ALIPAY_APP_ID;
    const privateKey = process.env.ALIPAY_PRIVATE_KEY;
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;

    if (!appId || !privateKey || !alipayPublicKey) {
      throw new Error('支付宝配置缺失，请检查环境变量 ALIPAY_APP_ID, ALIPAY_PRIVATE_KEY, ALIPAY_PUBLIC_KEY');
    }

    alipaySdkInstance = new AlipaySdkCtor({
      appId,
      privateKey,
      alipayPublicKey,
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      signType: 'RSA2',
    });
  }
  return alipaySdkInstance;
}

/**
 * 生成订单号
 * 格式：dreamifly + 年月日时分秒 + 6位随机数
 * 例如：dreamifly20231209143052123456
 */
export function generateOrderNo(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
  
  return `dreamifly${year}${month}${day}${hour}${minute}${second}${random}`;
}

/**
 * 创建支付宝PC网页支付
 */
export async function createAlipayPagePayment(params: {
  outTradeNo: string;
  totalAmount: string;
  subject: string;
  returnUrl?: string;
  notifyUrl?: string;
}): Promise<string> {
  const alipaySdk = getAlipaySdk();
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  const result = await alipaySdk.pageExec('alipay.trade.page.pay', {
    method: 'GET', // 使用GET方法返回支付宝支付URL
    bizContent: {
      out_trade_no: params.outTradeNo,
      total_amount: params.totalAmount,
      subject: params.subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    },
    returnUrl: params.returnUrl || `${baseUrl}/api/alipay/return`,
    notify_url: params.notifyUrl || `${baseUrl}/api/alipay/notify`,
  });

  return result as string;
}

/**
 * 查询支付宝订单状态
 */
export async function queryAlipayOrder(params: {
  outTradeNo?: string;
  tradeNo?: string;
}): Promise<AlipayTradeQueryResponse> {
  const alipaySdk = getAlipaySdk();
  
  const result = await alipaySdk.exec('alipay.trade.query', {
    bizContent: {
      out_trade_no: params.outTradeNo,
      trade_no: params.tradeNo,
    },
  });

  return result as AlipayTradeQueryResponse;
}

/**
 * 验证支付宝异步通知签名
 */
export function verifyAlipayNotify(params: Record<string, string>): boolean {
  const alipaySdk = getAlipaySdk();
  
  try {
    // 使用SDK内置的验签方法
    return alipaySdk.checkNotifySign(params);
  } catch (error) {
    console.error('支付宝验签失败:', error);
    return false;
  }
}

// 支付宝交易查询响应类型
export interface AlipayTradeQueryResponse {
  code: string;
  msg: string;
  sub_code?: string;
  sub_msg?: string;
  trade_no?: string;
  out_trade_no?: string;
  buyer_logon_id?: string;
  trade_status?: 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED';
  total_amount?: string;
  receipt_amount?: string;
  buyer_pay_amount?: string;
  point_amount?: string;
  invoice_amount?: string;
  send_pay_date?: string;
  store_id?: string;
  terminal_id?: string;
  fund_bill_list?: Array<{
    fund_channel: string;
    amount: string;
    real_amount?: string;
  }>;
  store_name?: string;
  buyer_user_id?: string;
  buyer_open_id?: string;
}

// 支付宝异步通知参数类型
export interface AlipayNotifyParams {
  app_id: string;
  auth_app_id?: string;
  buyer_id?: string;
  buyer_logon_id?: string;
  buyer_pay_amount?: string;
  charset: string;
  fund_bill_list?: string;
  gmt_create?: string;
  gmt_payment?: string;
  invoice_amount?: string;
  notify_id: string;
  notify_time: string;
  notify_type: string;
  out_trade_no: string;
  point_amount?: string;
  receipt_amount?: string;
  seller_email?: string;
  seller_id: string;
  sign: string;
  sign_type: string;
  subject: string;
  total_amount: string;
  trade_no: string;
  trade_status: 'WAIT_BUYER_PAY' | 'TRADE_CLOSED' | 'TRADE_SUCCESS' | 'TRADE_FINISHED';
  version: string;
}

