import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { cdkConfig } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const config = await db.select()
      .from(cdkConfig)
      .where(eq(cdkConfig.id, 1))
      .limit(1);

    const currentConfig = config.length > 0 ? config[0] : { userDailyLimit: 5 };

    return NextResponse.json({ config: currentConfig });
  } catch (error) {
    console.error('获取CDK配置失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { userDailyLimit } = body;

    if (userDailyLimit !== undefined && (typeof userDailyLimit !== 'number' || userDailyLimit < 0)) {
      return NextResponse.json({ error: '无效的每日限制值' }, { status: 400 });
    }

    // 更新或创建配置
    await db.insert(cdkConfig).values({
      id: 1,
      userDailyLimit: userDailyLimit ?? 5,
      updatedAt: sql`(now() at time zone 'UTC')`,
    }).onConflictDoUpdate({
      target: cdkConfig.id,
      set: {
        userDailyLimit: userDailyLimit ?? 5,
        updatedAt: sql`(now() at time zone 'UTC')`,
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新CDK配置失败:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
