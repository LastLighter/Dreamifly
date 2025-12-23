import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { rejectedImages, user } from '@/db/schema'
import { eq, desc, and, or, like, gte, lte, sql, isNull, isNotNull } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * 获取未通过审核的图片列表（管理员专用）
 * 查询参数：
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 * - role: 用户角色筛选（subscribed, premium, oldUser, regular, all）
 * - search: 搜索关键词（用户昵称）
 * - startTime: 开始时间（ISO 8601 UTC 格式，精确到分钟）
 * - endTime: 结束时间（ISO 8601 UTC 格式，精确到分钟）
 * - reason: 拒绝原因筛选（image, prompt, both, all）
 * - model: 模型筛选（模型ID，all表示全部）
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
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')
    const reasonFilter = searchParams.get('reason') || 'all'
    const modelFilter = searchParams.get('model') || 'all'

    // 构建筛选条件
    const conditions = []

    // 用户角色筛选（基于user表的实时数据）
    if (roleFilter !== 'all') {
      if (roleFilter === 'subscribed') {
        // 订阅用户：isSubscribed = true 且 subscriptionExpiresAt > NOW()
        conditions.push(
          and(
            isNotNull(rejectedImages.userId),
            eq(user.isSubscribed, true),
            sql`${user.subscriptionExpiresAt} > NOW()`
          )
        )
      } else if (roleFilter === 'premium') {
        // 优质用户：isPremium = true
        conditions.push(
          and(
            isNotNull(rejectedImages.userId),
            eq(user.isPremium, true)
          )
        )
      } else if (roleFilter === 'oldUser') {
        // 首批用户：isOldUser = true
        conditions.push(
          and(
            isNotNull(rejectedImages.userId),
            eq(user.isOldUser, true)
          )
        )
      } else if (roleFilter === 'regular') {
        // 普通用户：不是管理员、不是订阅用户、不是优质用户、不是首批用户
        conditions.push(
          or(
            isNull(rejectedImages.userId), // 未登录用户
            and(
              isNotNull(rejectedImages.userId),
              eq(user.isAdmin, false),
              or(
                eq(user.isSubscribed, false),
                sql`${user.subscriptionExpiresAt} <= NOW()`,
                isNull(user.subscriptionExpiresAt)
              ),
              eq(user.isPremium, false),
              eq(user.isOldUser, false)
            )
          )
        )
      }
    }

    // 拒绝原因筛选
    if (reasonFilter !== 'all') {
      conditions.push(eq(rejectedImages.rejectionReason, reasonFilter))
    }

    // 模型筛选
    if (modelFilter !== 'all' && modelFilter.trim()) {
      conditions.push(eq(rejectedImages.model, modelFilter.trim()))
    }

    // 搜索筛选（用户昵称）- 使用user表的nickname字段
    if (search.trim()) {
      conditions.push(
        and(
          isNotNull(rejectedImages.userId), // 只搜索已登录用户
          like(user.nickname, `%${search.trim()}%`)
        )
      )
    }

    // 时间范围筛选（UTC 时间，精确到分钟）
    if (startTime) {
      const start = new Date(startTime)
      // 确保精确到分钟（秒和毫秒设为0）
      start.setUTCSeconds(0, 0)
      conditions.push(gte(rejectedImages.createdAt, start))
    }
    if (endTime) {
      const end = new Date(endTime)
      // 结束时间包含该分钟的最后时刻（59秒999毫秒）
      end.setUTCSeconds(59, 999)
      conditions.push(lte(rejectedImages.createdAt, end))
    }

    // 查询总数（使用LEFT JOIN）
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(rejectedImages)
      .leftJoin(user, eq(rejectedImages.userId, user.id))
      .where(whereClause as any)

    const total = totalResult[0]?.count || 0

    // 查询图片列表（使用LEFT JOIN获取实时用户信息）
    const images = await db
      .select({
        id: rejectedImages.id,
        imageUrl: rejectedImages.imageUrl,
        prompt: rejectedImages.prompt,
        model: rejectedImages.model,
        width: rejectedImages.width,
        height: rejectedImages.height,
        rejectionReason: rejectedImages.rejectionReason,
        createdAt: rejectedImages.createdAt,
        userId: rejectedImages.userId,
        ipAddress: rejectedImages.ipAddress,
        // 从user表获取实时信息
        userIsAdmin: user.isAdmin,
        userIsSubscribed: user.isSubscribed,
        userSubscriptionExpiresAt: user.subscriptionExpiresAt,
        userIsPremium: user.isPremium,
        userIsOldUser: user.isOldUser,
        userAvatar: user.avatar,
        userNickname: user.nickname,
        userAvatarFrameId: user.avatarFrameId,
      })
      .from(rejectedImages)
      .leftJoin(user, eq(rejectedImages.userId, user.id))
      .where(whereClause as any)
      .orderBy(desc(rejectedImages.createdAt))
      .limit(limit)
      .offset(offset)

    // 格式化返回数据（根据实时用户信息计算用户角色）
    const formattedImages = images.map(img => {
      // 计算用户角色（基于实时用户数据）
      let userRole: 'admin' | 'subscribed' | 'premium' | 'oldUser' | 'regular' = 'regular'
      
      if (img.userId && img.userIsAdmin) {
        userRole = 'admin'
      } else if (img.userId && img.userIsSubscribed && img.userSubscriptionExpiresAt && new Date(img.userSubscriptionExpiresAt) > new Date()) {
        userRole = 'subscribed'
      } else if (img.userId && img.userIsPremium) {
        userRole = 'premium'
      } else if (img.userId && img.userIsOldUser) {
        userRole = 'oldUser'
      } else {
        userRole = 'regular'
      }

      return {
        id: img.id,
        imageUrl: img.imageUrl,
        prompt: img.prompt,
        model: img.model,
        width: img.width,
        height: img.height,
        userRole,
        userAvatar: img.userAvatar || '/images/default-avatar.svg',
        userNickname: img.userNickname || (img.userId ? '未知用户' : '未登录用户'),
        avatarFrameId: img.userAvatarFrameId,
        rejectionReason: img.rejectionReason || 'image',
        createdAt: img.createdAt?.toISOString() || new Date().toISOString(),
        userId: img.userId,
        ipAddress: img.ipAddress,
      }
    })

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

