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

    const body = await request.json()
    const imageUrl = body.url as string
    
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'URL不能为空' }, { status: 400 })
    }

    // 验证URL格式
    let url: URL
    try {
      url = new URL(imageUrl)
    } catch {
      return NextResponse.json({ error: '无效的URL格式' }, { status: 400 })
    }

    // 只允许http和https协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      return NextResponse.json({ error: '只支持HTTP和HTTPS协议' }, { status: 400 })
    }

    // 下载图片
    let response: Response
    try {
      response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        // 设置超时（30秒）
        signal: AbortSignal.timeout(30000),
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return NextResponse.json({ error: '下载超时，请检查URL是否可访问' }, { status: 408 })
      }
      return NextResponse.json({ error: '下载失败，请检查URL是否可访问' }, { status: 400 })
    }

    if (!response.ok) {
      return NextResponse.json({ error: `下载失败: ${response.status} ${response.statusText}` }, { status: 400 })
    }

    // 检查Content-Type
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'URL指向的不是图片文件' }, { status: 400 })
    }

    // 获取图片数据
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 验证文件大小（最大 10MB）
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
    }

    // 从Content-Type或URL中获取文件扩展名
    let extension = 'png' // 默认扩展名
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      extension = 'jpg'
    } else if (contentType.includes('png')) {
      extension = 'png'
    } else if (contentType.includes('gif')) {
      extension = 'gif'
    } else if (contentType.includes('webp')) {
      extension = 'webp'
    } else {
      // 尝试从URL中提取扩展名
      const urlPath = url.pathname.toLowerCase()
      const match = urlPath.match(/\.(jpg|jpeg|png|gif|webp)$/)
      if (match) {
        extension = match[1].replace('jpeg', 'jpg')
      }
    }

    // 生成唯一文件名
    const uniqueId = uuidv4()
    const fileName = `${uniqueId}.${extension}`

    // 上传到OSS
    const fileUrl = await uploadToOSS(buffer, fileName, 'avatarFrame')

    return NextResponse.json({ url: fileUrl })
  } catch (error) {
    console.error('Error uploading avatar frame from URL:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '上传失败' },
      { status: 500 }
    )
  }
}

