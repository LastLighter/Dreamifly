import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { userGeneratedImages, user } from '@/db/schema'
import { eq, ne, desc, and, or, like, isNull, inArray, gte, lte, sql } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * 获取通过审核的图片列表（管理员专用）
 * 查询参数：
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - role: 用户角色筛选（admin, subscribed, premium, oldUser, regular, all）
 * - search: 搜索关键词（用户昵称）
 * - startDate: 开始日期（YYYY-MM-DD）
 * - endDate: 结束日期（YYYY-MM-DD）
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

    // 构建筛选条件
    const conditions = []

    // 始终排除管理员内容（userRole 不是 'admin' 或者是 null）
    conditions.push(
      or(
        ne(userGeneratedImages.userRole, 'admin'),
        isNull(userGeneratedImages.userRole)
      )
    )

    // 用户角色筛选
    if (roleFilter !== 'all') {
      if (roleFilter === 'regular') {
        // 普通用户：不是admin、subscribed、premium、oldUser
        conditions.push(
          or(
            eq(userGeneratedImages.userRole, 'regular'),
            isNull(userGeneratedImages.userRole)
          )
        )
      } else {
        conditions.push(eq(userGeneratedImages.userRole, roleFilter))
      }
    }

    // 搜索筛选（用户昵称）
    if (search.trim()) {
      conditions.push(
        like(userGeneratedImages.userNickname, `%${search.trim()}%`)
      )
    }

    // 日期范围筛选
    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      conditions.push(gte(userGeneratedImages.createdAt, start))
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      conditions.push(lte(userGeneratedImages.createdAt, end))
    }

    // 查询总数
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(userGeneratedImages)
      .where(whereClause as any)

    const total = totalResult[0]?.count || 0

    // 查询图片列表
    const images = await db
      .select({
        id: userGeneratedImages.id,
        imageUrl: userGeneratedImages.imageUrl,
        prompt: userGeneratedImages.prompt,
        model: userGeneratedImages.model,
        width: userGeneratedImages.width,
        height: userGeneratedImages.height,
        userRole: userGeneratedImages.userRole,
        userAvatar: userGeneratedImages.userAvatar,
        userNickname: userGeneratedImages.userNickname,
        avatarFrameId: userGeneratedImages.avatarFrameId,
        createdAt: userGeneratedImages.createdAt,
        userId: userGeneratedImages.userId,
      })
      .from(userGeneratedImages)
      .where(whereClause as any)
      .orderBy(desc(userGeneratedImages.createdAt))
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
      userNickname: img.userNickname || '未知用户',
      avatarFrameId: img.avatarFrameId,
      createdAt: img.createdAt?.toISOString() || new Date().toISOString(),
      userId: img.userId,
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
    console.error('Error fetching approved images:', error)
    return NextResponse.json(
      { error: '获取图片列表失败' },
      { status: 500 }
    )
  }
}

