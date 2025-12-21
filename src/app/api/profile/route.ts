import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { nickname, avatar, avatarFrameId } = body;

    // 构建更新数据
    const updateData: {
      nickname?: string;
      avatar?: string;
      avatarFrameId?: number | null;
    } = {};

    if (nickname !== undefined) {
      updateData.nickname = nickname;
    }
    if (avatar !== undefined) {
      updateData.avatar = avatar;
    }
    if (avatarFrameId !== undefined) {
      // 如果avatarFrameId为null，直接设置为null
      if (avatarFrameId === null) {
        updateData.avatarFrameId = null;
      } else {
        // 验证头像框ID是否为有效数字
        const frameId = typeof avatarFrameId === 'string' ? parseInt(avatarFrameId, 10) : avatarFrameId;
        if (!isNaN(frameId)) {
          updateData.avatarFrameId = frameId;
        }
      }
    }

    // 更新用户信息
    await db
      .update(user)
      .set(updateData)
      .where(eq(user.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
