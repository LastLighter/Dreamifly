import { moderateAvatar } from './avatarModeration'
import OpenAI from 'openai'

/**
 * 审核生成的图片
 * 复用头像审核函数
 */
export async function moderateGeneratedImage(
  imageBuffer: Buffer,
  fileName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<boolean> {
  // 复用头像审核函数
  return await moderateAvatar(imageBuffer, fileName, baseUrl, apiKey, model, prompt)
}

/**
 * 审核提示词
 * @param promptText 要审核的提示词文本
 * @param baseUrl API基础URL
 * @param apiKey API密钥
 * @param model 使用的模型名称
 * @param moderationPrompt 审核提示词模板
 * @returns 审核结果（true表示通过，false表示不通过）
 */
export async function moderatePrompt(
  promptText: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  moderationPrompt: string
): Promise<boolean> {
  try {
    // 创建OpenAI客户端
    const client = new OpenAI({
      baseURL: baseUrl,
      apiKey: apiKey || 'dummy-key', // 某些服务可能不需要key，但SDK要求非空值
    })

    // 构建审核消息，将用户提示词插入到审核模板中
    const fullPrompt = moderationPrompt.replace('{prompt}', promptText)

    // 调用API进行审核
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: fullPrompt,
        },
      ],
    })

    // 解析返回结果
    const rawResult = response.choices[0]?.message?.content?.trim()
    const result = rawResult?.toLowerCase()
    
    // 如果结果为空，默认不通过（安全起见）
    if (!result) {
      console.warn('提示词审核结果为空')
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
    console.warn('提示词审核结果不明确:', result)
    return false
  } catch (error) {
    console.error('提示词审核失败:', error)
    // 审核服务出错时，抛出错误确保审核功能正常工作
    throw new Error(`提示词审核失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}

