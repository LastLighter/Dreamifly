import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

// 更新用户最近登录时间
export async function POST() {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 更新用户的 lastLoginAt 字段为当前时间（UTC）并存为无时区
    await db
      .update(user)
      .set({
        lastLoginAt: sql`(now() at time zone 'UTC')`,
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating last login time:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 支持GET请求（用于客户端调用）
export async function GET() {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 更新用户的 lastLoginAt 字段为当前时间（UTC）并存为无时区
    await db
      .update(user)
      .set({
        lastLoginAt: sql`(now() at time zone 'UTC')`,
      })
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating last login time:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

