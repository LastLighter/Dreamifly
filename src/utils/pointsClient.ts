import { getModelThresholds } from './modelConfig';

/**
 * 客户端计算图像生成的预计积分消耗
 * 注意：这是客户端估算，实际消耗可能因hasQuota而有所不同
 * @param baseCost 基础积分（按模型）
 * @param modelId 模型ID
 * @param steps 步数
 * @param width 图像宽度
 * @param height 图像高度
 * @returns 预计的总积分消耗
 */
export function calculateEstimatedCost(
  baseCost: number | null,
  modelId: string,
  steps: number,
  width: number,
  height: number
): number | null {
  // 如果模型没有配置基础积分消耗，返回null
  if (baseCost === null) {
    return null;
  }

  // 获取模型的阈值配置
  const thresholds = getModelThresholds(modelId);
  
  // 判断是否为高步数
  let isHighSteps = false;
  if (thresholds.normalSteps !== null && thresholds.highSteps !== null) {
    // 如果步数 >= 高步数阈值，则为高步数
    isHighSteps = steps >= thresholds.highSteps;
  }
  
  // 判断是否为高分辨率
  let isHighResolution = false;
  const totalPixels = width * height;
  if (thresholds.normalResolutionPixels !== null && thresholds.highResolutionPixels !== null) {
    // 如果总像素 > 普通分辨率阈值，则为高分辨率
    isHighResolution = totalPixels > thresholds.normalResolutionPixels;
  }
  
  // 计算总积分消耗
  let multiplier = 1;
  if (isHighSteps) multiplier *= 2;
  if (isHighResolution) multiplier *= 2;
  
  const totalCost = baseCost * multiplier;
  
  return totalCost;
}

