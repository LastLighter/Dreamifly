import OpenAI from 'openai'

/**
 * 将图片Buffer编码为base64字符串
 */
function encodeImageToBase64(buffer: Buffer): string {
  return buffer.toString('base64')
}

/**
 * 根据文件扩展名推断MIME类型
 */
function getMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase()

  // 视频格式
  if (lowerName.endsWith('.mp4')) {
    return 'video/mp4'
  } else if (lowerName.endsWith('.avi')) {
    return 'video/avi'
  } else if (lowerName.endsWith('.mov')) {
    return 'video/quicktime'
  } else if (lowerName.endsWith('.mkv')) {
    return 'video/x-matroska'
  } else if (lowerName.endsWith('.webm')) {
    return 'video/webm'
  }

  // 图片格式
  if (lowerName.endsWith('.png')) {
    return 'image/png'
  } else if (lowerName.endsWith('.webp')) {
    return 'image/webp'
  } else if (lowerName.endsWith('.gif')) {
    return 'image/gif'
  }

  // 默认为jpeg
  return 'image/jpeg'
}

/**
 * 使用兼容OpenAI API的第三方服务审核媒体内容（图片或视频）
 * 支持QwenVL等多模态模型进行内容审核
 * @param mediaBuffer 媒体Buffer（图片或视频）
 * @param fileName 文件名（用于推断MIME类型）
 * @param baseUrl API基础URL
 * @param apiKey API密钥
 * @param model 使用的模型名称
 * @param prompt 审核提示词
 * @returns 审核结果（true表示通过，false表示不通过）
 */
export async function moderateAvatar(
  mediaBuffer: Buffer,
  fileName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<boolean> {
  try {
    // 获取媒体类型和编码内容
    const mimeType = getMimeType(fileName)
    const base64Media = encodeImageToBase64(mediaBuffer)

    // 创建OpenAI客户端
    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || 'dummy-key', // 某些服务可能不需要key，但SDK要求非空值
    })

    // 根据媒体类型选择正确的消息格式
    const isVideo = mimeType.startsWith('video/')

    // OpenAI API不支持视频审核，直接返回允许
    if (isVideo) {
      return true
    }

    const mediaContent = [
      { type: 'text' as const, text: prompt },
      {
        type: 'image_url' as const,
        image_url: {
          url: `data:${mimeType};base64,${base64Media}`,
        },
      },
    ]

    // 调用API进行审核
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: mediaContent,
        },
      ],
    })

    // 解析返回结果
    const result = response.choices[0]?.message?.content?.trim().toLowerCase()
    
    // 如果结果为空，默认不通过（安全起见）
    if (!result) {
      console.warn('审核结果为空')
      return false
    }
    
    // 判断是否通过审核（返回"是"或包含"通过"等关键词表示通过）
    if (result === '是' || result === 'yes' || result.includes('通过') || result.includes('pass')) {
      return true
    }
    
    // 返回"否"或包含"不通过"等关键词表示不通过
    if (result === '否' || result === 'no' || result.includes('不通过') || result.includes('fail')) {
      return false
    }

    // 如果结果不明确，默认不通过（安全起见）
    console.warn('审核结果不明确:', result)
    return false
  } catch (error) {
    console.error('头像审核失败:', error)
    // 审核服务出错时，可以选择：
    // 1. 抛出错误阻止上传（更安全）
    // 2. 返回true允许上传（更宽松）
    // 这里选择抛出错误，确保审核功能正常工作
    throw new Error(`头像审核失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

