import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { headers } from 'next/headers';

// 获取用户列表
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
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const search = searchParams.get('search') || '';

    // 获取所有用户（用于搜索过滤，按创建时间倒序）
    const allUsers = await db.select()
      .from(user)
      .orderBy(desc(user.createdAt));

    // 过滤搜索结果（如果有关键词）
    let filteredUsers = allUsers;
    if (search) {
      const searchLower = search.toLowerCase().trim();
      if (searchLower) {
        filteredUsers = allUsers.filter(u => {
          // 安全地处理可能为 null/undefined 的字段
          const email = (u.email || '').toLowerCase().trim();
          const nickname = (u.nickname || '').toLowerCase().trim();
          const name = (u.name || '').toLowerCase().trim();
          
          const emailMatch = email.includes(searchLower);
          const nicknameMatch = nickname.includes(searchLower);
          const nameMatch = name.includes(searchLower);
          
          const matches = emailMatch || nicknameMatch || nameMatch;
          
          // 调试日志：只记录匹配的结果，帮助排查问题
          if (matches && process.env.NODE_ENV === 'development') {
            console.log('Matched user:', {
              id: u.id,
              email: u.email,
              nickname: u.nickname,
              name: u.name,
              search: searchLower,
              matches: { emailMatch, nicknameMatch, nameMatch }
            });
          }
          
          return matches;
        });
      }
    }

    // 计算总数
    const total = filteredUsers.length;

    // 分页
    const users = filteredUsers.slice(offset, offset + limit);

    // 格式化返回数据（不返回敏感信息）
    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      nickname: u.nickname,
      avatar: u.avatar || u.image || '/images/default-avatar.svg',
      uid: u.uid,
      emailVerified: u.emailVerified,
      isActive: u.isActive,
      isAdmin: u.isAdmin || false,
      isPremium: u.isPremium || false,
      dailyRequestCount: u.dailyRequestCount || 0,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      lastLoginAt: u.lastLoginAt,
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: '获取用户列表失败' },
      { status: 500 }
    );
  }
}

// 更新用户角色（普通用户/优质用户）
export async function PATCH(request: NextRequest) {
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
    const { userId, isPremium } = body;

    if (!userId || typeof isPremium !== 'boolean') {
      return NextResponse.json(
        { error: '参数错误：需要userId和isPremium' },
        { status: 400 }
      );
    }

    // 更新用户角色
    await db
      .update(user)
      .set({
        isPremium: isPremium,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user role:', error);
    return NextResponse.json(
      { error: '更新用户角色失败' },
      { status: 500 }
    );
  }
}

