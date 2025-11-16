import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { avatarFrame } from '@/db/schema';
import { headers } from 'next/headers';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 获取所有分类列表
 * GET /api/admin/avatar-frames/categories?t=timestamp
 */
export async function GET() {
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

    // 获取所有不重复的分类
    const allFrames = await db
      .select({ category: avatarFrame.category })
      .from(avatarFrame);

    // 使用 Set 去重并排序
    const categorySet = new Set(allFrames.map(f => f.category));
    const categoryList = Array.from(categorySet).sort();

    return NextResponse.json({ categories: categoryList });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: '获取分类列表失败' },
      { status: 500 }
    );
  }
}

