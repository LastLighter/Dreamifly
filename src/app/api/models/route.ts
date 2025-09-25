import { NextResponse } from 'next/server'

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
interface ModelConfig {
  id: string;
  name: string;
  image: string;
  use_i2i: boolean;
  use_t2i: boolean;
  maxImages: number;
  tags?: string[];
  isRecommended?: boolean;
}

// 完整的模型配置列表
const ALL_MODELS: ModelConfig[] = [
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
    maxImages: 1,
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
 */
function isModelConfigured(modelId: string): boolean {
  const envVarName = MODEL_ENV_MAP[modelId as keyof typeof MODEL_ENV_MAP];
  if (!envVarName) {
    return false;
  }
  
  const envValue = process.env[envVarName];
  return Boolean(envValue && envValue.trim() !== '');
}

/**
 * 获取可用的模型列表（基于环境变量配置）
 */
function getAvailableModels(): ModelConfig[] {
  return ALL_MODELS.filter(model => {
    // 检查是否配置了环境变量
    return isModelConfigured(model.id);
  });
}

export async function GET() {
  try {
    const availableModels = getAvailableModels();
    
    return NextResponse.json({
      models: availableModels,
      total: availableModels.length
    });
  } catch (error) {
    console.error('Error fetching available models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available models' },
      { status: 500 }
    );
  }
}
