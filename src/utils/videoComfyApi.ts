import { getVideoModelById } from './videoModelConfig';
import { generateVideoWorkflow } from './videoWorkflow';
import axios from 'axios';
import https from 'https';
import http from 'http';

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
  console.log(`[视频生成] 开始处理视频生成请求 - 时间戳: ${new Date().toISOString()}, 模型: ${params.model}`);

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
    console.error(`[视频生成] 服务URL未配置 - 模型: ${params.model}`);
    throw new Error(`视频模型 ${params.model} 未配置服务URL，请联系管理员检查服务配置`);
  }

  // 规范化 baseUrl（移除末尾斜杠）
  baseUrl = baseUrl.replace(/\/+$/, '');

  // 视频生成需要较长时间，设置25分钟超时（1500000ms），留出缓冲时间给响应处理
  const VIDEO_GENERATION_TIMEOUT = 25 * 60 * 1000; // 25分钟

  // 构建 API 端点（在 try 块外定义，以便在 catch 块中也能访问）
  const apiEndpoint = `${baseUrl}/prompt`;

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
    console.log(`[视频生成] 发送ComfyUI请求 - 端点: ${apiEndpoint}, 请求体大小: ${(requestBodySize / 1024 / 1024).toFixed(2)} MB`);

    // 创建自定义的 HTTP Agent，禁用连接复用
    // 这样可以避免复用已失效的连接导致 "socket hang up" 错误
    // 视频生成请求通常耗时较长，不需要连接复用
    const httpAgent = new http.Agent({
      keepAlive: false, // 禁用连接复用，每次请求都创建新连接
      maxSockets: 1,    // 限制每个主机的连接数
    });
    
    const httpsAgent = new https.Agent({
      keepAlive: false, // 禁用连接复用，每次请求都创建新连接
      maxSockets: 1,    // 限制每个主机的连接数
      rejectUnauthorized: true, // 验证 SSL 证书
    });

    // 使用 axios 处理请求，避免 Undici 的 300 秒默认超时限制
    const response = await axios.post(apiEndpoint, requestBody, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: VIDEO_GENERATION_TIMEOUT,
      // 支持大文件传输
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // 设置响应类型为 JSON（axios 会自动解析）
      responseType: 'json',
      // 使用自定义 Agent，禁用连接复用，避免 socket hang up 错误
      httpAgent: apiEndpoint.startsWith('https') ? undefined : httpAgent,
      httpsAgent: apiEndpoint.startsWith('https') ? httpsAgent : undefined,
    });

    const requestDuration = Date.now() - comfyUIRequestStartTime;
    console.log(`[视频生成] ComfyUI请求完成 - HTTP状态: ${response.status}, 请求耗时: ${requestDuration}ms (${(requestDuration / 1000).toFixed(2)}秒)`);

    // axios 会自动处理响应状态，非 2xx 状态码会抛出错误
    // 所以这里直接处理响应数据
    let videoUrl: string = '';
    const responseReceiveStartTime = Date.now();

    try {
      console.log(`[视频生成] 开始处理响应数据...`);
      
      // axios 已经自动解析 JSON，直接使用 response.data
      const data = response.data as ComfyUIResponse;
      const responseReceiveTime = Date.now() - responseReceiveStartTime;

      // 计算响应体大小（估算）
      const responseSize = JSON.stringify(data).length;
      console.log(`[视频生成] 响应数据处理完成 - 大小: ${(responseSize / 1024 / 1024).toFixed(2)} MB, 耗时: ${responseReceiveTime}ms`);

      // 如果响应体过大，给出警告
      if (responseSize > 50 * 1024 * 1024) { // 50MB
        console.warn(`[视频生成] 警告: 响应体过大 (${(responseSize / 1024 / 1024).toFixed(2)} MB)，可能导致内存压力和处理延迟`);
      }

      // 检查响应是否为"no healthy upstream"错误
      const dataString = JSON.stringify(data);
      if (dataString.includes('no healthy upstream') || dataString.includes('upstream')) {
        console.error(`[视频生成] 检测到上游服务错误`);
        throw new Error(`ComfyUI服务暂时不可用: 请稍后重试或联系管理员`);
      }

      console.log(`[视频生成] JSON解析完成 - 数据已自动解析`);

      // comfyui-api 直接返回视频的 base64 数据在 images 数组中
      if (data.images && data.images.length > 0) {
        // 取第一个视频（通常只有一个）
        const videoBase64 = data.images[0];

        if (!videoBase64 || typeof videoBase64 !== 'string') {
          throw new Error(`无效的视频数据格式: images[0] 不是有效的 base64 字符串`);
        }

        console.log(`[视频生成] 视频数据处理 - base64长度: ${(videoBase64.length / 1024 / 1024).toFixed(2)} MB`);

        // 添加 data URI 前缀
        const dataUriStartTime = Date.now();
        videoUrl = `data:video/mp4;base64,${videoBase64}`;
        const dataUriTime = Date.now() - dataUriStartTime;

        console.log(`[视频生成] data URI组装完成 - 耗时: ${dataUriTime}ms, 总大小: ${(videoUrl.length / 1024 / 1024).toFixed(2)} MB`);

      } else {
        const processingDuration = Date.now() - requestStartTime;
        console.error(`[视频生成] 响应格式无效 - 缺少 images 数据:`, {
          dataKeys: Object.keys(data),
          dataPreview: JSON.stringify(data).substring(0, 500),
          processingDuration: `${processingDuration}ms`,
          hasImages: !!data.images,
          imagesLength: data.images?.length || 0,
          hasFilenames: !!data.filenames,
          filenamesLength: data.filenames?.length || 0,
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
        totalDuration: `${totalDuration}ms`,
      });
      
      // 如果已经是Error对象，直接抛出
      if (parseError instanceof Error) {
        throw parseError;
      }
      // 否则包装为错误
      throw new Error(`无法解析ComfyUI响应: ${String(parseError)}`);
    }

    const totalProcessingTime = Date.now() - requestStartTime;
    console.log(`[视频生成] 视频生成完成 - 总耗时: ${totalProcessingTime}ms (${(totalProcessingTime / 1000).toFixed(2)}秒)`);

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
    
    // 处理 axios 错误
    if (axios.isAxiosError(error)) {
      // HTTP 错误响应（4xx, 5xx）
      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        const errorData = error.response.data;
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        
        console.error(`[视频生成] API 错误响应详情:`, {
          model: params.model,
          status: status,
          statusText: statusText,
          url: apiEndpoint,
          baseUrl: baseUrl,
          errorText: errorText.substring(0, 500), // 限制错误文本长度
          errorTextLength: errorText.length,
          totalDuration: `${totalDuration}ms`,
          headers: error.response.headers,
        });
        
        // 如果是 404 错误，提供更详细的提示
        if (status === 404) {
          throw new Error(`API 端点不存在 (404): 请联系管理员检查 ${params.model} 的服务配置`);
        }
        
        // 如果是 503 错误，提供连接相关的提示
        if (status === 503) {
          throw new Error(`ComfyUI服务暂时不可用 (503): 请稍后重试或联系管理员`);
        }
        
        throw new Error(`ComfyUI服务错误 (${status}): 请稍后重试或联系管理员`);
      }
      
      // 网络错误（连接失败、超时等）
      if (error.request) {
        const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
        
        if (isTimeout) {
          const timeoutMinutes = VIDEO_GENERATION_TIMEOUT / 60000;
          console.error(`[视频生成] 请求超时:`, {
            baseUrl: baseUrl,
            totalDuration: `${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`,
            timeoutLimit: `${timeoutMinutes}分钟`,
            errorCode: error.code,
            errorMessage: error.message,
          });
          throw new Error(`视频生成超时: 请求在${timeoutMinutes}分钟内未完成。视频生成可能需要更长时间，请稍后重试或检查ComfyUI服务状态`);
        }
        
        // 其他网络错误
        console.error(`[视频生成] 网络连接错误:`, {
          errorName: error.name,
          errorMessage: error.message,
          errorCode: error.code,
          baseUrl: baseUrl,
          apiEndpoint: `${baseUrl}/prompt`,
        });
        throw new Error(`无法连接到ComfyUI服务: ${error.message}。请检查服务是否正常运行或联系管理员`);
      }
    }
    
    // 如果是超时错误（非 axios 错误）
    if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('Timeout'))) {
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
    
    throw error;
  }
}

