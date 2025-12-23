import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { avatarFrame, user } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { deleteFromOSS } from '@/utils/oss'

/**
 * 批量删除多个分类下的所有头像框
 * DELETE /api/admin/avatar-frames/categories/batch-delete
 * Body: { categories: string[] }
 */
export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const { categories } = body

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: '分类列表不能为空' },
        { status: 400 }
      )
    }

    // 验证分类名
    const validCategories = categories
      .filter((cat: any) => typeof cat === 'string' && cat.trim() !== '')
      .map((cat: string) => cat.trim())

    if (validCategories.length === 0) {
      return NextResponse.json(
        { error: '没有有效的分类名' },
        { status: 400 }
      )
    }

    // 获取这些分类下的所有头像框
    const existingFrames = await db
      .select()
      .from(avatarFrame)
      .where(inArray(avatarFrame.category, validCategories))

    if (existingFrames.length === 0) {
      return NextResponse.json({
        success: true,
        deletedCount: 0,
        deletedCategories: [],
        message: '所选分类下没有头像框'
      })
    }

    // 删除OSS中的图片文件
    const deletePromises = existingFrames
      .filter(frame => frame.imageUrl && frame.imageUrl.includes('oss'))
      .map(frame => {
        if (frame.imageUrl) {
          return deleteFromOSS(frame.imageUrl).catch(error => {
            console.warn(`删除OSS文件失败 ${frame.imageUrl}:`, error)
            // 不阻止删除记录，继续执行
            return false
          })
        }
        return Promise.resolve(false)
      })

    await Promise.all(deletePromises)

    // 删除数据库记录
    await db
      .delete(avatarFrame)
      .where(inArray(avatarFrame.category, validCategories))

    // 统计每个分类删除的数量
    const categoryStats = validCategories.map(category => {
      const count = existingFrames.filter(f => f.category === category).length
      return { category, count }
    })

    return NextResponse.json({
      success: true,
      deletedCount: existingFrames.length,
      deletedCategories: validCategories,
      categoryStats,
      message: `已删除 ${validCategories.length} 个分类下的共 ${existingFrames.length} 个头像框`
    })
  } catch (error) {
    console.error('Error batch deleting categories:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量删除分类失败' },
      { status: 500 }
    )
  }
}

