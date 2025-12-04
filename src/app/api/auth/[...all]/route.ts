import { auth } from "@/lib/auth";
import { isEmailDomainAllowed } from "@/utils/email-domain-validator";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from 'crypto';
import { db } from "@/db";
import { sql } from "drizzle-orm";

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

// 获取下一个可用的 UID
async function getNextUid(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM "user"
    `);
    return (result[0] as any).next_uid;
  } catch (error) {
    console.error('Error getting next UID:', error);
    return 1; // 如果出错，从 1 开始
  }
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

  // 如果是注册请求，需要在注册成功后设置 UID 和昵称
  if (request.nextUrl.pathname === SIGNUP_EMAIL_PATH) {
    // 先读取请求体，保存用户输入的昵称
    let userNickname: string | undefined;
    try {
      const bodyText = await request.clone().text();
      const payload = bodyText ? JSON.parse(bodyText) : {};
      userNickname = payload.name; // 用户输入的昵称
    } catch {
      // 如果解析失败，继续处理，使用默认值
    }

    // 调用 better-auth 的注册处理
    const response = await handler.POST(request);
    
    // 如果注册成功，设置 UID 和昵称
    if (response.status === 200 || response.status === 201) {
      try {
        const responseData = await response.clone().json();
        
        // 检查是否有用户ID（注册成功）
        if (responseData?.user?.id) {
          const userId = responseData.user.id;
          
          // 获取下一个 UID
          const nextUid = await getNextUid();
          
          // 使用用户输入的昵称，如果没有则使用默认格式
          const nickname = userNickname || `Dreamer-${nextUid}`;
          
          // 更新用户的 UID 和昵称
          await db.execute(sql`
            UPDATE "user" 
            SET uid = ${nextUid}, 
                nickname = ${nickname}
            WHERE id = ${userId}
          `);
          
          // 更新响应数据，包含新设置的 UID 和昵称
          responseData.user.uid = nextUid;
          responseData.user.nickname = nickname;
          
          return NextResponse.json(responseData, {
            status: response.status,
            headers: response.headers,
          });
        }
      } catch (error) {
        console.error('Error setting UID and nickname:', error);
        // 即使设置 UID 失败，也返回原始响应，避免影响注册流程
      }
    }
    
    return response;
  }

  return handler.POST(request);
};

