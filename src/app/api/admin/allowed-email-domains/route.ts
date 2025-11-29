import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { allowedEmailDomain } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { user } from '@/db/schema';

/**
 * 获取所有允许的邮箱域名列表
 * GET /api/admin/allowed-email-domains
 */
export async function GET() {
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

    // 获取所有邮箱域名
    const domains = await db
      .select()
      .from(allowedEmailDomain)
      .orderBy(allowedEmailDomain.createdAt);

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('Error fetching allowed email domains:', error);
    return NextResponse.json(
      { error: '获取邮箱域名列表失败' },
      { status: 500 }
    );
  }
}

/**
 * 创建新的邮箱域名
 * POST /api/admin/allowed-email-domains
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
    const { domain, isEnabled = true } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { error: '邮箱域名不能为空' },
        { status: 400 }
      );
    }

    // 验证域名格式（简单验证）
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const normalizedDomain = domain.toLowerCase().trim();
    
    if (!domainRegex.test(normalizedDomain)) {
      return NextResponse.json(
        { error: '邮箱域名格式不正确' },
        { status: 400 }
      );
    }

    // 检查域名是否已存在
    const existing = await db
      .select()
      .from(allowedEmailDomain)
      .where(eq(allowedEmailDomain.domain, normalizedDomain))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: '该邮箱域名已存在' },
        { status: 400 }
      );
    }

    // 创建新域名
    const [newDomain] = await db
      .insert(allowedEmailDomain)
      .values({
        domain: normalizedDomain,
        isEnabled: Boolean(isEnabled),
      })
      .returning();

    return NextResponse.json({ domain: newDomain }, { status: 201 });
  } catch (error) {
    console.error('Error creating allowed email domain:', error);
    return NextResponse.json(
      { error: '创建邮箱域名失败' },
      { status: 500 }
    );
  }
}

/**
 * 更新邮箱域名
 * PATCH /api/admin/allowed-email-domains
 */
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
    const { id, domain, isEnabled } = body;

    if (!id) {
      return NextResponse.json(
        { error: '域名ID不能为空' },
        { status: 400 }
      );
    }

    // 构建更新数据
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (domain !== undefined) {
      const normalizedDomain = domain.toLowerCase().trim();
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
      if (!domainRegex.test(normalizedDomain)) {
        return NextResponse.json(
          { error: '邮箱域名格式不正确' },
          { status: 400 }
        );
      }

      // 检查域名是否已被其他记录使用
      const existing = await db
        .select()
        .from(allowedEmailDomain)
        .where(eq(allowedEmailDomain.domain, normalizedDomain))
        .limit(1);

      if (existing.length > 0 && existing[0].id !== id) {
        return NextResponse.json(
          { error: '该邮箱域名已被其他记录使用' },
          { status: 400 }
        );
      }

      updateData.domain = normalizedDomain;
    }

    if (isEnabled !== undefined) {
      updateData.isEnabled = Boolean(isEnabled);
    }

    // 更新域名
    const [updatedDomain] = await db
      .update(allowedEmailDomain)
      .set(updateData)
      .where(eq(allowedEmailDomain.id, id))
      .returning();

    if (!updatedDomain) {
      return NextResponse.json(
        { error: '邮箱域名不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ domain: updatedDomain });
  } catch (error) {
    console.error('Error updating allowed email domain:', error);
    return NextResponse.json(
      { error: '更新邮箱域名失败' },
      { status: 500 }
    );
  }
}

/**
 * 删除邮箱域名
 * DELETE /api/admin/allowed-email-domains?id=xxx
 */
export async function DELETE(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: '域名ID不能为空' },
        { status: 400 }
      );
    }

    const domainId = parseInt(id, 10);
    if (isNaN(domainId)) {
      return NextResponse.json(
        { error: '无效的域名ID' },
        { status: 400 }
      );
    }

    // 删除域名
    const [deletedDomain] = await db
      .delete(allowedEmailDomain)
      .where(eq(allowedEmailDomain.id, domainId))
      .returning();

    if (!deletedDomain) {
      return NextResponse.json(
        { error: '邮箱域名不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, domain: deletedDomain });
  } catch (error) {
    console.error('Error deleting allowed email domain:', error);
    return NextResponse.json(
      { error: '删除邮箱域名失败' },
      { status: 500 }
    );
  }
}

