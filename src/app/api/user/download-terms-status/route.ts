import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/user/download-terms-status
 * 返回当前用户是否已同意无水印下载协议（从数据库读取，不依赖 session 中的 user 字段）
 * 用于在 session 未包含 acceptedDownloadTerms 时仍能正确判断，无需用户重新登录
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [row] = await db
      .select({ acceptedDownloadTerms: user.acceptedDownloadTerms })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    return NextResponse.json({
      acceptedDownloadTerms: row?.acceptedDownloadTerms ?? false,
    })
  } catch (error) {
    console.error('Error fetching download terms status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
