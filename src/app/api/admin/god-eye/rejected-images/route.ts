import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { rejectedImages, user } from '@/db/schema'
import { eq, desc, and, or, like, gte, lte, sql, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * 获取未通过审核的图片列表（管理员专用）
 * 查询参数：
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - role: 用户角色筛选（subscribed, premium, oldUser, regular, all）
 * - search: 搜索关键词（用户昵称）
 * - startDate: 开始日期（YYYY-MM-DD）
 * - endDate: 结束日期（YYYY-MM-DD）
 * - reason: 拒绝原因筛选（image, prompt, both, all）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json(
        { error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    // 检查是否为管理员
    const currentUser = await db.select()
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      return NextResponse.json(
        { error: '无权限访问，需要管理员权限' },
        { status: 403 }
      )
    }

    // 获取查询参数
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)
    const offset = (page - 1) * limit
    const roleFilter = searchParams.get('role') || 'all'
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const reasonFilter = searchParams.get('reason') || 'all'

    // 构建筛选条件
    const conditions = []

    // 用户角色筛选
    if (roleFilter !== 'all') {
      if (roleFilter === 'regular') {
        conditions.push(
          or(
            eq(rejectedImages.userRole, 'regular'),
            isNull(rejectedImages.userRole)
          )
        )
      } else {
        conditions.push(eq(rejectedImages.userRole, roleFilter))
      }
    }

    // 拒绝原因筛选
    if (reasonFilter !== 'all') {
      conditions.push(eq(rejectedImages.rejectionReason, reasonFilter))
    }

    // 搜索筛选（用户昵称）
    if (search.trim()) {
      conditions.push(
        like(rejectedImages.userNickname, `%${search.trim()}%`)
      )
    }

    // 日期范围筛选
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      conditions.push(gte(rejectedImages.createdAt, start))
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      conditions.push(lte(rejectedImages.createdAt, end))
    }

    // 查询总数
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(rejectedImages)
      .where(whereClause as any)

    const total = totalResult[0]?.count || 0

    // 查询图片列表
    const images = await db
      .select({
        id: rejectedImages.id,
        imageUrl: rejectedImages.imageUrl,
        prompt: rejectedImages.prompt,
        model: rejectedImages.model,
        width: rejectedImages.width,
        height: rejectedImages.height,
        userRole: rejectedImages.userRole,
        userAvatar: rejectedImages.userAvatar,
        userNickname: rejectedImages.userNickname,
        avatarFrameId: rejectedImages.avatarFrameId,
        rejectionReason: rejectedImages.rejectionReason,
        createdAt: rejectedImages.createdAt,
        userId: rejectedImages.userId,
        ipAddress: rejectedImages.ipAddress,
      })
      .from(rejectedImages)
      .where(whereClause as any)
      .orderBy(desc(rejectedImages.createdAt))
      .limit(limit)
      .offset(offset)

    // 格式化返回数据
    const formattedImages = images.map(img => ({
      id: img.id,
      imageUrl: img.imageUrl,
      prompt: img.prompt,
      model: img.model,
      width: img.width,
      height: img.height,
      userRole: img.userRole || 'regular',
      userAvatar: img.userAvatar || '/images/default-avatar.svg',
      userNickname: img.userNickname || (img.userId ? '未知用户' : '未登录用户'),
      avatarFrameId: img.avatarFrameId,
      rejectionReason: img.rejectionReason || 'image',
      createdAt: img.createdAt?.toISOString() || new Date().toISOString(),
      userId: img.userId,
      ipAddress: img.ipAddress,
    }))

    return NextResponse.json({
      success: true,
      images: formattedImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching rejected images:', error)
    return NextResponse.json(
      { error: '获取图片列表失败' },
      { status: 500 }
    )
  }
}

/**
 * 获取单个图片（解码后返回base64）
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

