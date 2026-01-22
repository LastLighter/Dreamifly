import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { createHash } from 'crypto';

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

// 检查当前用户是否是管理员和优质用户状态（所有登录用户可调用）
export async function GET(request: Request) {
  try {
    // 1. 验证动态 token
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    // 2. 检查用户是否已登录
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { 
          isLoggedIn: false,
          isAdmin: false, 
          isPremium: false, 
          isSubscribed: false, 
          isOldUser: false 
        },
        { status: 200 }
      );
    }

    // 3. 从数据库查询用户的完整权限状态
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0) {
      return NextResponse.json(
        { 
          isLoggedIn: false,
          isAdmin: false, 
          isPremium: false, 
          isSubscribed: false, 
          isOldUser: false 
        },
        { status: 200 }
      );
    }

    // 确保正确处理 isAdmin 字段
    // 检查两种可能的字段名（isAdmin 或 is_admin）
    let adminStatus = false;
    const userData = currentUser[0] as any;
    if (userData.isAdmin !== undefined) {
      adminStatus = Boolean(userData.isAdmin);
    } else if (userData.is_admin !== undefined) {
      adminStatus = Boolean(userData.is_admin);
    }

    // 获取其他用户状态
    const premiumStatus = Boolean(userData.isPremium);
    const subscribedStatus = Boolean(userData.isSubscribed);
    const oldUserStatus = Boolean(userData.isOldUser);

    return NextResponse.json({
      isLoggedIn: true,
      isAdmin: adminStatus,
      isPremium: premiumStatus,
      isSubscribed: subscribedStatus,
      isOldUser: oldUserStatus
    });
  } catch (error) {
    console.error('Error checking user status:', error);
    return NextResponse.json(
      { 
        isLoggedIn: false,
        isAdmin: false, 
        isPremium: false, 
        isSubscribed: false, 
        isOldUser: false 
      },
      { status: 200 }
    );
  }
}

