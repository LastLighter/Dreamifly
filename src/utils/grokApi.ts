import { getGrokSizeString } from '@/utils/modelConfig';

interface GrokImageParams {
  prompt: string;
  width: number;
  height: number;
}

interface GrokApiResponse {
  created: number;
  data: Array<{ b64_json: string }>;
  usage?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
  };
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 60000;

/** 判断错误是否可重试（超时、网络错误、5xx） */
function isRetryableError(error: unknown, status?: number): boolean {
  if (status && status >= 500) return true;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true; // 超时
    if (error.message.includes('fetch failed') || error.message.includes('timeout') || error.message.includes('Timeout')) return true;
    const cause = error.cause as { message?: string; code?: string } | undefined;
    if (cause?.message?.includes('Timeout') || cause?.code === 'UND_ERR_CONNECT_TIMEOUT') return true;
    if (cause?.message?.includes('ECONNRESET') || cause?.message?.includes('ECONNREFUSED')) return true;
  }
  return false;
}

/**
 * 调用 grok-imagine-1.0 API 生成图片（带超时重试）
 * @param params 生成参数
 * @returns base64 格式的图片 data URL（data:image/jpeg;base64,...）
 */
export async function generateGrokImage(params: GrokImageParams): Promise<string> {
  const apiUrl = process.env.GROK_IMAGINE_API_URL;
  const apiKey = process.env.GROK_IMAGINE_API_KEY;

  if (!apiUrl || !apiUrl.trim()) {
    throw new Error('grok-imagine-1.0 的服务 URL 未配置，请检查 GROK_IMAGINE_API_URL 环境变量');
  }

  const size = getGrokSizeString(params.width, params.height);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const body = JSON.stringify({
    prompt: params.prompt,
    model: 'grok-imagine-1.0',
    size,
    response_format: 'base64',
    stream: false,
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        if (attempt < MAX_RETRIES && isRetryableError(null, response.status)) {
          console.warn(`[grok-imagine-1.0] 第 ${attempt} 次请求失败 (${response.status})，${RETRY_DELAY_MS}ms 后重试...`);
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        console.error('[grok-imagine-1.0] API 错误:', {
          status: response.status,
          statusText: response.statusText,
          url: apiUrl,
          error: errorText,
        });
        throw new Error(
          `Grok API 错误 (${response.status}): ${errorText || '未知错误'}`
        );
      }

      const data = (await response.json()) as GrokApiResponse;

      if (!data?.data?.[0]?.b64_json) {
        throw new Error('无效的 Grok API 响应：缺少 b64_json 数据');
      }

      const b64Content = data.data[0].b64_json;
      return `data:image/jpeg;base64,${b64Content}`;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        console.warn(`[grok-imagine-1.0] 第 ${attempt} 次请求异常 (${error instanceof Error ? error.message : String(error)})，${RETRY_DELAY_MS}ms 后重试...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error('Grok API 请求失败');
}
