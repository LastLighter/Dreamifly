import { auth } from "@/lib/auth";
import { isEmailDomainAllowed } from "@/utils/email-domain-validator";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from 'crypto';

const handler = toNextJsHandler(auth);
const SIGNUP_EMAIL_PATH = "/api/auth/sign-up/email";

/**
 * 验证动态API token
 * 支持±1分钟时间窗口，处理时间边界问题
 * @param providedToken 客户端提供的token
 * @returns 验证是否通过
 */
function validateDynamicToken(providedToken: string): boolean {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY
  if (!apiKey) {
    return false
  }

  // 获取服务器当前时间
  const now = new Date()
  
  // 计算当前分钟和上一分钟的token
  const timeSlots = [
    now, // 当前分钟
    new Date(now.getTime() - 60 * 1000), // 上一分钟
  ]

  for (const timeSlot of timeSlots) {
    const year = timeSlot.getFullYear()
    const month = String(timeSlot.getMonth() + 1).padStart(2, '0')
    const day = String(timeSlot.getDate()).padStart(2, '0')
    const hour = String(timeSlot.getHours()).padStart(2, '0')
    const minute = String(timeSlot.getMinutes()).padStart(2, '0')
    
    const salt = `${year}${month}${day}${hour}${minute}`
    
    // 生成MD5哈希: MD5(密钥 + 盐值)
    const expectedToken = createHash('md5')
      .update(apiKey + salt)
      .digest('hex')
    
    // 如果匹配任一有效token，验证通过
    if (providedToken === expectedToken) {
      return true
    }
  }

  return false
}

function jsonError(message: string, code?: string, status = 400) {
  // better-auth 客户端期望的错误格式是 { error: { message: string, code?: string } }
  return new NextResponse(JSON.stringify({ error: { message, ...(code && { code }) } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function ensureAllowedEmailDomain(request: NextRequest) {
  if (
    request.method !== "POST" ||
    request.nextUrl.pathname !== SIGNUP_EMAIL_PATH
  ) {
    return null;
  }

  let payload: { email?: string } = {};

  try {
    const bodyText = await request.clone().text();
    payload = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    return jsonError("请求体无效，无法读取邮箱信息");
  }

  if (!payload.email) {
    return jsonError("邮箱地址不能为空");
  }

  const isAllowed = await isEmailDomainAllowed(payload.email);

  if (!isAllowed) {
    // 返回固定的错误标识，前端会根据错误码显示对应的翻译
    return jsonError("EMAIL_DOMAIN_NOT_ALLOWED", "EMAIL_DOMAIN_NOT_ALLOWED");
  }

  return null;
}

export const GET = async (request: NextRequest) => {
  return handler.GET(request);
};

export const POST = async (request: NextRequest) => {
  // 对于注册请求，验证动态token
  if (request.nextUrl.pathname === SIGNUP_EMAIL_PATH) {
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonError('Missing or invalid Authorization header', 'UNAUTHORIZED', 401)
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return jsonError('Invalid API key', 'INVALID_TOKEN', 401)
    }
  }

  const validationResponse = await ensureAllowedEmailDomain(request);
  if (validationResponse) {
    return validationResponse;
  }

  return handler.POST(request);
};

