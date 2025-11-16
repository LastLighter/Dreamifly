import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { uploadToOSS, checkOSSConfig } from '@/utils/oss'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

export async function POST(request: Request) {
  try {
    // 检查OSS配置
    if (!checkOSSConfig()) {
      return NextResponse.json({ error: 'OSS配置不完整' }, { status: 500 })
    }

    // 验证管理员权限
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // 生成唯一文件名
    const uniqueId = uuidv4()
    const extension = file.name.split('.').pop()
    const fileName = `${uniqueId}.${extension}`

    // 将文件转换为Buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // 上传到头像框文件夹
    const fileUrl = await uploadToOSS(buffer, fileName, 'avatarFrame')

    return NextResponse.json({ url: fileUrl })
  } catch (error) {
    console.error('Error uploading avatar frame:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
}



