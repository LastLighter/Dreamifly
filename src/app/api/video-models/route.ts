import { NextResponse } from 'next/server'
import { ALL_VIDEO_MODELS, type VideoModelConfig } from '@/utils/videoModelConfig'

// 视频模型环境变量映射（与 videoModelConfig.ts 保持一致）
const VIDEO_MODEL_ENV_MAP = {
  "Wan2.2-I2V-Lightning": "WAN_I2V_URL",
  // 可以添加更多视频模型
} as const;

/**
 * 检查视频模型是否在环境变量中配置了URL
 */
function isVideoModelConfigured(modelId: string): boolean {
  const envVarName = VIDEO_MODEL_ENV_MAP[modelId as keyof typeof VIDEO_MODEL_ENV_MAP];
  if (!envVarName) {
    return false;
  }
  
  const envValue = process.env[envVarName];
  return Boolean(envValue && envValue.trim() !== '');
}

/**
 * 获取可用的视频模型列表（基于环境变量配置）
 */
function getAvailableVideoModels(): VideoModelConfig[] {
  return ALL_VIDEO_MODELS.filter(model => {
    // 检查是否配置了环境变量
    return isVideoModelConfigured(model.id);
  });
}

export async function GET() {
  try {
    const availableModels = getAvailableVideoModels();
    
    return NextResponse.json({
      models: availableModels,
      total: availableModels.length
    });
  } catch (error) {
    console.error('Error fetching available video models:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available video models' },
      { status: 500 }
    );
  }
}

