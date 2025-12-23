import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { profanityWord, user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';

/**
 * 获取所有违禁词
 * GET /api/admin/profanity-words
 */
export async function GET() {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    const words = await db
      .select()
      .from(profanityWord)
      .orderBy(profanityWord.createdAt);

    return NextResponse.json({ words });
  } catch (error) {
    console.error('Error fetching profanity words:', error);
    return NextResponse.json(
      { error: '获取违禁词列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 新增违禁词
 * POST /api/admin/profanity-words
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const currentUser = await db
      .select()
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
    const { word, isEnabled = true } = body;

    if (!word || typeof word !== 'string' || !word.trim()) {
      return NextResponse.json(
        { error: '违禁词内容不能为空' },
        { status: 400 }
      );
    }

    const normalizedWord = word.trim();

    // 检查是否已存在
    const existing = await db
      .select()
      .from(profanityWord)
      .where(eq(profanityWord.word, normalizedWord))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: '该违禁词已存在' },
        { status: 400 }
      );
    }

    const [newWord] = await db
      .insert(profanityWord)
      .values({
        word: normalizedWord,
        isEnabled: Boolean(isEnabled),
      })
      .returning();

    return NextResponse.json({ word: newWord }, { status: 201 });
  } catch (error) {
    console.error('Error creating profanity word:', error);
    return NextResponse.json(
      { error: '创建违禁词失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新违禁词
 * PATCH /api/admin/profanity-words
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const currentUser = await db
      .select()
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
    const { id, word, isEnabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: '违禁词ID不能为空' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (word !== undefined) {
      const normalizedWord = String(word).trim();
      if (!normalizedWord) {
        return NextResponse.json(
          { error: '违禁词内容不能为空' },
          { status: 400 }
        );
      }

      const existing = await db
        .select()
        .from(profanityWord)
        .where(eq(profanityWord.word, normalizedWord))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json(
          { error: '该违禁词已被其他记录使用' },
          { status: 400 }
        );
      }

      updateData.word = normalizedWord;
    }

    if (isEnabled !== undefined) {
      updateData.isEnabled = Boolean(isEnabled);
    }

    const [updatedWord] = await db
      .update(profanityWord)
      .set(updateData)
      .where(eq(profanityWord.id, id))
      .returning();

    if (!updatedWord) {
      return NextResponse.json(
        { error: '违禁词不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ word: updatedWord });
  } catch (error) {
    console.error('Error updating profanity word:', error);
    return NextResponse.json(
      { error: '更新违禁词失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除违禁词
 * DELETE /api/admin/profanity-words?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const currentUser = await db
      .select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1);

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '违禁词ID不能为空' },
        { status: 400 }
      );
    }

    const wordId = parseInt(id, 10);
    if (isNaN(wordId)) {
      return NextResponse.json(
        { error: '无效的违禁词ID' },
        { status: 400 }
      );
    }

    const [deletedWord] = await db
      .delete(profanityWord)
      .where(eq(profanityWord.id, wordId))
      .returning();

    if (!deletedWord) {
      return NextResponse.json(
        { error: '违禁词不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, word: deletedWord });
  } catch (error) {
    console.error('Error deleting profanity word:', error);
    return NextResponse.json(
      { error: '删除违禁词失败' },
      { status: 500 }
    );
  }
}


