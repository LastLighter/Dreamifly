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
  "Wai-SDXL-V150": "Wai_SDXL_V150_URL"
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
