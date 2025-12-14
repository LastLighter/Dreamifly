import { NextResponse } from 'next/server'
import { db } from '@/db'
import { userGeneratedImages } from '@/db/schema'
import { desc, or, isNull, inArray } from 'drizzle-orm'

/**
 * 获取社区展示图片
 * 从最近100张用户生成的图片中随机选择12张
 * 过滤掉管理员和付费用户的内容
 * 
 * 处理逻辑：
 * - 如果数据库中有0张图片，返回空数组（前端会用默认图片填充）
 * - 如果数据库中有1-12张图片，返回所有图片（前端会用默认图片填充到12张）
 * - 如果数据库中有13-100张图片，随机选择12张返回
 */
export async function GET() {
  try {
    // 获取最近100张图片（按创建时间降序）
    // 通过 user_generated_images 表中的 userRole 字段过滤掉管理员和付费用户
    // 只选择：premium（优质用户）、oldUser（首批用户）、regular（普通用户）或 null（旧数据）
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
        or(
          // 允许的角色：premium（优质用户）、oldUser（首批用户）、regular（普通用户）
          inArray(userGeneratedImages.userRole, ['premium', 'oldUser', 'regular']),
          // 兼容旧数据（userRole 为 null 的情况，可能是旧数据）
          isNull(userGeneratedImages.userRole)
        )
      )
      .orderBy(desc(userGeneratedImages.createdAt))
      .limit(100)

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

