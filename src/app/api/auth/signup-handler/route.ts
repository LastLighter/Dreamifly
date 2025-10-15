import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { user } from '@/db/schema';
import { sql } from 'drizzle-orm';

// 获取下一个可用的 UID
async function getNextUid(): Promise<number> {
  try {
    const result = await db.execute(sql`
      SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM "user"
    `);
    return (result.rows[0] as any).next_uid;
  } catch (error) {
    console.error('Error getting next UID:', error);
    return 1; // 如果出错，从 1 开始
  }
}

// 为新用户设置 UID 和昵称
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 获取下一个 UID
    const nextUid = await getNextUid();

    // 更新用户的 UID 和昵称
    await db.execute(sql`
      UPDATE "user" 
      SET uid = ${nextUid}, 
          nickname = ${'Dreamer-' + nextUid}
      WHERE id = ${userId}
    `);

    return NextResponse.json({ 
      success: true, 
      uid: nextUid,
      nickname: `Dreamer-${nextUid}`
    });
  } catch (error) {
    console.error('Error in signup handler:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

