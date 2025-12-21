import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/db/schema'
import { getPointsBalance } from '@/utils/points'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 })
    }

    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (!currentUser[0]?.isAdmin) {
      return NextResponse.json({ error: '无权限访问，需要管理员权限' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: '缺少参数：userId' }, { status: 400 })
    }

    // 验证目标用户是否存在
    const targetUsers = await db
      .select({
        id: user.id,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (targetUsers.length === 0) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 获取用户积分余额
    const balance = await getPointsBalance(userId)

    return NextResponse.json({
      balance,
    })
  } catch (error) {
    console.error('Error fetching user points balance:', error)
    return NextResponse.json({ error: '获取积分余额失败，请稍后重试' }, { status: 500 })
  }
}


