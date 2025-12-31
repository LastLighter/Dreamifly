import { getVideoModelById } from './videoModelConfig';
import { generateVideoWorkflow } from './videoWorkflow';

/**
 * comfyui-api 返回格式
 * 直接返回视频的 base64 数据，不需要轮询
 */
interface ComfyUIResponse {
  id?: string; // 任务ID
  prompt?: Record<string, any>; // 工作流定义
  images?: string[]; // 视频的 base64 数据数组（comfyui-api 使用 images 字段存储视频）
  filenames?: string[]; // 生成的文件名数组
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

  // 获取模型配置
  const modelConfig = getVideoModelById(params.model);
  if (!modelConfig) {
    console.error(`[视频生成] 模型配置未找到: ${params.model}`);
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
    console.error(`[视频生成] 服务URL未配置 - 模型: ${params.model}, 环境变量: WAN_I2V_URL`);
    throw new Error(`视频模型 ${params.model} 的服务URL未配置，请检查环境变量 WAN_I2V_URL`);
  }

  // 规范化 baseUrl（移除末尾斜杠）
  baseUrl = baseUrl.replace(/\/+$/, '');

  // 视频生成需要较长时间，设置25分钟超时（1500000ms），留出缓冲时间给响应处理
  const VIDEO_GENERATION_TIMEOUT = 25 * 60 * 1000; // 25分钟

  // 如果有输入图片，直接设置到工作流中（ComfyUI会自动处理base64上传）
  if (params.image) {
    // 移除data:image前缀，只保留base64数据（如果包含前缀）
    let imageBase64 = params.image;
    if (imageBase64.includes(',')) {
      imageBase64 = imageBase64.split(',')[1];
    }

    // 更新工作流中的图片（LoadImage节点会自动处理upload: "image"）
    if (workflow['71'] && workflow['71'].inputs) {
      workflow['71'].inputs.image = imageBase64;
    }
  }

