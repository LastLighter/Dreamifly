// 模型配置管理工具

// 模型环境变量映射
const MODEL_ENV_MAP = {
  "HiDream-full-fp8": "HiDream_Fp8_URL",
  "Flux-Dev": "Flux_Dev_URL", 
  "Flux-Kontext": "Kontext_fp8_URL",
  "Stable-Diffusion-3.5": "Stable_Diffusion_3_5_URL",
  "Flux-Krea": "Flux_Krea_URL",
  "Qwen-Image": "Qwen_Image_URL",
  "Qwen-Image-Edit": "Qwen_Image_Edit_URL",
  "Wai-SDXL-V150": "Wai_SDXL_V150_URL",
  "Z-Image-Turbo": "Z_Image_Turbo_URL",
  "Flux-2": "Flux_2_URL"
} as const;

// 基础模型配置
export interface ModelConfig {
  id: string;
  name: string;
  image: string;
  use_i2i: boolean;
  use_t2i: boolean;
  maxImages: number;
  tags?: string[];
  isRecommended?: boolean;
  isAvailable?: boolean; // 动态添加的属性，表示模型是否可用
}

// 完整的模型配置列表
export const ALL_MODELS: ModelConfig[] = [
  {
    id: "Wai-SDXL-V150",
    name: "Wai-SDXL-V150",
    image: "/models/Wai-SDXL-V150.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 0,
    tags: ["fastGeneration", "animeSpecialty"],
    isRecommended: true
  },
  {
    id: "Qwen-Image-Edit",
    name: "Qwen-Image-Edit",
    image: "/models/Qwen-Image.jpg",
    use_i2i: true,
    use_t2i: false,
    maxImages: 3,
    tags: ["chineseSupport", "fastGeneration"],
    isRecommended: true
  },
  {
    id: "Flux-Krea",
    name: "Flux-Krea",
    image: "/models/Flux-Krea.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 1,
    tags: ["realisticStyle"],
    isRecommended: true
  },
  {
    id: "Flux-Kontext",
    name: "Flux-Kontext",
    image: "/models/Flux-Kontext.jpg",
    use_i2i: true,
    use_t2i: false,
    maxImages: 2,
    isRecommended: true
  },
  {
    id: "Flux-Dev",
    name: "Flux-Dev",
    image: "/models/Flux-Dev.jpg",
    use_i2i: true,
    use_t2i: true,
    maxImages: 1,
    tags: ["fastGeneration"]
  },
  {
    id: "Stable-Diffusion-3.5",
    name: "Stable-Diffusion-3.5",
    image: "/models/StableDiffusion-3.5.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 1,
    tags: ["fastGeneration"]
  },
  {
    id: "HiDream-full-fp8",
    name: "HiDream-full-fp8",
    image: "/models/HiDream-full.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 1,
    tags: ["chineseSupport"]
  },
  {
    id: "Qwen-Image",
    name: "Qwen-Image",
    image: "/models/Qwen-Image.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 0,
    tags: ["chineseSupport"],
    isRecommended: true
  },
  {
    id: "Z-Image-Turbo",
    name: "Z-Image-Turbo",
    image: "/models/Z-Image-Turbo.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 0,
    tags: ["chineseSupport", "fastGeneration"],
    isRecommended: true
  },
  {
    id: "Flux-2",
    name: "Flux-2",
    image: "/models/Flux-2.jpg",
    use_i2i: false,
    use_t2i: true,
    maxImages: 0,
    tags: ["fastGeneration"],
    isRecommended: true
  }
];

/**
 * 检查模型是否在环境变量中配置了URL
 * @param modelId 模型ID
 * @returns 是否配置了URL
 */
export function isModelConfigured(modelId: string): boolean {
  const envVarName = MODEL_ENV_MAP[modelId as keyof typeof MODEL_ENV_MAP];
  if (!envVarName) {
    return false;
  }
  
  // 在客户端环境中，我们无法直接访问 process.env
  // 所以我们需要通过其他方式来判断，比如API调用
  // 这里先返回 true，实际实现需要在服务端检查
  return true;
}

