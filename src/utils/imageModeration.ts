import { moderateAvatar } from './avatarModeration'

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

