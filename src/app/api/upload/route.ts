import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { uploadToOSS, deleteFromOSS, checkOSSConfig } from '@/utils/oss'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'

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

    // 获取用户当前头像
    const currentUser = await db
      .select({ avatar: user.avatar })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1)

    const currentAvatar = currentUser[0]?.avatar

    // 如果当前头像是OSS文件（不是默认头像），则删除它
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

    // 生成唯一文件名
    const uniqueId = uuidv4()
    const extension = file.name.split('.').pop()
    const fileName = `${uniqueId}.${extension}`

    // 将文件转换为Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 上传到OSS
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