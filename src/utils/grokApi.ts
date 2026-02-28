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

/**
 * 调用 grok-imagine-1.0 API 生成图片
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

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      prompt: params.prompt,
      model: 'grok-imagine-1.0',
      size,
      response_format: 'base64',
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
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
}
