import { NextResponse } from 'next/server'
import { db } from '@/db'
import { userGeneratedImages, user } from '@/db/schema'
import { desc, or, and, isNull, inArray, eq, notInArray } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

/**
 * 获取社区展示图片
 * 从最近600张用户生成的图片中随机选择12张
 * 过滤掉管理员和付费用户的内容
 * 排除图生图模型（Qwen-Image-Edit、Flux-Kontext）
 * 排除视频类型，只展示图片
 * 根据屏蔽词列表过滤提示词中包含屏蔽词的图片
 *
 * 访问控制：
 * - 如果环境变量 COMMUNITY_IMAGES_PUBLIC 为 true，则对所有用户开放
 * - 如果环境变量 COMMUNITY_IMAGES_PUBLIC 为 false（默认），则只对管理员开放
 *
 * 屏蔽词配置：
 * - 直接在代码中配置 JSON 数组
 * - 支持句子、短语和单个词
 *
 * 处理逻辑：
 * - 如果数据库中有0张图片，返回空数组（前端会用默认图片填充）
 * - 如果数据库中有1-12张图片，返回所有图片（前端会用默认图片填充到12张）
 * - 如果数据库中有13-600张图片，随机选择12张返回
 */

// 社区图片屏蔽词列表
const COMMUNITY_IMAGE_BLOCK_WORDS = [
  "**",
  "I'm sorry",
  "loli",
  "toddler"
];

/**
 * 简单的社区图片屏蔽词检查（不考虑单词边界，直接字符串包含检查）
 * @param text 需要检查的文本
 * @param words 屏蔽词列表
 * @returns 如果包含屏蔽词返回 true，否则返回 false
 */
function containsCommunityBlockWords(text: string, words: string[]): boolean {
  if (!text || words.length === 0) {
    return false;
  }

  // 转换为小写进行不区分大小写的匹配
  const lowerText = text.toLowerCase();

  return words.some((word) => {
    if (!word || word.trim() === '') {
      return false;
    }

    const trimmedWord = word.trim();
    // 直接使用简单的字符串包含检查，不考虑单词边界
    return lowerText.includes(trimmedWord.toLowerCase());
  });
}
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
    // 获取最近600张图片（按创建时间降序）
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
      .limit(600)

    // 获取屏蔽词列表（直接使用代码中配置的常量）
    const blockWords = COMMUNITY_IMAGE_BLOCK_WORDS

    // 根据屏蔽词过滤图片
    const filteredImages = recentImages.filter(image => {
      const prompt = image.prompt || ''

      // 过滤掉空提示词或只有空格的提示词
      if (!prompt.trim()) {
        return false
      }

      // 检查提示词是否包含屏蔽词（使用简单的字符串包含检查）
      if (blockWords.length > 0) {
        return !containsCommunityBlockWords(prompt, blockWords)
      }

      return true
    })

    // 处理图片数量
    let selectedImages = filteredImages

    if (filteredImages.length === 0) {
      // 如果没有图片，返回空数组（前端会使用默认图片）
      return NextResponse.json({
        success: true,
        images: [],
      })
    } else if (filteredImages.length <= 12) {
      // 如果图片数量少于等于12张，直接使用所有图片
      selectedImages = filteredImages
    } else {
      // 如果图片数量大于12张，随机选择12张
      const shuffled = [...filteredImages].sort(() => Math.random() - 0.5)
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

