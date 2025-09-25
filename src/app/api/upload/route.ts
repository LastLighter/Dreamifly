import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  try {
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

    // 确保上传目录存在
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    const filePath = join(uploadDir, fileName)

    // 将文件写入磁盘
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // 返回相对路径
    const fileUrl = `/uploads/${fileName}`
    return NextResponse.json({ url: fileUrl })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file' },
      { status: 500 }
    )
  }
} 