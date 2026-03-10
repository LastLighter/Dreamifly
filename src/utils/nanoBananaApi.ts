import Replicate from 'replicate'

interface NanoBananaParams {
  prompt: string
  width: number
  height: number
  negative_prompt?: string
  seed?: number
}

// nano-banana-2 支持的比例及其对应的浮点数
const SUPPORTED_RATIOS: Array<[string, number]> = [
  ['1:1',  1 / 1],
  ['16:9', 16 / 9],
  ['9:16', 9 / 16],
  ['4:3',  4 / 3],
  ['3:4',  3 / 4],
  ['3:2',  3 / 2],
  ['2:3',  2 / 3],
  ['4:5',  4 / 5],
  ['5:4',  5 / 4],
  ['21:9', 21 / 9],
]

/** 根据宽高推导最接近的 aspect_ratio 字符串 */
function deriveAspectRatio(width: number, height: number): string {
  const ratio = width / height
  let closest = '1:1'
  let minDiff = Infinity
  for (const [label, value] of SUPPORTED_RATIOS) {
    const diff = Math.abs(ratio - value)
    if (diff < minDiff) {
      minDiff = diff
      closest = label
    }
  }
  return closest
}

/**
 * 根据总像素数推导分辨率档位：
 * - 总像素 > 1024*1024*1.5 → 2K
 * - 其余 → 1K
 */
function deriveResolution(width: number, height: number): '1K' | '2K' {
  return width * height > 1024 * 1024 * 1.5 ? '2K' : '1K'
}

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

/** 判断错误是否可重试 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('timeout') || msg.includes('fetch failed') || msg.includes('econnreset')) {
      return true
    }
  }
  return false
}

/**
 * 调用 google/nano-banana-2（via Replicate）生成图片（带重试）
 * @returns base64 格式的图片 data URL（data:image/png;base64,...）
 */
export async function generateNanoBananaImage(params: NanoBananaParams): Promise<string> {
  const apiToken = process.env.REPLICATE_API_TOKEN
  if (!apiToken?.trim()) {
    throw new Error('nano-banana-2 的 API Token 未配置，请检查 REPLICATE_API_TOKEN 环境变量')
  }

  const replicate = new Replicate({ auth: apiToken })

  const aspect_ratio = deriveAspectRatio(params.width, params.height)
  const resolution = deriveResolution(params.width, params.height)

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    aspect_ratio,
    resolution,           // "1K" | "2K"，API 要求带 K 后缀
    output_format: 'png',
  }

  if (params.negative_prompt) {
    input.negative_prompt = params.negative_prompt
  }
  if (params.seed !== undefined) {
    input.seed = params.seed
  }

  console.log(`[nano-banana-2] 开始生成，aspect_ratio=${aspect_ratio}, resolution=${resolution}`)

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const output = await replicate.run('google/nano-banana-2', { input })

      // Replicate SDK 返回 string / URL / FileOutput 或其数组
      let imageUrl: string
      if (Array.isArray(output)) {
        const first = output[0]
        if (first == null) throw new Error('Replicate API 未返回任何图片')
        imageUrl = typeof first === 'string' ? first : String(first)
      } else if (output == null) {
        throw new Error('Replicate API 未返回任何图片')
      } else {
        imageUrl = typeof output === 'string' ? output : String(output)
      }

      if (!imageUrl || imageUrl === 'undefined' || imageUrl === 'null') {
        throw new Error('Replicate API 返回了无效的图片 URL')
      }

      console.log(`[nano-banana-2] 生成成功，正在下载图片...`)

      // 下载图片并转换为 base64 data URL，与现有管线保持兼容
      const response = await fetch(imageUrl)
      if (!response.ok) {
        throw new Error(`下载生成图片失败 (${response.status}): ${imageUrl}`)
      }
      const arrayBuffer = await response.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      return `data:image/png;base64,${base64}`
    } catch (error) {
      lastError = error
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        console.warn(
          `[nano-banana-2] 第 ${attempt} 次请求失败 (${error instanceof Error ? error.message : String(error)})，${RETRY_DELAY_MS}ms 后重试...`
        )
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
        continue
      }
      throw error
    }
  }

  throw lastError ?? new Error('nano-banana-2 请求失败')
}
