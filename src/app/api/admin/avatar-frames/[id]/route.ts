import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { avatarFrame } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { user } from '@/db/schema';
import { deleteFromOSS } from '@/utils/oss';

/**
 * 更新头像框
 * PUT /api/admin/avatar-frames/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const frameId = parseInt(id, 10);

    if (isNaN(frameId)) {
      return NextResponse.json(
        { error: '无效的头像框ID' },
        { status: 400 }
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

    // 检查头像框是否存在
    const existingFrame = await db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, frameId))
      .limit(1);

    if (existingFrame.length === 0) {
      return NextResponse.json(
        { error: '头像框不存在' },
        { status: 404 }
      );
    }

    const oldImageUrl = existingFrame[0].imageUrl;
    const newImageUrl = imageUrl?.trim() || null;

    // 如果更换了图片，且旧图片在OSS上，删除旧图片
    if (oldImageUrl && oldImageUrl !== newImageUrl && oldImageUrl.includes('oss')) {
      try {
        await deleteFromOSS(oldImageUrl);
        console.log('已删除旧头像框图片:', oldImageUrl);
      } catch (error) {
        console.warn('删除旧头像框图片失败:', error);
        // 不阻止更新，继续执行
      }
    }

    // 更新头像框
    const [updatedFrame] = await db
      .update(avatarFrame)
      .set({
        category: category.trim(),
        imageUrl: newImageUrl,
        updatedAt: new Date(),
      })
      .where(eq(avatarFrame.id, frameId))
      .returning();

    return NextResponse.json({ frame: updatedFrame });
  } catch (error) {
    console.error('Error updating avatar frame:', error);
    return NextResponse.json(
      { error: '更新头像框失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除头像框
 * DELETE /api/admin/avatar-frames/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const frameId = parseInt(id, 10);

    if (isNaN(frameId)) {
      return NextResponse.json(
        { error: '无效的头像框ID' },
        { status: 400 }
      );
    }

    // 检查头像框是否存在
    const existingFrame = await db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, frameId))
      .limit(1);

    if (existingFrame.length === 0) {
      return NextResponse.json(
        { error: '头像框不存在' },
        { status: 404 }
      );
    }

    const imageUrl = existingFrame[0].imageUrl;

    // 如果图片在OSS上，先删除OSS中的文件
    if (imageUrl && imageUrl.includes('oss')) {
      try {
        await deleteFromOSS(imageUrl);
        console.log('已删除头像框图片:', imageUrl);
      } catch (error) {
        console.warn('删除头像框图片失败:', error);
        // 不阻止删除记录，继续执行
      }
    }

    // 删除头像框记录
    await db
      .delete(avatarFrame)
      .where(eq(avatarFrame.id, frameId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting avatar frame:', error);
    return NextResponse.json(
      { error: '删除头像框失败' },
      { status: 500 }
    );
  }
}

