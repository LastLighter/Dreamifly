export type GrokVideoAspectRatio = '16:9' | '9:16' | '3:2' | '2:3' | '1:1'

interface GrokChatMessage {
  role: 'system' | 'user' | 'assistant'
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >
}

interface GrokChatCompletionsRequest {
  model: 'grok-imagine-1.0-video'
  messages: GrokChatMessage[]
  stream: boolean
  video_config: {
    aspect_ratio: GrokVideoAspectRatio
    video_length: number
    resolution_name: '480p'
  }
}

interface GrokChatCompletionsResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
      refusal?: string | null
    }
    finish_reason?: string
  }>
}

const REQUEST_TIMEOUT_MS = 120_000

function extractFirstMatch(regex: RegExp, input: string): string | null {
  const match = regex.exec(input)
  return match?.[1] ?? null
}

export function extractMp4UrlAndPosterFromHtml(html: string): { mp4Url: string; posterUrl?: string } {
  const mp4Url =
    extractFirstMatch(/<source[^>]*\ssrc="([^"]+\.mp4[^"]*)"/i, html) ??
    extractFirstMatch(/<source[^>]*\ssrc='([^']+\.mp4[^']*)'/i, html)

  if (!mp4Url) {
    throw new Error('Grok 返回内容未包含 mp4 链接（未找到 <source src="...mp4">）')
  }

  const posterUrl =
    extractFirstMatch(/<video[^>]*\sposter="([^"]+)"/i, html) ??
    extractFirstMatch(/<video[^>]*\sposter='([^']+)'/i, html) ??
    undefined

  return { mp4Url, posterUrl }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function callGrokImagineVideo(params: {
  apiUrl: string
  apiKey?: string
  imageBase64DataUrl: string
  promptText: string
  aspectRatio: GrokVideoAspectRatio
  videoSeconds: number
}): Promise<{ mp4Url: string; posterUrl?: string; rawHtml: string }> {
  const { apiUrl, apiKey, imageBase64DataUrl, promptText, aspectRatio, videoSeconds } = params

  if (!apiUrl || !apiUrl.trim()) {
    throw new Error('Grok 视频服务 URL 未配置，请检查 GROK_VIDEO_API_URL 环境变量')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`
  }

  const body: GrokChatCompletionsRequest = {
    model: 'grok-imagine-1.0-video',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageBase64DataUrl },
          },
          {
            type: 'text',
            text: promptText,
          },
        ],
      },
    ],
    stream: false,
    video_config: {
      aspect_ratio: aspectRatio,
      video_length: videoSeconds,
      resolution_name: '480p',
    },
  }

  const response = await fetchWithTimeout(
    apiUrl,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    },
    REQUEST_TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Grok 视频接口错误 (${response.status}): ${errorText || response.statusText || '未知错误'}`)
  }

  const data = (await response.json()) as GrokChatCompletionsResponse
  const rawHtml = data?.choices?.[0]?.message?.content
  if (!rawHtml || typeof rawHtml !== 'string') {
    throw new Error('Grok 视频接口返回无效：缺少 choices[0].message.content')
  }

  const { mp4Url, posterUrl } = extractMp4UrlAndPosterFromHtml(rawHtml)
  return { mp4Url, posterUrl, rawHtml }
}

export async function downloadMp4AsDataUrl(params: {
  url: string
  apiKey?: string
}): Promise<string> {
  const { url, apiKey } = params

  const headers: Record<string, string> = {}
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`
  }

  const response = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers,
    },
    REQUEST_TIMEOUT_MS
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`下载 Grok MP4 失败 (${response.status}): ${errorText || response.statusText || '未知错误'}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:video/mp4;base64,${base64}`
}

