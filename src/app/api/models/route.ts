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
  "Wai-SDXL-V150": "Wai_SDXL_V150_URL",
  "Z-Image-Turbo": "Z_Image_Turbo_URL",
  "Flux-2": "Flux_2_URL"
} as const;

// 基础模型配置
interface ModelConfig {
  id: string;
  name: string;
  image: string;
  homepageCover?: string; // 主页竖屏封面，默认为 /models/homepageModelCover/demo.jpg
  description?: string; // 模型描述
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
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "一个基于SDXL、光辉系列的第三方社区模型，特长动漫类角色的绘制。",
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
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "Qwen-Image-Edit是阿里巴巴通义千问团队开发的图像编辑模型，专门用于图像内容编辑和修改。该模型支持基于文本指令的图像编辑，能够精确理解编辑需求并保持图像的整体风格和细节。",
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
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "FLUX.1 Krea [dev] 是 Black Forest Labs (BFL) 和 Krea AI 联合开发的开源文本到图像生成模型。该模型旨在克服传统 AI 图像生成中常见的\"AI 味\"问题，如\"过饱和\"、\"高光过曝\"和\"塑料感\"，追求更真实、多样的输出。",
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
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "Flux Kontext[Dev] 是 Black Forest Labs 开发的 12B 参数图像编辑模型，支持通过文本和图像输入进行精确编辑。",
    use_i2i: true,
    use_t2i: false,
    maxImages: 2,
    isRecommended: true
  },
  {
    id: "Flux-Dev",
    name: "Flux-Dev",
    image: "/models/Flux-Dev.jpg",
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "FLUX.1-Dev 是由 Black Forest Labs 开发的开源 AI 艺术模型，具有强大的视觉创作能力和优秀的文本理解性能。",
    use_i2i: true,
    use_t2i: true,
    maxImages: 1,
    tags: ["fastGeneration"]
  },
  {
    id: "Stable-Diffusion-3.5",
    name: "Stable-Diffusion-3.5",
    image: "/models/StableDiffusion-3.5.jpg",
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "Stable Diffusion 3.5是Stability AI推出的升级版文生图模型，采用改进的扩散架构，支持更高分辨率，优化了提示词理解与细节生成，可生成更逼真、连贯的图像。",
    use_i2i: false,
    use_t2i: true,
    maxImages: 1,
    tags: ["fastGeneration"]
  },
  {
    id: "HiDream-full-fp8",
    name: "HiDream-full-fp8",
    image: "/models/HiDream-full.jpg",
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "HiDream-I1 是 AI 艺术领域最出色、最先进的模型之一，由北京智象未来科技有限公司开发。",
    use_i2i: false,
    use_t2i: true,
    maxImages: 1,
    tags: ["chineseSupport"]
  },
  {
    id: "Qwen-Image",
    name: "Qwen-Image",
    image: "/models/Qwen-Image.jpg",
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "Qwen-Image是阿里巴巴通义千问团队发布的首个图像生成基础模型，基于MMDiT架构，拥有20B参数并已开源。该模型不仅支持写实、动漫、赛博朋克等多种风格的图像生成与风格转换，还具备图像内容编辑、细节增强和文字添加等能力。",
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
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "Z-Image-Turbo 是一个支持中文的快速文生图模型，基于 Lumina2 架构，能够快速生成高质量的图像，特别适合中文提示词输入。",
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
    homepageCover: "/models/homepageModelCover/demo.jpg",
    description: "生成照片级真实感图像,具备多参考一致性与专业文字渲染。",
    use_i2i: false,
    use_t2i: true,
    maxImages: 0,
    tags: ["fastGeneration"],
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
