import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, userPoints } from '@/db/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import { headers } from 'next/headers';

// 清理过期积分（管理员权限）
export async function POST() {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    // 删除所有过期的获得积分记录
    const now = new Date();

    // 先统计要删除的记录数
    const beforeCount = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(userPoints)
      .where(
        and(
          eq(userPoints.type, 'earned'),
          lt(userPoints.expiresAt, now)
        )
      );

    const count = Number(beforeCount[0]?.count || 0);

    // 执行删除
    await db
      .delete(userPoints)
      .where(
        and(
          eq(userPoints.type, 'earned'),
          lt(userPoints.expiresAt, now)
        )
      );

    return NextResponse.json({
      success: true,
      message: `已清理 ${count} 条过期积分记录`,
      deletedCount: count,
    });
  } catch (error) {
    console.error('Error cleaning up expired points:', error);
    return NextResponse.json(
      { error: '清理过期积分失败' },
      { status: 500 }
    );
  }
}

// 支持GET请求
export async function GET() {
  return POST();
}

