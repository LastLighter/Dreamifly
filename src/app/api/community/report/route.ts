import { NextResponse } from 'next/server'
import { db } from '@/db'
import { user, imageReports, userGeneratedImages } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { v4 as uuidv4 } from 'uuid'

/**
 * 举报社区图片 API
 * 允许优质用户和管理员举报不当内容
 *
 * 请求格式：
 * POST /api/community/report
 * Body: {
 *   imageId: string,      // 被举报的图片ID
 *   reason: string,       // 举报原因：pornography, political, violence, gore, illegal, other
 *   description?: string  // 详细描述（选择"其他"时可填写）
 * }
 *
 * 权限要求：
 * - 用户必须登录
 * - 用户必须是优质用户（isPremium=true）或管理员（isAdmin=true）
 *
 * 处理逻辑：
 * 1. 验证用户登录状态
 * 2. 验证用户权限（优质用户或管理员）
 * 3. 验证请求参数
 * 4. 验证图片是否存在且未被删除
 * 5. 插入举报记录到 image_reports 表
 * 6. 更新图片的 nsfw 字段为 true
 * 7. 返回成功响应
 */

// 举报原因选项
const VALID_REPORT_REASONS = [
  'pornography', // 色情内容
  'political',   // 政治敏感
  'violence',    // 暴力恐怖
  'gore',        // 血腥恶心
  'illegal',     // 违法违规
  'other',       // 其他
] as const

type ReportReason = typeof VALID_REPORT_REASONS[number]

export async function POST(request: Request) {
  try {
    // 1. 验证用户登录状态
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: '请先登录'
        },
        { status: 401 }
      )
    }

    // 2. 获取用户权限信息
    const currentUser = await db.select({
      isAdmin: user.isAdmin,
      isPremium: user.isPremium
    })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    if (currentUser.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '用户不存在'
        },
        { status: 404 }
      )
    }

    // 3. 验证用户权限（必须是优质用户或管理员）
    const userData = currentUser[0]
    const hasPermission = userData.isPremium || userData.isAdmin

    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: '无权限举报，只有优质用户或管理员可以使用举报功能'
        },
        { status: 403 }
      )
    }

    // 4. 解析请求体
    const body = await request.json()
    const { imageId, reason, description } = body

    // 5. 验证请求参数
    if (!imageId || typeof imageId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少或无效的图片ID'
        },
        { status: 400 }
      )
    }

    if (!reason || typeof reason !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少举报原因'
        },
        { status: 400 }
      )
    }

    if (!VALID_REPORT_REASONS.includes(reason as ReportReason)) {
      return NextResponse.json(
        {
          success: false,
          error: '无效的举报原因'
        },
        { status: 400 }
      )
    }

    // 如果选择"其他"，必须提供描述
    if (reason === 'other' && (!description || description.trim() === '')) {
      return NextResponse.json(
        {
          success: false,
          error: '选择"其他"时必须填写详细描述'
        },
        { status: 400 }
      )
    }

    // 6. 验证图片是否存在且未被删除
    const imageExists = await db.select({ id: userGeneratedImages.id })
      .from(userGeneratedImages)
      .where(eq(userGeneratedImages.id, imageId))
      .limit(1)

    if (imageExists.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '图片不存在或已被删除'
        },
        { status: 404 }
      )
    }

    // 7. 使用数据库事务确保数据一致性
    const reportId = uuidv4()

    await db.transaction(async (tx) => {
      // 7.1 插入举报记录
      await tx.insert(imageReports).values({
        id: reportId,
        reporterId: session.user.id,
        imageId: imageId,
        reason: reason,
        description: description || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // 7.2 更新图片的 nsfw 字段为 true
      await tx.update(userGeneratedImages)
        .set({
          nsfw: true,
          updatedAt: new Date(),
        })
        .where(eq(userGeneratedImages.id, imageId))
    })

    // 8. 返回成功响应
    return NextResponse.json({
      success: true,
      message: '举报成功，图片已被标记为不适合展示'
    })

  } catch (error) {
    console.error('举报图片失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: '举报失败，请稍后重试'
      },
      { status: 500 }
    )
  }
}