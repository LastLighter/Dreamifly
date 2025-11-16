import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { avatarFrame } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { user } from '@/db/schema';

/**
 * 获取所有头像框列表
 * GET /api/admin/avatar-frames?t=timestamp
 */
export async function GET(request: NextRequest) {
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

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category'); // 可选：按分类筛选

    // 查询头像框
    let frames;
    if (category) {
      frames = await db
        .select()
        .from(avatarFrame)
        .where(eq(avatarFrame.category, category))
        .orderBy(avatarFrame.createdAt);
    } else {
      frames = await db
        .select()
        .from(avatarFrame)
        .orderBy(avatarFrame.createdAt);
    }

    return NextResponse.json({ frames });
  } catch (error) {
    console.error('Error fetching avatar frames:', error);
    return NextResponse.json(
      { error: '获取头像框列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 创建新头像框
 * POST /api/admin/avatar-frames
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { category, imageUrl } = body;

    // 验证必填字段
    if (!category || category.trim() === '') {
      return NextResponse.json(
        { error: '分类不能为空' },
        { status: 400 }
      );
    }

    // 创建头像框
    const [newFrame] = await db
      .insert(avatarFrame)
      .values({
        category: category.trim(),
        imageUrl: imageUrl?.trim() || null,
      })
      .returning();

    return NextResponse.json({ frame: newFrame }, { status: 201 });
  } catch (error) {
    console.error('Error creating avatar frame:', error);
    return NextResponse.json(
      { error: '创建头像框失败' },
      { status: 500 }
    );
  }
}



