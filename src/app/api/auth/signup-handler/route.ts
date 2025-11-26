import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
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

// 为新用户设置 UID 和昵称
export async function POST(request: NextRequest) {
  try {
    // 验证动态token
    const authHeader = request.headers.get('Authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 })
    }
    
    const providedToken = authHeader.substring(7) // 移除 "Bearer " 前缀
    
    // 验证动态token（支持±1分钟时间窗口）
    if (!validateDynamicToken(providedToken)) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 获取下一个 UID
    const nextUid = await getNextUid();

    // 更新用户的 UID 和昵称
    await db.execute(sql`
      UPDATE "user" 
      SET uid = ${nextUid}, 
          nickname = ${'Dreamer-' + nextUid}
      WHERE id = ${userId}
    `);

    return NextResponse.json({ 
      success: true, 
      uid: nextUid,
      nickname: `Dreamer-${nextUid}`
    });
  } catch (error) {
    console.error('Error in signup handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

