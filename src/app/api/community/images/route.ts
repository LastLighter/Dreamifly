import { NextResponse } from 'next/server'
import { db } from '@/db'
import { userGeneratedImages, user } from '@/db/schema'
import { desc, or, and, isNull, inArray, eq, notInArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * 获取社区展示图片
 * 从最近300张用户生成的图片中随机选择12张
 * 过滤掉管理员和付费用户的内容
 * 排除图生图模型（Qwen-Image-Edit、Flux-Kontext）
 * 排除视频类型，只展示图片
 * 
 * 访问控制：
 * - 如果环境变量 COMMUNITY_IMAGES_PUBLIC 为 true，则对所有用户开放
 * - 如果环境变量 COMMUNITY_IMAGES_PUBLIC 为 false（默认），则只对管理员开放
 * 
 * 处理逻辑：
 * - 如果数据库中有0张图片，返回空数组（前端会用默认图片填充）
 * - 如果数据库中有1-12张图片，返回所有图片（前端会用默认图片填充到12张）
 * - 如果数据库中有13-300张图片，随机选择12张返回
 */
export async function GET() {
  try {
    // 检查环境变量，默认为 false（只对管理员开放）
    const isPublic = process.env.COMMUNITY_IMAGES_PUBLIC === 'true'
    
    // 如果环境变量为 false，需要验证管理员权限
    if (!isPublic) {
      const session = await auth.api.getSession({
        headers: await headers()
      })

      if (!session?.user) {
        return NextResponse.json(
          { 
            success: false,
            error: '未授权，请先登录' 
          },
          { status: 401 }
        )
      }

      const currentUser = await db.select()
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1)

      if (currentUser.length === 0 || !currentUser[0].isAdmin) {
        return NextResponse.json(
          { 
            success: false,
            error: '无权限访问，需要管理员权限' 
          },
          { status: 403 }
        )
      }
    }
    // 获取最近300张图片（按创建时间降序）
    // 通过 user_generated_images 表中的 userRole 字段过滤掉管理员和付费用户
    // 只选择：premium（优质用户）、oldUser（首批用户）、regular（普通用户）或 null（旧数据）
    // 排除图生图模型：Qwen-Image-Edit、Flux-Kontext
    // 排除视频类型，只展示图片
    const i2iModels = ['Qwen-Image-Edit', 'Flux-Kontext'] // 图生图模型列表
    
    const recentImages = await db
      .select({
        id: userGeneratedImages.id,
        imageUrl: userGeneratedImages.imageUrl,
        prompt: userGeneratedImages.prompt,
        model: userGeneratedImages.model,
        userAvatar: userGeneratedImages.userAvatar,
        userNickname: userGeneratedImages.userNickname,
        avatarFrameId: userGeneratedImages.avatarFrameId,
        createdAt: userGeneratedImages.createdAt,
      })
      .from(userGeneratedImages)
      .where(
        and(
          // 只选择图片类型，排除视频
          eq(userGeneratedImages.mediaType, 'image'),
          // 允许的角色：premium（优质用户）、oldUser（首批用户）、regular（普通用户）或 null（旧数据）
          or(
            inArray(userGeneratedImages.userRole, ['premium', 'oldUser', 'regular']),
            isNull(userGeneratedImages.userRole)
          ),
          // 排除图生图模型
          or(
            notInArray(userGeneratedImages.model, i2iModels),
            isNull(userGeneratedImages.model)
          )
        )
      )
      .orderBy(desc(userGeneratedImages.createdAt))
      .limit(300)

    // 处理图片数量
    let selectedImages = recentImages
    
    if (recentImages.length === 0) {
      // 如果没有图片，返回空数组（前端会使用默认图片）
      return NextResponse.json({
        success: true,
        images: [],
      })
    } else if (recentImages.length <= 12) {
      // 如果图片数量少于等于12张，直接使用所有图片
      selectedImages = recentImages
    } else {
      // 如果图片数量大于12张，随机选择12张
      const shuffled = [...recentImages].sort(() => Math.random() - 0.5)
      selectedImages = shuffled.slice(0, 12)
    }

    return NextResponse.json({
      success: true,
      images: selectedImages.map((img) => ({
        id: img.id, // 使用数据库中的实际ID
        image: img.imageUrl,
        prompt: img.prompt || '',
        model: img.model || '',
        userAvatar: img.userAvatar || '/images/default-avatar.svg',
        userNickname: img.userNickname || '',
        avatarFrameId: img.avatarFrameId,
      })),
    })
  } catch (error) {
    console.error('Error fetching community images:', error)
    return NextResponse.json(
      { 
        success: false,
        error: '获取社区图片失败' 
      },
      { status: 500 }
    )
  }
}

