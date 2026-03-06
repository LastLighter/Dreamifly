// 视频模型配置管理工具

// 视频模型环境变量映射
const VIDEO_MODEL_ENV_MAP = {
  "Wan2.2-I2V-Lightning": "WAN_I2V_URL",
  "grok-imagine-1.0-video": "GROK_VIDEO_API_URL",
  // 可以添加更多视频模型
} as const;

export type VideoAspectRatioLabel = '16:9' | '9:16' | '3:2' | '2:3' | '1:1' | '4:3' | '3:4'

export function aspectRatioLabelToNumber(label: VideoAspectRatioLabel): number {
  const [w, h] = label.split(':').map(Number)
  return w / h
}

export function pickClosestAspectRatioLabel(
  ratio: number,
  allowed: VideoAspectRatioLabel[],
  fallback: VideoAspectRatioLabel = '1:1'
): VideoAspectRatioLabel {
  if (!Number.isFinite(ratio) || ratio <= 0) return fallback
  if (!allowed.length) return fallback

  let best = allowed[0]
  let bestDiff = Math.abs(aspectRatioLabelToNumber(best) - ratio)

  for (const label of allowed) {
    const diff = Math.abs(aspectRatioLabelToNumber(label) - ratio)
    if (diff < bestDiff) {
      best = label
      bestDiff = diff
    }
  }

  return best ?? fallback
}

// 视频模型文件配置
export interface VideoModelFiles {
  unetHighNoise: string;      // 高噪声 UNet 模型文件名
  unetLowNoise: string;        // 低噪声 UNet 模型文件名
  clip: string;                // CLIP 模型文件名
  vae: string;                 // VAE 模型文件名
  loraHighNoise: string;       // 高噪声 LoRA 模型文件名
  loraLowNoise: string;        // 低噪声 LoRA 模型文件名
}

// 视频模型配置
export interface VideoModelConfig {
  id: string;                  // 模型唯一标识
  name: string;                // 模型显示名称
  description?: string;        // 模型描述
  image?: string;              // 模型预览图路径
  homepageCover?: string;       // 主页封面图
  files?: VideoModelFiles;       // 模型文件配置（ComfyUI类模型使用）
  tags?: string[];              // 标签
  isRecommended?: boolean;      // 是否推荐
  isAvailable?: boolean;        // 是否可用（动态属性）
  provider?: 'comfy' | 'grok';  // 模型提供方（用于后端分流）
  // 视频生成参数配置
  defaultFps?: number;          // 默认帧率
  defaultLength?: number;       // 默认视频长度（帧数）
  maxLength?: number;           // 最大视频长度
  totalPixels?: number;        // 总像素数（用于分辨率计算）
  // Grok 视频模型专用配置
  allowedAspectRatios?: VideoAspectRatioLabel[]; // 允许的宽高比（字符串标签）
  fixedResolutionName?: '480p'; // 固定分辨率档位
  defaultVideoSeconds?: number; // 默认视频长度（秒）
}

// 视频模型配置列表
export const ALL_VIDEO_MODELS: VideoModelConfig[] = [
  {
    id: "Wan2.2-I2V-Lightning",
    name: "Wan 2.2 I2V Lightning",
    description: "Wan 2.2 图像到视频模型，支持快速生成高质量视频，采用 Lightning 架构，4步即可生成视频。",
    image: "/models/video/Wan2.2-I2V-Lightning.jpg",
    homepageCover: "/models/homepageModelCover/wan-video.png",
    files: {
      unetHighNoise: "wan2.2_i2v_high_noise_14B_fp8_scaled.safetensors",
      unetLowNoise: "wan2.2_i2v_low_noise_14B_fp8_scaled.safetensors",
      clip: "umt5_xxl_fp8_e4m3fn_scaled.safetensors",
      vae: "wan_2.1_vae.safetensors",
      loraHighNoise: "wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors",
      loraLowNoise: "wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors",
    },
    tags: ["fastGeneration", "i2v"],
    isRecommended: true,
    provider: 'comfy',
    defaultFps: 20,
    defaultLength: 100,
    maxLength: 200,
    totalPixels: 1280 * 720, // 720p 总像素
  },
  {
    id: 'grok-imagine-1.0-video',
    name: 'Grok Imagine Video',
    description: 'Grok 图生视频模型（480p 固定档位），支持限定宽高比集合快速生成视频。',
    image: '/models/video/grok-imagine-1.0-video.jpg',
    homepageCover: '/models/homepageModelCover/grok-video.png',
    tags: ['i2v'],
    isRecommended: false,
    provider: 'grok',
    fixedResolutionName: '480p',
    allowedAspectRatios: ['16:9', '9:16', '3:2', '2:3', '1:1'],
    defaultVideoSeconds: 6,
  },
  // 可以在这里添加更多视频模型配置
];

