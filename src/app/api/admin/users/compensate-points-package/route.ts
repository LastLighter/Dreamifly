import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { pointsPackage, user, userPoints } from '@/db/schema'

type PackageLite = {
  id: number
  name: string
  points: number
  isActive: boolean | null
}

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { userId, packageId } = body || {}

    if (!userId || packageId === undefined || packageId === null) {
      return NextResponse.json({ error: '缺少参数：userId 或 packageId' }, { status: 400 })
    }

    const packageIdInt = parseInt(packageId, 10)
    if (!Number.isInteger(packageIdInt) || packageIdInt <= 0) {
      return NextResponse.json({ error: 'packageId 必须为正整数' }, { status: 400 })
    }

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

    const packages = await db
      .select({
        id: pointsPackage.id,
        name: pointsPackage.name,
        points: pointsPackage.points,
        isActive: pointsPackage.isActive,
      })
      .from(pointsPackage)
      .where(eq(pointsPackage.id, packageIdInt))
      .limit(1)

    if (packages.length === 0) {
      return NextResponse.json({ error: '积分套餐不存在' }, { status: 404 })
    }

    const packageData: PackageLite = packages[0]

    if (packageData.isActive === false) {
      return NextResponse.json({ error: '该积分套餐已下架，无法补偿' }, { status: 400 })
    }

    const now = new Date()
    const pointsExpiresAt = new Date()
    pointsExpiresAt.setDate(pointsExpiresAt.getDate() + 365)

    await db.insert(userPoints).values({
      id: randomUUID(),
      userId,
      points: packageData.points,
      type: 'earned',
      description: `管理员补偿积分套餐 - ${packageData.name}`,
      earnedAt: now,
      expiresAt: pointsExpiresAt,
    })

    return NextResponse.json({
      success: true,
      points: packageData.points,
    })
  } catch (error) {
    console.error('Error compensating points package:', error)
    return NextResponse.json({ error: '补偿失败，请稍后重试' }, { status: 500 })
  }
}




