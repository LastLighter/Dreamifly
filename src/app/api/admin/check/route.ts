import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

// 检查当前用户是否是管理员
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { isAdmin: false },
        { status: 200 }
      );
    }

    console.log('Session user ID:', session.user.id);
    console.log('Session user email:', session.user.email);

    // 从数据库查询用户的 isAdmin 状态
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0) {
      console.log('User not found in database');
      return NextResponse.json(
        { isAdmin: false },
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

    console.log('Final adminStatus:', adminStatus);

    return NextResponse.json({
      isAdmin: adminStatus
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return NextResponse.json(
      { isAdmin: false },
      { status: 200 }
    );
  }
}