/**
 * 检查视频模型是否在环境变量中配置了URL
 * @param modelId 模型ID
 * @returns 是否配置了URL
 */
export function isVideoModelConfigured(modelId: string): boolean {
  const envVarName = VIDEO_MODEL_ENV_MAP[modelId as keyof typeof VIDEO_MODEL_ENV_MAP];
  if (!envVarName) {
    return false;
  }
  
  // 在客户端环境中，我们无法直接访问 process.env
  // 所以我们需要通过其他方式来判断，比如API调用
  // 这里先返回 true，实际实现需要在服务端检查
  return true;
}

/**
 * 从API获取可用的视频模型列表（基于环境变量配置）
 * @returns Promise<VideoModelConfig[]> 可用的视频模型配置列表
 */
export async function getAvailableVideoModels(): Promise<VideoModelConfig[]> {
  try {
    const response = await fetch('/api/video-models');
    if (!response.ok) {
      throw new Error('Failed to fetch available video models');
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching available video models:', error);
    // 如果API调用失败，返回所有模型作为后备
    return ALL_VIDEO_MODELS;
  }
}

/**
 * 获取本地视频模型列表（不检查环境变量）
 * @returns 所有视频模型配置列表
 */
export function getAllVideoModels(): VideoModelConfig[] {
  return ALL_VIDEO_MODELS;
}

/**
 * 根据模型ID获取视频模型配置
 * @param modelId 模型ID
 * @returns 模型配置，如果不存在则返回 null
 */
export function getVideoModelById(modelId: string): VideoModelConfig | null {
  return ALL_VIDEO_MODELS.find(model => model.id === modelId) || null;
}

export function getVideoAspectRatioOptions(modelConfig: VideoModelConfig): Array<{ label: VideoAspectRatioLabel; value: number }> {
  const defaultLabels: VideoAspectRatioLabel[] = ['16:9', '4:3', '1:1', '3:4', '9:16']
  const labels = (modelConfig.allowedAspectRatios?.length ? modelConfig.allowedAspectRatios : defaultLabels)
  return labels.map(label => ({ label, value: aspectRatioLabelToNumber(label) }))
}

export function calculateVideoResolutionForModel(
  modelConfig: VideoModelConfig,
  aspectRatioLabel: VideoAspectRatioLabel
): { width: number; height: number } {
  if (modelConfig.provider === 'grok' && modelConfig.fixedResolutionName === '480p') {
    const map: Record<Exclude<VideoAspectRatioLabel, '4:3' | '3:4'>, { width: number; height: number }> = {
      '16:9': { width: 854, height: 480 },
      '9:16': { width: 480, height: 854 },
      '3:2': { width: 720, height: 480 },
      '2:3': { width: 480, height: 720 },
      '1:1': { width: 480, height: 480 },
    }
    const preset = map[aspectRatioLabel as Exclude<VideoAspectRatioLabel, '4:3' | '3:4'>] ?? map['1:1']
    return { width: preset.width, height: preset.height }
  }

  return calculateVideoResolution(modelConfig, aspectRatioLabelToNumber(aspectRatioLabel))
}

/**
 * 根据比例计算视频分辨率（保持总像素不变）
 * @param modelConfig 视频模型配置
 * @param aspectRatio 宽高比（width/height）
 * @returns 计算后的宽度和高度
 */
export function calculateVideoResolution(
  modelConfig: VideoModelConfig,
  aspectRatio: number
): { width: number; height: number } {
  const totalPixels = modelConfig.totalPixels || 1280 * 720; // 默认720p
  
  // 根据宽高比计算：width * height = totalPixels, width / height = aspectRatio
  // height = sqrt(totalPixels / aspectRatio)
  // width = height * aspectRatio
  const height = Math.round(Math.sqrt(totalPixels / aspectRatio));
  const width = Math.round(height * aspectRatio);
  
  // 确保宽高都是8的倍数（ComfyUI通常要求）
  const widthRounded = Math.round(width / 8) * 8;
  const heightRounded = Math.round(height / 8) * 8;
  
  return {
    width: widthRounded,
    height: heightRounded,
  };
}

