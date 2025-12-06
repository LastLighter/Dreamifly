import { auth } from "@/lib/auth";
import { isEmailDomainAllowed } from "@/utils/email-domain-validator";
import { toNextJsHandler } from "better-auth/next-js";
import { NextRequest, NextResponse } from "next/server";
import { createHash } from 'crypto';
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { canRegister, recordRegistration } from "@/utils/ipRegistrationLimitManager";

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

// 获取客户端IP地址
function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip') // Cloudflare
  
  let ip: string | null = null
  
  if (forwarded) {
    // x-forwarded-for 可能包含多个IP，取第一个
    ip = forwarded.split(',')[0].trim()
  } else if (realIP) {
    ip = realIP.trim()
  } else if (cfConnectingIP) {
    ip = cfConnectingIP.trim()
  }
  
  // 处理本地回环地址：将 IPv6 的 ::1 转换为 IPv4 的 127.0.0.1，便于统一显示
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    ip = '127.0.0.1'
  }
  
  // 处理IPv4映射的IPv6格式（::ffff:192.168.1.1 -> 192.168.1.1）
  if (ip && ip.startsWith('::ffff:')) {
    ip = ip.substring(7) // 移除 '::ffff:' 前缀
  }
  
  return ip
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
    // 获取客户端IP并检查注册限制
    const clientIP = getClientIP(request);
    
    if (clientIP) {
      // 检查IP注册限制
      const registrationCheck = await canRegister(clientIP);
      
      if (!registrationCheck.canRegister) {
        return jsonError(
          registrationCheck.message || `24小时内最多只能注册${registrationCheck.maxRegistrations}次`,
          'IP_REGISTRATION_LIMIT_EXCEEDED',
          429
        );
      }
    }
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
    
    // 尝试解析响应数据（无论状态码如何）
    let responseData = null;
    let emailSendFailed = false;
    try {
      responseData = await response.clone().json();
    } catch {
      // 如果解析失败，继续处理
    }
    
    // 检查是否有用户ID（用户可能已被创建，即使邮件发送失败）
    let userId: string | null = null;
    if (responseData?.user?.id) {
      userId = responseData.user.id;
      // 如果响应中有用户ID但状态码不是成功，可能是邮件发送失败
      if (response.status !== 200 && response.status !== 201) {
        emailSendFailed = true;
      }
    } else {
      // 如果响应中没有用户ID，尝试从请求体中获取邮箱，查询是否已创建用户
      try {
        const bodyText = await request.clone().text();
        const payload = bodyText ? JSON.parse(bodyText) : {};
        if (payload.email) {
          const existingUser = await db.execute(sql`
            SELECT id FROM "user" WHERE email = ${payload.email} ORDER BY created_at DESC LIMIT 1
          `);
          if (existingUser.length > 0) {
            userId = (existingUser[0] as any).id;
            emailSendFailed = true; // 用户已创建但响应是错误，可能是邮件发送失败
          }
        }
      } catch (error) {
        console.error('Error checking existing user:', error);
      }
    }
    
    // 如果用户已创建（无论响应状态码如何），设置 UID 和昵称
    if (userId) {
      // 记录IP注册（用户创建成功即记录，无论邮件是否发送成功）
      if (clientIP) {
        await recordRegistration(clientIP).catch(err => {
          console.error('Error recording registration:', err);
          // 不阻止注册流程，只记录错误
        });
      }

      try {
        // 检查用户是否已经有 UID（避免重复分配）
        const existingUser = await db.execute(sql`
          SELECT uid, nickname FROM "user" WHERE id = ${userId}
        `);
        
        if (existingUser.length > 0 && !existingUser[0].uid) {
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
          
          // 更新响应数据
          if (responseData) {
            responseData.user = responseData.user || {};
            responseData.user.id = userId;
            responseData.user.uid = nextUid;
            responseData.user.nickname = nickname;
          } else {
            responseData = { user: { id: userId, uid: nextUid, nickname } };
          }
        }
      } catch (error) {
        console.error('Error setting UID and nickname:', error);
      }
    }
    
    // 如果邮件发送失败但用户已创建，返回明确的错误信息
    if (emailSendFailed && userId && (response.status !== 200 && response.status !== 201)) {
      return jsonError(
        'EMAIL_SEND_FAILED',
        'EMAIL_SEND_FAILED',
        response.status || 500
      );
    }
    
    // 如果注册成功（200/201），返回更新后的响应
    if (response.status === 200 || response.status === 201) {
      if (responseData) {
        return NextResponse.json(responseData, {
          status: response.status,
          headers: response.headers,
        });
      }
    }
    
    return response;
  }

  return handler.POST(request);
};

