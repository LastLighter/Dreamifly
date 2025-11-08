import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { uploadToOSS, deleteFromOSS, checkOSSConfig } from '@/utils/oss'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { moderateAvatar } from '@/utils/avatarModeration'

export async function POST(request: Request) {
  try {
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return NextResponse.json({ error: 'OSS配置不完整' }, { status: 500 })
    }

    // 验证用户身份
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    // 获取用户当前头像（先获取信息，但不删除，等审核通过后再删除）
    const currentUser = await db
      .select({ avatar: user.avatar })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    const currentAvatar = currentUser[0]?.avatar

    // 生成唯一文件名
    const uniqueId = uuidv4()
    const extension = file.name.split('.').pop()
    const fileName = `${uniqueId}.${extension}`

    // 将文件转换为Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 头像审核（先审核，通过后再删除旧头像）
    const moderationBaseUrl = process.env.AVATAR_MODERATION_BASE_URL
    const moderationApiKey = process.env.AVATAR_MODERATION_API_KEY || ''
    const moderationModel = process.env.AVATAR_MODERATION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct-FP8'
    const moderationPrompt = process.env.AVATAR_MODERATION_PROMPT || 
      '请判断图片的内容与文字是否可以在公共场所展示，评判标准包括但不限于不应该包含"黄色"、"血腥"、"过于夸张的暴力场景"，你只需输出是或者否即可'

    // 如果配置了审核服务，则进行审核
    if (moderationBaseUrl) {
      try {
        const isApproved = await moderateAvatar(
          buffer,
          file.name,
          moderationBaseUrl,
          moderationApiKey,
          moderationModel,
          moderationPrompt
        )

        if (!isApproved) {
          return NextResponse.json(
            { error: '头像审核未通过，请上传符合规范的图片' },
            { status: 400 }
          )
        }
      } catch (error) {
        console.error('头像审核过程出错:', error)
        // 审核服务出错时，可以选择阻止上传或允许上传
        // 这里选择阻止上传以确保安全
        return NextResponse.json(
          { error: '头像审核服务暂时不可用，请稍后重试' },
          { status: 503 }
        )
      }
    }

    // 审核通过后，删除旧头像（如果存在）
    if (currentAvatar && 
        currentAvatar !== '/images/default-avatar.svg' && 
        currentAvatar.trim() !== '' &&
        currentAvatar.includes('oss')) {
      try {
        await deleteFromOSS(currentAvatar)
        console.log('已删除旧头像:', currentAvatar)
      } catch (error) {
        console.warn('删除旧头像失败:', error)
        // 不阻止新头像上传，继续执行
      }
    }

    // 上传新头像到OSS
    const fileUrl = await uploadToOSS(buffer, fileName, 'avatars')

    return NextResponse.json({ url: fileUrl })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
} 