/**
 * 从API获取可用的模型列表（基于环境变量配置）
 * @returns Promise<ModelConfig[]> 可用的模型配置列表
 */
export async function getAvailableModels(): Promise<ModelConfig[]> {
  try {
    const response = await fetch('/api/models');
    if (!response.ok) {
      throw new Error('Failed to fetch available models');
    }
    
    const data = await response.json();
    return data.models || [];
  } catch (error) {
    console.error('Error fetching available models:', error);
    // 如果API调用失败，返回所有模型作为后备
    return ALL_MODELS;
  }
}

/**
 * 获取本地模型列表（不检查环境变量）
 * @returns 所有模型配置列表
 */
export function getAllModels(): ModelConfig[] {
  return ALL_MODELS;
}

/**
 * 根据上传的图片数量过滤可用模型
 * @param uploadedImagesCount 已上传的图片数量
 * @param models 模型列表
 * @returns 过滤后的模型列表（包含 isAvailable 属性）
 */
export function filterModelsByImageCount(
  uploadedImagesCount: number, 
  models: ModelConfig[]
): (ModelConfig & { isAvailable: boolean })[] {
  return models.map(model => ({
    ...model,
    isAvailable: uploadedImagesCount > 0 ? 
      (model.use_i2i && uploadedImagesCount <= model.maxImages) : 
      model.use_t2i
  })).sort((a, b) => {
    // 可用的模型排在前面
    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;
    return 0;
  });
}

/**
 * 模型步数和分辨率阈值配置
 * 如果某个模型的配置为 null，表示该模型不支持该选项的修改
 */
export interface ModelThresholds {
  normalSteps: number | null;      // 普通步数，null表示不支持修改
  highSteps: number | null;         // 高步数，null表示不支持修改
  normalResolutionPixels: number | null;  // 普通分辨率总像素，null表示不支持修改
  highResolutionPixels: number | null;     // 高分辨率总像素，null表示不支持修改
}

/**
 * 模型步数和分辨率阈值配置表
 */
export const MODEL_THRESHOLDS: Record<string, ModelThresholds> = {
  "Z-Image-Turbo": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,      // 1048576
    highResolutionPixels: 1416 * 1416,       // 2005056
  },
  "Qwen-Image-Edit": {
    normalSteps: null,      // 不支持修改
    highSteps: null,        // 不支持修改
    normalResolutionPixels: null,  // 不支持修改
    highResolutionPixels: null,    // 不支持修改
  },
  "Wai-SDXL-V150": {
    normalSteps: 20,        // 低步数20
    highSteps: 30,          // 高步数30
    normalResolutionPixels: 1024 * 1024,      // 1048576
    highResolutionPixels: 1416 * 1416,       // 2005056
  },
  // 其他模型默认配置（如果需要可以添加）
  "Flux-Krea": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
  "Flux-Kontext": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
  "Flux-Dev": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
  "Stable-Diffusion-3.5": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
  "HiDream-full-fp8": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
  "Qwen-Image": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
  "Flux-2": {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  },
};

/**
 * 获取模型的步数和分辨率阈值配置
 * @param modelId 模型ID
 * @returns 阈值配置，如果模型未配置则返回默认值
 */
export function getModelThresholds(modelId: string): ModelThresholds {
  return MODEL_THRESHOLDS[modelId] || {
    normalSteps: 10,
    highSteps: 20,
    normalResolutionPixels: 1024 * 1024,
    highResolutionPixels: 1416 * 1416,
  };
}

/**
 * 检查模型是否支持步数修改
 * @param modelId 模型ID
 * @returns 是否支持步数修改
 */
export function supportsStepsModification(modelId: string): boolean {
  const thresholds = getModelThresholds(modelId);
  return thresholds.normalSteps !== null && thresholds.highSteps !== null;
}

/**
 * 检查模型是否支持分辨率修改
 * @param modelId 模型ID
 * @returns 是否支持分辨率修改
 */
export function supportsResolutionModification(modelId: string): boolean {
  const thresholds = getModelThresholds(modelId);
  return thresholds.normalResolutionPixels !== null && thresholds.highResolutionPixels !== null;
}