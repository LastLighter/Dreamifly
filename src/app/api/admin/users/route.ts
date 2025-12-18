import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, avatarFrame, allowedEmailDomain } from '@/db/schema';
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
    const roleFilter = searchParams.get('role') || 'all'; // admin, subscribed, premium, oldUser, regular, all
    const statusFilter = searchParams.get('status') || 'active'; // active, banned, all

    // 检查用户订阅是否有效的辅助函数
    const isSubscriptionActive = (isSubscribed: boolean | null, subscriptionExpiresAt: Date | null): boolean => {
      if (!isSubscribed) return false;
      if (!subscriptionExpiresAt) return false;
      return new Date(subscriptionExpiresAt) > new Date();
    }

    // 构建筛选条件
    const filterConditions = [];
    
    // 邮箱验证状态筛选
    if (emailVerifiedFilter === 'true') {
      filterConditions.push(eq(user.emailVerified, true));
    } else if (emailVerifiedFilter === 'false') {
      filterConditions.push(eq(user.emailVerified, false));
    }
    
    // 角色筛选（允许用户同时拥有多个身份）
    if (roleFilter === 'admin') {
      filterConditions.push(eq(user.isAdmin, true));
    } else if (roleFilter === 'premium') {
      // 优质用户：isPremium=true（可以是管理员、付费用户、首批用户等）
      filterConditions.push(eq(user.isPremium, true));
    } else if (roleFilter === 'oldUser') {
      // 首批用户：isOldUser=true（可以是管理员、付费用户、优质用户等）
      filterConditions.push(eq(user.isOldUser, true));
    } else if (roleFilter === 'regular') {
      // 普通用户：不是管理员、不是会员、不是优质用户、不是首批用户
      filterConditions.push(and(
        eq(user.isAdmin, false),
        eq(user.isPremium, false),
        eq(user.isOldUser, false)
      ));
    }
    // subscribed 筛选在内存中处理，因为需要检查订阅是否有效
    
    // 状态筛选
    if (statusFilter === 'active') {
      filterConditions.push(eq(user.isActive, true));
    } else if (statusFilter === 'banned') {
      filterConditions.push(eq(user.isActive, false));
    }
    // statusFilter === 'all' 时不添加筛选条件
    
    // 构建查询（包含订阅字段）
    let query = db.select({
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      image: user.image,
      avatar: user.avatar,
      uid: user.uid,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      isAdmin: user.isAdmin,
      isPremium: user.isPremium,
      isOldUser: user.isOldUser,
      isSubscribed: user.isSubscribed,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      dailyRequestCount: user.dailyRequestCount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      avatarFrameId: user.avatarFrameId,
    }).from(user);
    
    // 应用筛选条件
    if (filterConditions.length > 0) {
      query = query.where(and(...filterConditions)) as any;
    }
    
    // 获取所有用户（先应用筛选条件）
    let allUsers = await query;

    // 邮箱类型筛选（在内存中处理，因为需要检查邮箱域名）
    if (emailTypeFilter !== 'all') {
      // 获取所有邮箱白名单域名
      const allDomains = await db
        .select({ domain: allowedEmailDomain.domain })
        .from(allowedEmailDomain);
      
      const domainList = allDomains.map(d => d.domain.toLowerCase());
      
      allUsers = allUsers.filter(u => {
        if (!u.email) return false;
        const emailLower = u.email.toLowerCase();
        const emailDomain = emailLower.split('@')[1];
        
        if (emailTypeFilter === 'other') {
          // 筛选不在白名单中的邮箱
          return !domainList.includes(emailDomain);
        } else {
          // 筛选指定域名的邮箱
          return emailDomain === emailTypeFilter.toLowerCase();
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

    // 根据角色筛选条件进行内存筛选（允许用户同时拥有多个身份）
    if (roleFilter === 'subscribed') {
      // 付费用户（会员）：订阅有效（可以是管理员、优质用户、首批用户等）
      allUsers = allUsers.filter(u => {
        return isSubscriptionActive(u.isSubscribed, u.subscriptionExpiresAt);
      });
    } else if (roleFilter === 'premium') {
      // 优质用户：isPremium=true（已在数据库筛选，这里不需要额外处理）
      // 但为了保持一致性，可以在这里再次确认
      allUsers = allUsers.filter(u => u.isPremium === true);
    } else if (roleFilter === 'oldUser') {
      // 首批用户：isOldUser=true（已在数据库筛选，这里不需要额外处理）
      // 但为了保持一致性，可以在这里再次确认
      allUsers = allUsers.filter(u => u.isOldUser === true);
    } else if (roleFilter === 'regular') {
      // 普通用户：不是管理员、不是会员、不是优质用户、不是首批用户
      allUsers = allUsers.filter(u => {
        if (u.isAdmin) return false;
        if (isSubscriptionActive(u.isSubscribed, u.subscriptionExpiresAt)) return false;
        if (u.isPremium) return false;
        if (u.isOldUser) return false;
        return true;
      });
    }

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
      isOldUser: u.isOldUser || false,
      isSubscribed: u.isSubscribed || false,
      subscriptionExpiresAt: u.subscriptionExpiresAt,
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
    const { userId, isPremium, isOldUser, isActive, avatarFrameId, banReason } = body;

    if (!userId) {
      return NextResponse.json(
        { error: '参数错误：需要userId' },
        { status: 400 }
      );
    }

    // 检查目标用户是否存在，并防止封禁管理员
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

    // 如果尝试封禁管理员，拒绝操作
    if (targetUser[0].isAdmin && typeof isActive === 'boolean' && !isActive) {
      return NextResponse.json(
        { error: '无法封禁管理员账号' },
        { status: 400 }
      );
    }

    // 构建更新数据
    const updateData: {
      isPremium?: boolean;
      isOldUser?: boolean;
      isActive?: boolean;
      avatarFrameId?: number | null;
      banReason?: string | null;
      updatedAt: Date;
    } = {
      updatedAt: new Date(),
    };

    // 如果提供了isPremium，更新角色
    if (typeof isPremium === 'boolean') {
      updateData.isPremium = isPremium;
    }

    // 如果提供了isOldUser，更新老用户标记
    if (typeof isOldUser === 'boolean') {
      updateData.isOldUser = isOldUser;
    }

    // 如果提供了isActive，更新封禁状态
    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
      // 如果封禁用户，可以设置封禁原因；如果解封用户，清除封禁原因
      if (isActive === false && banReason !== undefined) {
        updateData.banReason = banReason && typeof banReason === 'string' ? banReason.trim() || null : null;
      } else if (isActive === true) {
        updateData.banReason = null; // 解封时清除封禁原因
      }
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

