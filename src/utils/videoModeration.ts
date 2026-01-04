import { moderateAvatar } from './avatarModeration'

/**
 * 审核生成的视频
 * 注意：视频审核可能需要提取关键帧，这里先使用第一帧进行审核
 * 如果审核服务支持视频输入，可以直接传入视频Buffer
 * 
 * @param videoBuffer 视频Buffer
 * @param fileName 文件名（用于推断MIME类型）
 * @param baseUrl API基础URL
 * @param apiKey API密钥
 * @param model 使用的模型名称
 * @param prompt 审核提示词
 * @returns 审核结果（true表示通过，false表示不通过）
 */
export async function moderateGeneratedVideo(
  videoBuffer: Buffer,
  fileName: string,
  baseUrl: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<boolean> {
  // 使用QwenVL进行视频审核
  // QwenVL支持直接处理视频内容，无需提取关键帧

  try {
    // 直接使用视频Buffer进行审核（QwenVL支持视频输入）
    console.log(`开始审核视频文件: ${fileName}, 大小: ${videoBuffer.length} bytes`)
    const result = await moderateAvatar(videoBuffer, fileName, baseUrl, apiKey, model, prompt)
    console.log(`视频审核完成: ${fileName}, 结果: ${result ? '通过' : '未通过'}`)
    return result
  } catch (error) {
    console.error('视频审核失败:', error)
    // 审核服务出错时，为了安全起见，默认不通过
    // 在生产环境中可以根据需求调整策略
    return false
  }
}

