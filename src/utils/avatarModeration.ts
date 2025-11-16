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
 * 使用兼容OpenAI API的第三方服务审核头像图片
 * @param imageBuffer 图片Buffer
 * @param fileName 文件名（用于推断MIME类型）
 * @param baseUrl API基础URL
 * @param apiKey API密钥
 * @param model 使用的模型名称
 * @param prompt 审核提示词
 * @returns 审核结果（true表示通过，false表示不通过）
 */
export async function moderateAvatar(
  imageBuffer: Buffer,
  fileName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<boolean> {
  try {
    // 编码图片为base64
    const mimeType = getMimeType(fileName)
    const base64Image = encodeImageToBase64(imageBuffer)

    // 创建OpenAI客户端
    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || 'dummy-key', // 某些服务可能不需要key，但SDK要求非空值
    })

    // 调用API进行审核
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
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

