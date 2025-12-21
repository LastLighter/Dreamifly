import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, avatarFrame } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { headers } from 'next/headers';

/**
 * 批量操作用户
 * POST /api/admin/users/batch
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
    const { userIds, operation, frameId, frameIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '参数错误：需要userIds数组' },
        { status: 400 }
      );
    }

    if (!operation || (operation !== 'setAvatarFrame' && operation !== 'addAvatarFrames')) {
      return NextResponse.json(
        { error: '参数错误：operation必须是setAvatarFrame或addAvatarFrames' },
        { status: 400 }
      );
    }

    // 获取目标用户
    const targetUsers = await db.select()
      .from(user)
      .where(inArray(user.id, userIds));

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { error: '未找到目标用户' },
        { status: 404 }
      );
    }

    const results = {
      success: [] as string[],
      failed: [] as Array<{ userId: string; reason: string }>,
      skipped: [] as Array<{ userId: string; reason: string }>,
    };

    if (operation === 'setAvatarFrame') {
      // 批量设置当前头像框ID
      if (!frameId || typeof frameId !== 'number') {
        return NextResponse.json(
          { error: '参数错误：setAvatarFrame操作需要frameId' },
          { status: 400 }
        );
      }

      // 验证头像框是否存在
      const frame = await db.select()
        .from(avatarFrame)
        .where(eq(avatarFrame.id, frameId))
        .limit(1);

      if (frame.length === 0) {
        return NextResponse.json(
          { error: '头像框不存在' },
          { status: 400 }
        );
      }

      const frameIdStr = String(frameId);

      // 检查每个用户是否拥有该头像框
      for (const targetUser of targetUsers) {
        // 跳过管理员
        if (targetUser.isAdmin) {
          results.skipped.push({
            userId: targetUser.id,
            reason: '管理员账号跳过'
          });
          continue;
        }

        // 检查用户是否拥有该头像框
        const availableIds = targetUser.availableAvatarFrameIds
          ? targetUser.availableAvatarFrameIds.split(',').map(id => id.trim())
          : [];

        if (!availableIds.includes(frameIdStr)) {
          results.failed.push({
            userId: targetUser.id,
            reason: `用户未拥有头像框ID ${frameId}`
          });
          continue;
        }

        // 更新用户头像框ID
        try {
          await db
            .update(user)
            .set({
              avatarFrameId: frameId,
              updatedAt: new Date(),
            })
            .where(eq(user.id, targetUser.id));

          results.success.push(targetUser.id);
        } catch (error) {
          results.failed.push({
            userId: targetUser.id,
            reason: '更新失败'
          });
        }
      }
    } else if (operation === 'addAvatarFrames') {
      // 批量新增头像框ID
      if (!frameIds || !Array.isArray(frameIds) || frameIds.length === 0) {
        return NextResponse.json(
          { error: '参数错误：addAvatarFrames操作需要frameIds数组' },
          { status: 400 }
        );
      }

      // 验证所有头像框ID是否有效
      const validFrameIds = frameIds
        .map(id => parseInt(String(id), 10))
        .filter(id => !isNaN(id) && id > 0);

      if (validFrameIds.length === 0) {
        return NextResponse.json(
          { error: '参数错误：frameIds必须包含有效的数字ID' },
          { status: 400 }
        );
      }

      // 验证头像框是否存在
      const frames = await db.select()
        .from(avatarFrame)
        .where(inArray(avatarFrame.id, validFrameIds));

      const existingFrameIds = new Set(frames.map(f => f.id));
      const invalidFrameIds = validFrameIds.filter(id => !existingFrameIds.has(id));

      if (invalidFrameIds.length > 0) {
        return NextResponse.json(
          { error: `以下头像框ID不存在: ${invalidFrameIds.join(', ')}` },
          { status: 400 }
        );
      }

      const frameIdStrs = validFrameIds.map(id => String(id));

      // 为每个用户添加头像框ID
      for (const targetUser of targetUsers) {
        // 跳过管理员
        if (targetUser.isAdmin) {
          results.skipped.push({
            userId: targetUser.id,
            reason: '管理员账号跳过'
          });
          continue;
        }

        // 获取用户当前拥有的头像框ID
        const currentIds = targetUser.availableAvatarFrameIds
          ? targetUser.availableAvatarFrameIds.split(',').map(id => id.trim()).filter(id => id !== '')
          : [];

        // 合并新ID，去重
        const newIds = [...new Set([...currentIds, ...frameIdStrs])];

        // 如果ID没有变化，跳过
        if (newIds.length === currentIds.length) {
          results.skipped.push({
            userId: targetUser.id,
            reason: '用户已拥有所有指定的头像框'
          });
          continue;
        }

        // 更新用户头像框库存
        try {
          await db
            .update(user)
            .set({
              availableAvatarFrameIds: newIds.join(','),
              updatedAt: new Date(),
            })
            .where(eq(user.id, targetUser.id));

          results.success.push(targetUser.id);
        } catch (error) {
          results.failed.push({
            userId: targetUser.id,
            reason: '更新失败'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: {
        total: targetUsers.length,
        success: results.success.length,
        failed: results.failed.length,
        skipped: results.skipped.length,
        details: results,
      }
    });
  } catch (error) {
    console.error('Error in batch user operation:', error);
    return NextResponse.json(
      { error: '批量操作失败' },
      { status: 500 }
    );
  }
}

