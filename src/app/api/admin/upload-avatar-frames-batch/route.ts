import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { uploadToOSS, checkOSSConfig } from '@/utils/oss'
import { auth } from '@/lib/auth'
import { db } from '@/db'
import { avatarFrame, user } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { headers } from 'next/headers'

interface FileInfo {
  file: File
  category: string
  fileName: string
}

/**
 * 从文件路径中提取专栏名（子文件夹名）
 * 例如: 
 * - "专栏A/头像1.jpg" -> "专栏A"
 * - "专栏A/头像1.png" -> "专栏A"
 * - "父文件夹/专栏A/头像1.png" -> "专栏A" (取倒数第二个部分)
 */
function extractCategoryFromPath(filePath: string): string {
  const parts = filePath.split('/').filter(p => p.trim() !== '')
  
  if (parts.length === 0) {
    return '未分类'
  }
  
  // 如果路径只有一个部分，可能是直接的文件名，返回未分类
  if (parts.length === 1) {
    return '未分类'
  }
  
  // 取倒数第二个部分作为专栏名（最后一个部分是文件名）
  // 例如: ["父文件夹", "专栏A", "头像1.png"] -> "专栏A"
  return parts[parts.length - 2] || '未分类'
}

/**
 * 从URL中提取文件名（不含扩展名）
 * 例如: "https://example.com/path/avatar.jpg" -> "avatar"
 * 或者从完整路径中提取: "专栏A/avatar.png" -> "avatar"
 * 支持所有图片格式：jpg, jpeg, png, gif, webp, svg, bmp 等
 */
function extractFileNameWithoutExt(pathOrUrl: string): string {
  // 如果是URL，提取路径部分
  let path = pathOrUrl
  try {
    const url = new URL(pathOrUrl)
    path = url.pathname
  } catch {
    // 不是URL，直接使用原路径
  }
  
  // 获取文件名（不含路径）
  const fileName = path.split('/').pop() || path
  // 移除扩展名
  const nameWithoutExt = fileName.split('.').slice(0, -1).join('.')
  return nameWithoutExt || fileName
}

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
    const files: FileInfo[] = []

    // 解析所有文件，按专栏分组
    // 前端会发送 file_0, path_0, file_1, path_1 这样的格式
    const fileMap = new Map<number, File>()
    const pathMap = new Map<number, string>()

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('file_')) {
        const index = parseInt(key.replace('file_', ''), 10)
        if (value instanceof File) {
          fileMap.set(index, value)
        }
      } else if (key.startsWith('path_')) {
        const index = parseInt(key.replace('path_', ''), 10)
        if (typeof value === 'string') {
          pathMap.set(index, value)
        }
      }
    }

    // 组合文件和路径信息
    for (const [index, file] of fileMap.entries()) {
      const filePath = pathMap.get(index) || file.name
      const category = extractCategoryFromPath(filePath)
      const fileName = extractFileNameWithoutExt(filePath)
      
      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        continue // 跳过非图片文件
      }

      // 验证文件大小（最大 10MB）
      if (file.size > 10 * 1024 * 1024) {
        continue // 跳过过大的文件
      }

      files.push({
        file,
        category,
        fileName
      })
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: '没有有效的图片文件' },
        { status: 400 }
      )
    }

    const results = {
      success: 0,
      updated: 0,
      created: 0,
      failed: 0,
      errors: [] as string[]
    }

    // 按专栏分组处理
    const categoryGroups = new Map<string, FileInfo[]>()
    for (const fileInfo of files) {
      if (!categoryGroups.has(fileInfo.category)) {
        categoryGroups.set(fileInfo.category, [])
      }
      categoryGroups.get(fileInfo.category)!.push(fileInfo)
    }

    // 处理每个专栏
    for (const [category, fileInfos] of categoryGroups.entries()) {
      console.log(`📁 处理分类 "${category}": 待处理文件 ${fileInfos.length} 个`)

      // 处理该专栏下的每个文件
      for (let fileIndex = 0; fileIndex < fileInfos.length; fileIndex++) {
        const fileInfo = fileInfos[fileIndex]
        try {
          // 将文件转换为Buffer
          const bytes = await fileInfo.file.arrayBuffer()
          const buffer = Buffer.from(bytes)

          // 生成唯一文件名（保留原扩展名）
          const uniqueId = uuidv4()
          const originalName = fileInfo.file.name
          const lastDotIndex = originalName.lastIndexOf('.')
          const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex + 1).toLowerCase() : ''
          // 如果没有扩展名，根据MIME类型推断
          let finalExtension = extension
          if (!finalExtension && fileInfo.file.type) {
            const mimeToExt: Record<string, string> = {
              'image/jpeg': 'jpg',
              'image/jpg': 'jpg',
              'image/png': 'png',
              'image/gif': 'gif',
              'image/webp': 'webp',
              'image/svg+xml': 'svg',
              'image/bmp': 'bmp',
              'image/tiff': 'tiff',
              'image/x-icon': 'ico'
            }
            finalExtension = mimeToExt[fileInfo.file.type] || 'jpg'
          }
          const fileName = finalExtension ? `${uniqueId}.${finalExtension}` : `${uniqueId}.jpg`

          // 上传到OSS
          const fileUrl = await uploadToOSS(buffer, fileName, 'avatarFrame')

          // 直接创建新记录（不再使用按索引匹配的逻辑，因为分批上传时索引会错乱）
          // 如果用户需要替换现有记录，应该先删除分类再上传
          const [newFrame] = await db
            .insert(avatarFrame)
            .values({
              category: category.trim(),
              imageUrl: fileUrl
            })
            .returning()

          if (newFrame) {
            results.created++
            results.success++
            console.log(`✓ 创建成功: ${fileInfo.category}/${fileInfo.file.name} -> ID: ${newFrame.id}`)
          } else {
            throw new Error('创建记录失败：数据库未返回新记录')
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误'
          console.error(`❌ 处理文件失败: ${fileInfo.category}/${fileInfo.file.name}`, {
            分类: fileInfo.category,
            文件名: fileInfo.file.name,
            文件大小: `${(fileInfo.file.size / 1024).toFixed(2)}KB`,
            错误信息: errorMessage,
            错误详情: error
          })
          results.failed++
          results.errors.push(`${fileInfo.category}/${fileInfo.file.name}: ${errorMessage}`)
        }
      }
    }

    // 打印最终统计
    const totalProcessed = results.success + results.failed
    console.log('📊 批量上传统计:', {
      接收文件数: files.length,
      处理文件数: totalProcessed,
      成功: results.success,
      创建: results.created,
      失败: results.failed,
      未处理: files.length - totalProcessed
    })
    
    if (results.failed > 0) {
      console.error('❌ 失败的文件列表:')
      results.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`)
      })
    }
    
    if (files.length !== totalProcessed) {
      console.warn(`⚠️ 警告: 接收了 ${files.length} 个文件，但只处理了 ${totalProcessed} 个，可能有 ${files.length - totalProcessed} 个文件未被处理`)
    }

    return NextResponse.json({
      message: '批量上传完成',
      results: {
        total: files.length,
        success: results.success,
        created: results.created,
        updated: results.updated,
        failed: results.failed,
        errors: results.errors
      }
    })
  } catch (error) {
    console.error('Error uploading avatar frames batch:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量上传失败' },
      { status: 500 }
    )
  }
}

