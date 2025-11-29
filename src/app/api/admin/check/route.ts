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
        { isAdmin: false, isPremium: false },
        { status: 200 }
      );
    }

    console.log('Session user ID:', session.user.id);
    console.log('Session user email:', session.user.email);

    // 3. 从数据库查询用户的 isAdmin 和 isPremium 状态
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0) {
      console.log('User not found in database');
      return NextResponse.json(
        { isAdmin: false, isPremium: false },
        { status: 200 }
      );
    }

    // 调试：输出查询到的用户数据
    console.log('Current user data:', JSON.stringify(currentUser[0], null, 2));
    console.log('isAdmin value:', currentUser[0].isAdmin);
    console.log('isAdmin type:', typeof currentUser[0].isAdmin);
    console.log('Raw user object keys:', Object.keys(currentUser[0]));

    // 确保正确处理 isAdmin 字段
    // 检查两种可能的字段名（isAdmin 或 is_admin）
    let adminStatus = false;
    const userData = currentUser[0] as any;
    if (userData.isAdmin !== undefined) {
      adminStatus = Boolean(userData.isAdmin);
    } else if (userData.is_admin !== undefined) {
      adminStatus = Boolean(userData.is_admin);
    }

    // 获取 isPremium 状态
    const premiumStatus = Boolean(userData.isPremium);

    // 4. 返回用户状态（允许所有登录用户查询自己的状态）
    console.log('Final adminStatus:', adminStatus);
    console.log('Final premiumStatus:', premiumStatus);

    return NextResponse.json({
      isAdmin: adminStatus,
      isPremium: premiumStatus
    });
  } catch (error) {
    console.error('Error checking user status:', error);
    return NextResponse.json(
      { isAdmin: false, isPremium: false },
      { status: 200 }
    );
  }
}

