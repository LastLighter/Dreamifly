import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { user, ipBlacklist } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { headers } from 'next/headers';
import { randomUUID } from 'crypto';

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

// 验证IP地址格式
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// 获取IP黑名单列表
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

    // 获取所有IP黑名单记录
    let query = db.select().from(ipBlacklist).orderBy(desc(ipBlacklist.createdAt));

    const allRecords = await query;

    // 过滤搜索结果
    let filteredRecords = allRecords;
    if (search) {
      const searchLower = search.toLowerCase().trim();
      filteredRecords = allRecords.filter(record => {
        const ipAddress = (record.ipAddress || '').toLowerCase();
        const reason = (record.reason || '').toLowerCase();
        return ipAddress.includes(searchLower) || reason.includes(searchLower);
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
    console.error('Error fetching IP blacklist:', error);
    return NextResponse.json(
      { error: '获取IP黑名单失败' },
      { status: 500 }
    );
  }
}

// 添加IP到黑名单
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
    const { ipAddress, reason } = body;

    if (!ipAddress || typeof ipAddress !== 'string') {
      return NextResponse.json(
        { error: '参数错误：需要ipAddress' },
        { status: 400 }
      );
    }

    // 验证IP地址格式
    if (!isValidIP(ipAddress.trim())) {
      return NextResponse.json(
        { error: 'IP地址格式不正确' },
        { status: 400 }
      );
    }

    const trimmedIP = ipAddress.trim();

    // 检查IP是否已在黑名单中
    const existing = await db.select()
      .from(ipBlacklist)
      .where(eq(ipBlacklist.ipAddress, trimmedIP))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: '该IP地址已在黑名单中' },
        { status: 400 }
      );
    }

    // 添加IP到黑名单
    const id = randomUUID();
    await db.insert(ipBlacklist).values({
      id,
      ipAddress: trimmedIP,
      reason: reason || null,
      createdBy: adminCheck.session!.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error adding IP to blacklist:', error);
    return NextResponse.json(
      { error: '添加IP到黑名单失败' },
      { status: 500 }
    );
  }
}

// 删除IP黑名单记录
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '参数错误：需要id' },
        { status: 400 }
      );
    }

    // 删除记录
    await db.delete(ipBlacklist).where(eq(ipBlacklist.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting IP from blacklist:', error);
    return NextResponse.json(
      { error: '删除IP黑名单失败' },
      { status: 500 }
    );
  }
}

// 更新IP黑名单记录（主要是更新原因）
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
    const { id, reason } = body;

    if (!id) {
      return NextResponse.json(
        { error: '参数错误：需要id' },
        { status: 400 }
      );
    }

    // 更新记录
    await db
      .update(ipBlacklist)
      .set({
        reason: reason || null,
        updatedAt: new Date(),
      })
      .where(eq(ipBlacklist.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating IP blacklist:', error);
    return NextResponse.json(
      { error: '更新IP黑名单失败' },
      { status: 500 }
    );
  }
}


