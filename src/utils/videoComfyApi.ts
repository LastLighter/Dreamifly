import { VideoModelConfig, getVideoModelById } from './videoModelConfig';
import { generateVideoWorkflow } from './videoWorkflow';

interface ComfyUIResponse {
  video?: string;  // 视频 base64 或 URL
  images?: string[]; // 如果返回的是帧序列
}

interface GenerateVideoParams {
  prompt: string;
  width: number;
  height: number;
  length?: number;
  fps?: number;
  seed?: number;
  steps?: number;
  model: string;
  image?: string; // 输入图片（base64，用于 I2V）
  negative_prompt?: string;
}

export async function generateVideo(params: GenerateVideoParams): Promise<string> {
  // 获取模型配置
  const modelConfig = getVideoModelById(params.model);
  if (!modelConfig) {
    throw new Error(`视频模型 ${params.model} 未找到`);
  }

  // 生成工作流
  const workflow = generateVideoWorkflow(modelConfig, {
    prompt: params.prompt,
    negativePrompt: params.negative_prompt,
    width: params.width,
    height: params.height,
    length: params.length || modelConfig.defaultLength || 100,
    fps: params.fps || modelConfig.defaultFps || 20,
    seed: params.seed,
    steps: params.steps || 4,
    imagePath: params.image, // 如果是 base64，ComfyUI 可能需要特殊处理
  });

  // 获取模型对应的 ComfyUI 服务 URL
  let baseUrl = '';
  if (params.model === 'Wan2.2-I2V-Lightning') {
    baseUrl = process.env.WAN_I2V_URL || '';
  }
  // 可以添加更多模型的环境变量映射

  // 检查 baseUrl 是否配置
  if (!baseUrl) {
    throw new Error(`视频模型 ${params.model} 的服务URL未配置，请检查环境变量 WAN_I2V_URL`);
  }

  // 规范化 baseUrl（移除末尾斜杠）
  baseUrl = baseUrl.replace(/\/+$/, '');

  try {
    // 发送提示请求并等待响应
    const apiEndpoint = `${baseUrl}/prompt`;
    const requestBody = { prompt: workflow };
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // 检查HTTP响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${params.model}] 视频生成 API 错误响应:`, {
        status: response.status,
        statusText: response.statusText,
        url: apiEndpoint,
        error: errorText
      });
      
      // 如果是 404 错误，提供更详细的提示
      if (response.status === 404) {
        throw new Error(`API 端点不存在 (404): ${apiEndpoint}。请检查 ${params.model} 的服务URL配置是否正确，确保指向正确的 ComfyUI 服务地址`);
      }
      
      // 如果是 503 错误，提供连接相关的提示
      if (response.status === 503) {
        throw new Error(`ComfyUI服务不可用 (503): ${errorText || '无法连接到服务'}。请检查 ${params.model} 的服务是否正在运行，以及环境变量 WAN_I2V_URL 配置是否正确`);
      }
      
      throw new Error(`ComfyUI服务错误 (${response.status}): ${errorText || '未知错误'}`);
    }

    let videoUrl: string = '';
    let text = '';
    try {
      text = await response.text();
      
      // 检查响应是否为"no healthy upstream"错误
      if (text.includes('no healthy upstream') || text.includes('upstream')) {
        throw new Error(`ComfyUI服务不可用: ${text}。请检查服务是否正常运行`);
      }
      
      const data = JSON.parse(text) as ComfyUIResponse;
      
      // 检查响应数据格式
      // 视频可能以 base64 格式返回，或者返回视频 URL
      if (data.video) {
        // 如果返回的是 base64，添加 data:video 前缀
        if (data.video.startsWith('data:video')) {
          videoUrl = data.video;
        } else {
          videoUrl = `data:video/mp4;base64,${data.video}`;
        }
      } else if (data.images && data.images.length > 0) {
        // 如果返回的是帧序列，可能需要组合成视频
        // 这里先返回第一帧作为占位符，实际应该组合成视频
        videoUrl = `data:image/png;base64,${data.images[0]}`;
      } else {
        throw new Error(`无效的响应格式: 缺少视频数据`);
      }
    } catch (parseError) {
      // 如果已经是Error对象，直接抛出
      if (parseError instanceof Error) {
        throw parseError;
      }
      // 否则包装为错误
      throw new Error(`无法解析ComfyUI响应: ${text.substring(0, 200)}`);
    }

    return videoUrl;
  } catch (error) {
    console.error('Error generating video:', error);
    // 如果是网络错误，提供更友好的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`无法连接到ComfyUI服务 (${baseUrl})。请检查服务是否正常运行`);
    }
    throw error;
  }
}