  try {
    // 发送提示请求并等待响应
    const apiEndpoint = `${baseUrl}/prompt`;
    const requestBody = { prompt: workflow };
    const requestBodyString = JSON.stringify(requestBody);
    const requestBodySize = requestBodyString.length;

    // 如果请求体过大，给出警告
    if (requestBodySize > 10 * 1024 * 1024) { // 10MB
      console.warn(`[视频生成] 警告: 请求体过大 (${(requestBodySize / 1024 / 1024).toFixed(2)} MB)，可能导致服务器超时或连接关闭`);
    } else if (requestBodySize > 5 * 1024 * 1024) { // 5MB
      console.warn(`[视频生成] 提示: 请求体较大 (${(requestBodySize / 1024 / 1024).toFixed(2)} MB)，如果遇到连接问题，请尝试减小输入图片大小`);
    }

    const comfyUIRequestStartTime = Date.now();
    
    // 使用原生 fetch 处理请求
    // 原生 fetch 在处理响应体解码时通常比 Undici 更快
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBodyString,
      signal: AbortSignal.timeout(VIDEO_GENERATION_TIMEOUT),
    });
    

    console.log(`[视频生成] ComfyUI请求完成 - HTTP状态: ${response.status}, 总耗时: ${Date.now() - comfyUIRequestStartTime}ms`);

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
      text = await response.text();

      // 如果响应体过大，给出警告
      if (text.length > 50 * 1024 * 1024) { // 50MB
        console.warn(`[视频生成] 警告: 响应体过大 (${(text.length / 1024 / 1024).toFixed(2)} MB)，可能导致内存压力和处理延迟`);
      }

      // 检查响应是否为"no healthy upstream"错误
      if (text.includes('no healthy upstream') || text.includes('upstream')) {
        console.error(`[视频生成] 检测到上游服务错误:`, {
          text: text.substring(0, 500),
          hasUpstream: text.includes('upstream'),
          hasNoHealthy: text.includes('no healthy upstream'),
        });
        throw new Error(`ComfyUI服务不可用: ${text.substring(0, 200)}。请检查服务是否正常运行`);
      }

      const data = JSON.parse(text) as ComfyUIResponse;

      // comfyui-api 直接返回视频的 base64 数据在 images 数组中
      if (data.images && data.images.length > 0) {
        // 取第一个视频（通常只有一个）
        const videoBase64 = data.images[0];

        if (!videoBase64 || typeof videoBase64 !== 'string') {
          throw new Error(`无效的视频数据格式: images[0] 不是有效的 base64 字符串`);
        }

        // 添加 data URI 前缀
        videoUrl = `data:video/mp4;base64,${videoBase64}`;

      } else {
        console.error(`[视频生成] 响应格式无效 - 缺少 images 数据:`, {
          dataKeys: Object.keys(data),
          dataPreview: JSON.stringify(data).substring(0, 500),
        });
        throw new Error(`无效的响应格式: comfyui-api 应返回包含 images 数组的响应`);
      }
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
      // 检查是否是连接被关闭的错误
      const errorCause = (error as any).cause;
      const isSocketError = errorCause?.code === 'UND_ERR_SOCKET' || 
                           errorCause?.message?.includes('other side closed') ||
                           errorCause?.message?.includes('socket');
      
      const requestSize = JSON.stringify({ prompt: workflow }).length;
      const bytesWritten = errorCause?.socket?.bytesWritten || 0;
      const bytesRead = errorCause?.socket?.bytesRead || 0;
      
      console.error(`[视频生成] 网络连接错误详情:`, {
        errorName: error.name,
        errorMessage: error.message,
        errorCode: errorCause?.code,
        errorCause: errorCause?.message,
        baseUrl: baseUrl,
        apiEndpoint: `${baseUrl}/prompt`,
        requestSize: `${requestSize} 字节`,
        bytesWritten: bytesWritten > 0 ? `${bytesWritten} 字节` : '未知',
        bytesRead: bytesRead > 0 ? `${bytesRead} 字节` : '未知',
        isSocketError: isSocketError,
        possibleCauses: isSocketError ? [
          '服务器在处理请求时关闭了连接',
          '请求体过大导致服务器超时',
          '服务器或代理/负载均衡器的超时设置过短',
          '服务器在处理过程中崩溃或重启',
          '网络不稳定导致连接中断',
        ] : [
          '服务URL配置错误',
          'ComfyUI服务未运行',
          '网络连接问题',
          '防火墙阻止连接',
          'DNS解析失败',
        ],
      });
      
      if (isSocketError) {
        // 连接被服务器关闭，可能是请求体太大或处理时间太长
        const errorMsg = bytesWritten > 0 && bytesRead === 0
          ? `服务器在处理请求时关闭了连接（已发送 ${bytesWritten} 字节，未收到响应）。这通常是因为：1) 请求体过大（当前 ${requestSize} 字节），2) 服务器处理超时，3) 服务器或代理的超时设置过短。建议：检查服务器日志，或尝试减小输入图片大小。`
          : `服务器在处理请求时关闭了连接。请检查 ComfyUI 服务是否正常运行，或查看服务器日志获取更多信息。`;
        throw new Error(errorMsg);
      }
      
      throw new Error(`无法连接到ComfyUI服务 (${baseUrl})。请检查服务是否正常运行`);
    }
    
    // 如果是 AbortError (超时)
    if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('timeout') || error.message.includes('Timeout'))) {
      const timeoutMinutes = VIDEO_GENERATION_TIMEOUT / 60000;
      console.error(`[视频生成] 请求超时:`, {
        baseUrl: baseUrl,
        totalDuration: `${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`,
        timeoutLimit: `${timeoutMinutes}分钟`,
        errorName: error.name,
        errorMessage: error.message,
      });
      throw new Error(`视频生成超时: 请求在${timeoutMinutes}分钟内未完成。视频生成可能需要更长时间，请稍后重试或检查ComfyUI服务状态`);
    }
    
    // 检查是否是 HeadersTimeoutError
    if (error instanceof Error && (error.message.includes('Headers Timeout') || error.message.includes('UND_ERR_HEADERS_TIMEOUT'))) {
      const timeoutMinutes = VIDEO_GENERATION_TIMEOUT / 60000;
      console.error(`[视频生成] 头部超时错误:`, {
        baseUrl: baseUrl,
        totalDuration: `${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`,
        timeoutLimit: `${timeoutMinutes}分钟`,
        errorName: error.name,
        errorMessage: error.message,
      });
      throw new Error(`视频生成超时: 服务器响应头部超时（${timeoutMinutes}分钟）。视频生成可能需要更长时间，请稍后重试`);
    }
    
    throw error;
  }
}

