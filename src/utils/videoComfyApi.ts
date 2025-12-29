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
  const requestStartTime = Date.now();
  console.log(`[视频生成] 开始生成视频 - 模型: ${params.model}, 时间: ${new Date().toISOString()}`);
  
  // 获取模型配置
  const modelConfig = getVideoModelById(params.model);
  if (!modelConfig) {
    console.error(`[视频生成] 模型配置未找到: ${params.model}`);
    throw new Error(`视频模型 ${params.model} 未找到`);
  }
  console.log(`[视频生成] 模型配置加载成功:`, {
    model: params.model,
    defaultLength: modelConfig.defaultLength,
    defaultFps: modelConfig.defaultFps,
  });

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
  console.log(`[视频生成] 工作流生成完成, 参数:`, {
    width: params.width,
    height: params.height,
    length: params.length || modelConfig.defaultLength || 100,
    fps: params.fps || modelConfig.defaultFps || 20,
    steps: params.steps || 4,
    hasImage: !!params.image,
    promptLength: params.prompt?.length || 0,
  });

  // 获取模型对应的 ComfyUI 服务 URL
  let baseUrl = '';
  if (params.model === 'Wan2.2-I2V-Lightning') {
    baseUrl = process.env.WAN_I2V_URL || '';
    console.log(`[视频生成] 环境变量 WAN_I2V_URL:`, baseUrl ? `${baseUrl.substring(0, 30)}...` : '未配置');
  }
  // 可以添加更多模型的环境变量映射

  // 检查 baseUrl 是否配置
  if (!baseUrl) {
    console.error(`[视频生成] 服务URL未配置 - 模型: ${params.model}, 环境变量: WAN_I2V_URL`);
    throw new Error(`视频模型 ${params.model} 的服务URL未配置，请检查环境变量 WAN_I2V_URL`);
  }

  // 规范化 baseUrl（移除末尾斜杠）
  baseUrl = baseUrl.replace(/\/+$/, '');
  console.log(`[视频生成] 使用服务URL: ${baseUrl}`);

  try {
    // 发送提示请求并等待响应
    const apiEndpoint = `${baseUrl}/prompt`;
    const requestBody = { prompt: workflow };
    const fetchStartTime = Date.now();
    
    console.log(`[视频生成] 准备发送请求到: ${apiEndpoint}`);
    console.log(`[视频生成] 请求体大小: ${JSON.stringify(requestBody).length} 字节`);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`[视频生成] 收到响应 - 状态: ${response.status} ${response.statusText}, 耗时: ${fetchDuration}ms`);

    // 检查HTTP响应状态
    if (!response.ok) {
      const errorText = await response.text();
      const totalDuration = Date.now() - requestStartTime;
      
      console.error(`[视频生成] API 错误响应详情:`, {
        model: params.model,
        status: response.status,
        statusText: response.statusText,
        url: apiEndpoint,
        baseUrl: baseUrl,
        errorText: errorText.substring(0, 500), // 限制错误文本长度
        errorTextLength: errorText.length,
        fetchDuration: `${fetchDuration}ms`,
        totalDuration: `${totalDuration}ms`,
        headers: Object.fromEntries(response.headers.entries()),
      });
      
      // 如果是 404 错误，提供更详细的提示
      if (response.status === 404) {
        const error = new Error(`API 端点不存在 (404): ${apiEndpoint}。请检查 ${params.model} 的服务URL配置是否正确，确保指向正确的 ComfyUI 服务地址`);
        console.error(`[视频生成] 404错误 - 端点不存在:`, {
          endpoint: apiEndpoint,
          baseUrl: baseUrl,
          model: params.model,
        });
        throw error;
      }
      
      // 如果是 503 错误，提供连接相关的提示
      if (response.status === 503) {
        const error = new Error(`ComfyUI服务不可用 (503): ${errorText || '无法连接到服务'}。请检查 ${params.model} 的服务是否正在运行，以及环境变量 WAN_I2V_URL 配置是否正确`);
        console.error(`[视频生成] 503错误 - 服务不可用:`, {
          errorText: errorText.substring(0, 500),
          baseUrl: baseUrl,
          model: params.model,
        });
        throw error;
      }
      
      const error = new Error(`ComfyUI服务错误 (${response.status}): ${errorText || '未知错误'}`);
      console.error(`[视频生成] HTTP错误 (${response.status}):`, {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500),
      });
      throw error;
    }

    let videoUrl: string = '';
    let text = '';
    try {
      const textStartTime = Date.now();
      text = await response.text();
      const textDuration = Date.now() - textStartTime;
      console.log(`[视频生成] 响应文本获取完成 - 大小: ${text.length} 字节, 耗时: ${textDuration}ms`);
      
      // 检查响应是否为"no healthy upstream"错误
      if (text.includes('no healthy upstream') || text.includes('upstream')) {
        console.error(`[视频生成] 检测到上游服务错误:`, {
          text: text.substring(0, 500),
          hasUpstream: text.includes('upstream'),
          hasNoHealthy: text.includes('no healthy upstream'),
        });
        throw new Error(`ComfyUI服务不可用: ${text.substring(0, 200)}。请检查服务是否正常运行`);
      }
      
      console.log(`[视频生成] 开始解析JSON响应...`);
      const parseStartTime = Date.now();
      const data = JSON.parse(text) as ComfyUIResponse;
      const parseDuration = Date.now() - parseStartTime;
      console.log(`[视频生成] JSON解析完成 - 耗时: ${parseDuration}ms`);
      console.log(`[视频生成] 响应数据结构:`, {
        hasVideo: !!data.video,
        hasImages: !!data.images,
        imagesCount: data.images?.length || 0,
        videoLength: data.video?.length || 0,
      });
      
      // 检查响应数据格式
      // 视频可能以 base64 格式返回，或者返回视频 URL
      if (data.video) {
        console.log(`[视频生成] 检测到视频数据, 长度: ${data.video.length}`);
        // 如果返回的是 base64，添加 data:video 前缀
        if (data.video.startsWith('data:video')) {
          videoUrl = data.video;
          console.log(`[视频生成] 视频已包含data URI前缀`);
        } else {
          videoUrl = `data:video/mp4;base64,${data.video}`;
          console.log(`[视频生成] 添加data URI前缀完成`);
        }
      } else if (data.images && data.images.length > 0) {
        console.log(`[视频生成] 检测到图像序列, 帧数: ${data.images.length}`);
        // 如果返回的是帧序列，可能需要组合成视频
        // 这里先返回第一帧作为占位符，实际应该组合成视频
        videoUrl = `data:image/png;base64,${data.images[0]}`;
        console.log(`[视频生成] 使用第一帧作为占位符`);
      } else {
        console.error(`[视频生成] 响应格式无效 - 缺少视频数据:`, {
          dataKeys: Object.keys(data),
          dataPreview: JSON.stringify(data).substring(0, 200),
        });
        throw new Error(`无效的响应格式: 缺少视频数据`);
      }
      
      const totalDuration = Date.now() - requestStartTime;
      console.log(`[视频生成] 视频生成成功 - 总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`);
    } catch (parseError) {
      const totalDuration = Date.now() - requestStartTime;
      console.error(`[视频生成] 响应解析错误:`, {
        error: parseError,
        errorType: parseError instanceof Error ? parseError.constructor.name : typeof parseError,
        errorMessage: parseError instanceof Error ? parseError.message : String(parseError),
        errorStack: parseError instanceof Error ? parseError.stack : undefined,
        textPreview: text.substring(0, 500),
        textLength: text.length,
        totalDuration: `${totalDuration}ms`,
      });
      
      // 如果已经是Error对象，直接抛出
      if (parseError instanceof Error) {
        throw parseError;
      }
      // 否则包装为错误
      throw new Error(`无法解析ComfyUI响应: ${text.substring(0, 200)}`);
    }

    return videoUrl;
  } catch (error) {
    const totalDuration = Date.now() - requestStartTime;
    
    console.error(`[视频生成] 视频生成失败 - 总耗时: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`, {
      error: error,
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      model: params.model,
      baseUrl: baseUrl,
      apiEndpoint: `${baseUrl}/prompt`,
      requestParams: {
        width: params.width,
        height: params.height,
        length: params.length,
        fps: params.fps,
        steps: params.steps,
        hasImage: !!params.image,
        promptLength: params.prompt?.length || 0,
      },
    });
    
    // 如果是网络错误，提供更友好的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error(`[视频生成] 网络连接错误详情:`, {
        errorName: error.name,
        errorMessage: error.message,
        baseUrl: baseUrl,
        apiEndpoint: `${baseUrl}/prompt`,
        possibleCauses: [
          '服务URL配置错误',
          'ComfyUI服务未运行',
          '网络连接问题',
          '防火墙阻止连接',
          'DNS解析失败',
        ],
      });
      throw new Error(`无法连接到ComfyUI服务 (${baseUrl})。请检查服务是否正常运行`);
    }
    
    // 如果是 AbortError (超时)
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[视频生成] 请求超时:`, {
        baseUrl: baseUrl,
        totalDuration: `${totalDuration}ms`,
      });
      throw new Error(`请求超时: 无法在合理时间内连接到ComfyUI服务 (${baseUrl})`);
    }
    
    throw error;
  }
}

