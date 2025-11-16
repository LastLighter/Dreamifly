import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, avatarFrame } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
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
    
    // 排序参数
    const sortBy = searchParams.get('sortBy') || 'createdAt'; // uid, lastLoginAt, dailyRequestCount, createdAt
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // asc, desc
    
    // 筛选参数
    const emailVerifiedFilter = searchParams.get('emailVerified'); // true, false, 或空（全部）
    const emailTypeFilter = searchParams.get('emailType') || 'all'; // gmail, outlook, qq, 163, other, all
    const roleFilter = searchParams.get('role') || 'all'; // admin, premium, regular, all

    // 构建筛选条件
    const filterConditions = [];
    
    // 邮箱验证状态筛选
    if (emailVerifiedFilter === 'true') {
      filterConditions.push(eq(user.emailVerified, true));
    } else if (emailVerifiedFilter === 'false') {
      filterConditions.push(eq(user.emailVerified, false));
    }
    
    // 角色筛选
    if (roleFilter === 'admin') {
      filterConditions.push(eq(user.isAdmin, true));
    } else if (roleFilter === 'premium') {
      filterConditions.push(and(eq(user.isAdmin, false), eq(user.isPremium, true)));
    } else if (roleFilter === 'regular') {
      filterConditions.push(and(eq(user.isAdmin, false), eq(user.isPremium, false)));
    }
    
    // 构建查询
    let query = db.select().from(user);
    
    // 应用筛选条件
    if (filterConditions.length > 0) {
      query = query.where(and(...filterConditions)) as any;
    }
    
    // 获取所有用户（先应用筛选条件）
    let allUsers = await query;

    // 邮箱类型筛选（在内存中处理，因为需要检查邮箱域名）
    if (emailTypeFilter !== 'all') {
      allUsers = allUsers.filter(u => {
        if (!u.email) return false;
        const emailLower = u.email.toLowerCase();
        switch (emailTypeFilter) {
          case 'gmail':
            return emailLower.includes('@gmail.com');
          case 'outlook':
            return emailLower.includes('@outlook.com') || emailLower.includes('@hotmail.com') || emailLower.includes('@live.com');
          case 'qq':
            return emailLower.includes('@qq.com');
          case '163':
            return emailLower.includes('@163.com') || emailLower.includes('@126.com');
          case 'other':
            return !emailLower.includes('@gmail.com') && 
                   !emailLower.includes('@outlook.com') && 
                   !emailLower.includes('@hotmail.com') && 
                   !emailLower.includes('@live.com') && 
                   !emailLower.includes('@qq.com') && 
                   !emailLower.includes('@163.com') && 
                   !emailLower.includes('@126.com');
          default:
            return true;
        }
      });
    }

    // 搜索过滤（如果有关键词）
    if (search) {
      const searchLower = search.toLowerCase().trim();
      if (searchLower) {
        allUsers = allUsers.filter(u => {
          // 安全地处理可能为 null/undefined 的字段
          const email = (u.email || '').toLowerCase().trim();
          const nickname = (u.nickname || '').toLowerCase().trim();
          const name = (u.name || '').toLowerCase().trim();
          
          const emailMatch = email.includes(searchLower);
          const nicknameMatch = nickname.includes(searchLower);
          const nameMatch = name.includes(searchLower);
          
          return emailMatch || nicknameMatch || nameMatch;
        });
      }
    }

    // 排序
    allUsers.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortBy) {
        case 'uid':
          aValue = a.uid ?? 0;
          bValue = b.uid ?? 0;
          break;
        case 'lastLoginAt':
          aValue = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
          bValue = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
          break;
        case 'dailyRequestCount':
          aValue = a.dailyRequestCount ?? 0;
          bValue = b.dailyRequestCount ?? 0;
          break;
        case 'createdAt':
        default:
          aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    // 计算总数
    const total = allUsers.length;

    // 分页
    const users = allUsers.slice(offset, offset + limit);

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
      avatarFrameId: u.avatarFrameId ?? null,
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
    const { userId, isPremium, avatarFrameId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '参数错误：需要userId' },
        { status: 400 }
      );
    }

    // 构建更新数据
    const updateData: {
      isPremium?: boolean;
      avatarFrameId?: number | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    // 如果提供了isPremium，更新角色
    if (typeof isPremium === 'boolean') {
      updateData.isPremium = isPremium;
    }

    // 如果提供了avatarFrameId，验证并更新
    if (avatarFrameId !== undefined) {
      // 如果avatarFrameId为null，直接设置为null
      if (avatarFrameId === null) {
        updateData.avatarFrameId = null;
      } else {
        // 验证头像框是否存在
        const frameId = typeof avatarFrameId === 'string' ? parseInt(avatarFrameId, 10) : avatarFrameId;
        if (isNaN(frameId) || frameId <= 0) {
          return NextResponse.json(
            { error: '头像框ID必须是正整数' },
            { status: 400 }
          );
        }

        const frame = await db
          .select()
          .from(avatarFrame)
          .where(eq(avatarFrame.id, frameId))
          .limit(1);

        if (frame.length === 0) {
          return NextResponse.json(
            { error: '头像框不存在' },
            { status: 400 }
          );
        }

        updateData.avatarFrameId = frameId;
      }
    }

    // 更新用户
    await db
      .update(user)
      .set(updateData)
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

