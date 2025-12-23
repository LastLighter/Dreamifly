import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { avatarFrame, user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { deleteFromOSS } from '@/utils/oss'

/**
 * 删除某个分类下的所有头像框
 * DELETE /api/admin/avatar-frames/categories/[category]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
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

    const { category } = await params
    const decodedCategory = decodeURIComponent(category)

    if (!decodedCategory || decodedCategory.trim() === '') {
      return NextResponse.json(
        { error: '分类名不能为空' },
        { status: 400 }
      )
    }

    // 获取该分类下的所有头像框
    const existingFrames = await db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.category, decodedCategory))

    if (existingFrames.length === 0) {
      return NextResponse.json(
        { error: '该分类下没有头像框' },
        { status: 404 }
      )
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
      .where(eq(avatarFrame.category, decodedCategory))

    return NextResponse.json({
      success: true,
      deletedCount: existingFrames.length,
      message: `已删除分类 "${decodedCategory}" 下的 ${existingFrames.length} 个头像框`
    })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除分类失败' },
      { status: 500 }
    )
  }
}

