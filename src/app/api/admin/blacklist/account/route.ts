import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { headers } from 'next/headers';

// 验证管理员权限的辅助函数
async function checkAdmin() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return { error: '未授权，请先登录', status: 401, session: null };
  }

  const currentUser = await db.select()
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    return { error: '无权限访问，需要管理员权限', status: 403, session: null };
  }

  return { error: null, status: null, session };
}

// 验证邮箱格式
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 获取被封禁的账户列表
export async function GET(request: NextRequest) {
  try {
    const adminCheck = await checkAdmin();
    if (adminCheck.error) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status! }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';

    // 获取所有被封禁的用户（isActive = false）
    const allRecords = await db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      isAdmin: user.isAdmin,
      isPremium: user.isPremium,
      isOldUser: user.isOldUser,
      banReason: user.banReason,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
      .from(user)
      .where(eq(user.isActive, false))
      .orderBy(desc(user.updatedAt));

    // 如果有搜索条件，过滤搜索结果
    let filteredRecords = allRecords;
    if (search) {
      const searchLower = search.toLowerCase().trim();
      filteredRecords = allRecords.filter(record => {
        const email = (record.email || '').toLowerCase();
        const name = (record.name || '').toLowerCase();
        const nickname = (record.nickname || '').toLowerCase();
        return email.includes(searchLower) || name.includes(searchLower) || nickname.includes(searchLower);
      });
    }

    // 计算总数
    const total = filteredRecords.length;

    // 分页
    const records = filteredRecords.slice(offset, offset + limit);

    return NextResponse.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching account blacklist:', error);
    return NextResponse.json(
      { error: '获取账户黑名单失败' },
      { status: 500 }
    );
  }
}

// 通过邮箱添加账户到黑名单（封禁账户）
export async function POST(request: NextRequest) {
  try {
    const adminCheck = await checkAdmin();
    if (adminCheck.error) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status! }
      );
    }

    const body = await request.json();
    const { email, reason } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: '参数错误：需要email' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    if (!isValidEmail(email.trim())) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 查找用户
    const targetUser = await db.select()
      .from(user)
      .where(eq(user.email, trimmedEmail))
      .limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const userData = targetUser[0];

    // 检查是否已经是封禁状态
    if (!userData.isActive) {
      return NextResponse.json(
        { error: '该账户已被封禁' },
        { status: 400 }
      );
    }

    // 防止封禁管理员
    if (userData.isAdmin) {
      return NextResponse.json(
        { error: '无法封禁管理员账号' },
        { status: 400 }
      );
    }

    // 封禁用户（设置isActive为false，保存封禁原因）
    await db.update(user)
      .set({
        isActive: false,
        banReason: reason && typeof reason === 'string' ? reason.trim() || null : null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userData.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error banning account:', error);
    return NextResponse.json(
      { error: '封禁账户失败' },
      { status: 500 }
    );
  }
}

// 从黑名单中移除账户（解封账户）
export async function DELETE(request: NextRequest) {
  try {
    const adminCheck = await checkAdmin();
    if (adminCheck.error) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status! }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: '参数错误：需要userId' },
        { status: 400 }
      );
    }

    // 查找用户
    const targetUser = await db.select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 解封用户（设置isActive为true，清除封禁原因）
    await db.update(user)
      .set({
        isActive: true,
        banReason: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unbanning account:', error);
    return NextResponse.json(
      { error: '解封账户失败' },
      { status: 500 }
    );
  }
}

// 编辑封禁原因
export async function PATCH(request: NextRequest) {
  try {
    const adminCheck = await checkAdmin();
    if (adminCheck.error) {
      return NextResponse.json(
        { error: adminCheck.error },
        { status: adminCheck.status! }
      );
    }

    const body = await request.json();
    const { userId, reason } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: '参数错误：需要userId' },
        { status: 400 }
      );
    }

    // 查找用户
    const targetUser = await db.select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (targetUser.length === 0) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    const userData = targetUser[0];

    // 检查用户是否被封禁
    if (userData.isActive) {
      return NextResponse.json(
        { error: '该账户未被封禁，无法编辑封禁原因' },
        { status: 400 }
      );
    }

    // 更新封禁原因
    await db.update(user)
      .set({
        banReason: reason && typeof reason === 'string' ? reason.trim() || null : null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating ban reason:', error);
    return NextResponse.json(
      { error: '更新封禁原因失败' },
      { status: 500 }
    );
  }
}

