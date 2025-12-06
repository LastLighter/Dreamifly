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
const SEND_VERIFICATION_EMAIL_PATH = "/api/auth/send-verification-email";

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

  // 如果是发送验证邮件请求，需要在发送前检查IP注册次数，并在发送后检查错误
  if (request.nextUrl.pathname === SEND_VERIFICATION_EMAIL_PATH) {
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

    // 调用 better-auth 的发送验证邮件处理
    const response = await handler.POST(request);
    
    // 如果响应失败，检查是否是配额限制错误
    if (response.status !== 200 && response.status !== 201) {
      // 429 状态码通常是配额限制错误
      if (response.status === 429) {
        return jsonError(
          '邮件发送失败：已达到每日发送配额限制',
          'daily_quota_exceeded',
          429
        );
      }
      
      try {
        const responseData = await response.clone().json();
        const errorMessage = (responseData?.error?.message || '').toLowerCase();
        const errorCode = responseData?.error?.code || '';
        
        // 检查是否是配额限制错误（通过错误码或错误消息）
        if (errorCode === 'daily_quota_exceeded' ||
            errorMessage.includes('配额') || 
            errorMessage.includes('quota') ||
            errorMessage.includes('daily email sending quota') ||
            errorMessage.includes('已达到每日发送配额')) {
          return jsonError(
            '邮件发送失败：已达到每日发送配额限制',
            'daily_quota_exceeded',
            429
          );
        }
      } catch {
        // 如果解析失败，500 状态码也可能是配额限制错误
        if (response.status === 500) {
          return jsonError(
            '邮件发送失败：已达到每日发送配额限制',
            'daily_quota_exceeded',
            429
          );
        }
      }
    } else {
      // 发送验证邮件成功，记录IP注册次数
      if (clientIP) {
        await recordRegistration(clientIP).catch(err => {
          console.error('Error recording registration for resend verification:', err);
          // 不阻止邮件发送流程，只记录错误
        });
      }
    }
    
    return response;
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
    // 先读取请求体，保存用户输入的昵称和邮箱（请求体只能读取一次）
    let userNickname: string | undefined;
    let userEmail: string | undefined;
    try {
      const bodyText = await request.clone().text();
      const payload = bodyText ? JSON.parse(bodyText) : {};
      userNickname = payload.name; // 用户输入的昵称
      userEmail = payload.email; // 用户输入的邮箱
      userEmail = payload.email; // 用户输入的邮箱
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
      // 如果响应中没有用户ID，使用之前保存的邮箱查询是否已创建用户
      if (userEmail) {
        try {
          const existingUser = await db.execute(sql`
            SELECT id, created_at FROM "user" WHERE email = ${userEmail} ORDER BY created_at DESC LIMIT 1
          `);
          if (existingUser.length > 0) {
            const existingUserId = (existingUser[0] as any).id;
            const existingUserCreatedAt = (existingUser[0] as any).created_at;
            
            // 检查用户是否已经有 UID
            const userWithUid = await db.execute(sql`
              SELECT uid FROM "user" WHERE id = ${existingUserId}
            `);
            const hasUid = userWithUid.length > 0 && userWithUid[0].uid !== null;
            
            // 检查错误消息，判断错误类型
            // better-auth 的错误可能在不同的字段中，需要检查多个可能的位置
            const errorMessage = (
              responseData?.error?.message || 
              responseData?.message || 
              (responseData?.error as any)?.toString() || 
              ''
            ).toLowerCase();
            const errorCode = responseData?.error?.code || responseData?.code || '';
            
            // 优先检查是否是邮件发送失败的错误（包括配额限制）
            // 邮件发送失败的错误消息通常包含：邮件、发送、quota、配额等关键词
            const isEmailSendFailedError = 
              errorMessage.includes('邮件发送失败') ||
              errorMessage.includes('发送邮件失败') ||
              (errorMessage.includes('邮件') && (errorMessage.includes('发送') || errorMessage.includes('失败'))) ||
              (errorMessage.includes('email') && (errorMessage.includes('send') || errorMessage.includes('fail'))) ||
              errorMessage.includes('quota') ||
              errorMessage.includes('配额') ||
              errorMessage.includes('daily email sending quota') ||
              errorMessage.includes('已达到每日发送配额') ||
              errorCode === 'daily_quota_exceeded' ||
              errorCode === 'EMAIL_SEND_FAILED';
            
            // 检查是否是邮箱已存在的错误
            const isEmailExistsError = 
              errorMessage.includes('already exists') ||
              errorMessage.includes('already in use') ||
              errorMessage.includes('duplicate') ||
              errorMessage.includes('unique') ||
              errorMessage.includes('已存在') ||
              errorMessage.includes('已被使用') ||
              errorMessage.includes('重复') ||
              errorCode === 'EMAIL_ALREADY_EXISTS' ||
              errorCode === 'DUPLICATE_EMAIL';
            
            // 检查用户是否是刚刚创建的（5分钟内），用于判断是否是本次注册创建的用户
            const now = new Date();
            const userCreatedAt = existingUserCreatedAt ? new Date(existingUserCreatedAt) : null;
            const minutesSinceCreation = userCreatedAt 
              ? (now.getTime() - userCreatedAt.getTime()) / (1000 * 60)
              : Infinity;
            const isRecentlyCreated = minutesSinceCreation <= 5;
            
            // 核心逻辑：如果用户没有 UID，无论错误消息是什么，都应该分配 UID
            // 因为如果用户是旧用户，应该已经有 UID 了；如果没有 UID，说明是新用户
            if (!hasUid) {
              // 用户没有 UID，说明是新创建的用户，需要分配 UID
              userId = existingUserId;
              // 判断是否是邮件发送失败
              if (isEmailSendFailedError || (response.status === 500 && !isEmailExistsError)) {
                emailSendFailed = true;
              } else {
                emailSendFailed = false;
              }
            } else {
              // 用户已经有 UID，说明是旧用户，根据错误消息判断
              if (isEmailSendFailedError) {
                // 明确是邮件发送失败的错误（可能是重新发送验证邮件的情况）
                userId = existingUserId;
                emailSendFailed = true;
              } else if (isEmailExistsError) {
                // 明确是邮箱已存在的错误，且用户是旧用户，直接返回原始错误
                userId = null;
                emailSendFailed = false;
              } else if (response.status === 500 && !isEmailExistsError) {
                // 响应状态是 500（服务器错误），且没有明确的"邮箱已存在"错误
                userId = existingUserId;
                emailSendFailed = true;
              } else {
                // 其他情况，无法确定，返回原始错误
                userId = null;
                emailSendFailed = false;
              }
            }
          }
        } catch (error) {
          console.error('Error checking existing user:', error);
        }
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

