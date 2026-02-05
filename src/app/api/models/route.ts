import { NextResponse } from 'next/server'
import { ALL_MODELS, type ModelConfig } from '@/utils/modelConfig'

// 模型环境变量映射（与 modelConfig.ts 保持一致）
const MODEL_ENV_MAP = {
  "HiDream-full-fp8": "HiDream_Fp8_URL",
  "Flux-Dev": "Flux_Dev_URL", 
  "Flux-Kontext": "Kontext_fp8_URL",
  "Stable-Diffusion-3.5": "Stable_Diffusion_3_5_URL",
  "Flux-Krea": "Flux_Krea_URL",
  "Qwen-Image": "Qwen_Image_URL",
  "Qwen-Image-Edit": "Qwen_Image_Edit_URL",
  "Wai-SDXL-V150": "Wai_SDXL_V150_URL",
  "Z-Image": "Z_IMAGE_URL",
  "Z-Image-Turbo": "Z_Image_Turbo_URL",
  "Flux-2": "Flux_2_URL"
} as const;

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
