import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userPoints, user } from '@/db/schema'
import { eq, and, gte, sql, desc } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  try {
    // Check admin permission
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1)
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = (page - 1) * limit

    const now = new Date()

    // Get ranking
    const ranking = await db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        totalPoints: sql<number>`COALESCE(SUM(${userPoints.points}), 0)`,
      })
      .from(user)
      .leftJoin(userPoints, eq(user.id, userPoints.userId))
      .where(
        and(
          eq(userPoints.type, 'earned'),
          gte(userPoints.expiresAt, now)
        )
      )
      .groupBy(user.id)
      .orderBy(desc(sql`COALESCE(SUM(${userPoints.points}), 0)`))
      .limit(limit)
      .offset(offset)

    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${user.id})` })
      .from(user)
      .leftJoin(userPoints, eq(user.id, userPoints.userId))
      .where(
        and(
          eq(userPoints.type, 'earned'),
          gte(userPoints.expiresAt, now)
        )
      )

    const total = Number(totalResult[0]?.count || 0)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ ranking, total, totalPages, currentPage: page })
  } catch (error) {
    console.error('Error fetching points ranking:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
