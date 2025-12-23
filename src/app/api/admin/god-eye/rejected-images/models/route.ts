import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { rejectedImages, user } from '@/db/schema'
import { eq, sql, isNotNull } from 'drizzle-orm'
import { headers } from 'next/headers'

/**
 * 获取未通过审核图片中使用的所有模型列表（管理员专用）
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

    // 查询所有不重复的模型
    const models = await db
      .select({
        model: rejectedImages.model,
      })
      .from(rejectedImages)
      .where(isNotNull(rejectedImages.model))
      .groupBy(rejectedImages.model)

    // 提取模型ID并排序
    const modelList = models
      .map(m => m.model)
      .filter((model): model is string => model !== null)
      .sort()

    return NextResponse.json({
      success: true,
      models: modelList,
    })
  } catch (error) {
    console.error('Error fetching models:', error)
    return NextResponse.json(
      { error: '获取模型列表失败' },
      { status: 500 }
    )
  }
}

