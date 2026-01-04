/**
 * 调用LLM接口优化图生视频提示词
 * @param prompt 用户输入的原始提示词（可选，如果为空则生成新提示词）
 * @param image 参考图片的base64字符串（不含data:前缀）
 * @returns 优化后的提示词
 */
export async function optimizeVideoPrompt(prompt: string, image: string): Promise<string> {
  try {
    
    // 调用我们的本地API端点
    const response = await fetch('/api/optimize-video-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, image })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.optimizedPrompt) {
      throw new Error('Invalid response from optimization API');
    }

    return data.optimizedPrompt;

  } catch (error) {
    console.error('Error optimizing video prompt:', error);
    
    // 如果API调用失败，返回原始提示词并添加一些基本优化
    return fallbackOptimization(prompt);
  }
}

/**
 * 备用优化方案：当LLM调用失败时使用
 * @param prompt 原始提示词（可能为空）
 * @returns 基本优化后的提示词
 */
function fallbackOptimization(prompt: string): string {
  // 如果提示词为空，返回一个通用的视频生成提示词
  if (!prompt || prompt.trim().length === 0) {
    return '高质量视频，流畅运动，稳定画面，电影级画质，超详细，专业摄影';
  }
  
  // 基本优化：添加一些通用的视频生成质量标签
  let optimized = prompt;
  
  // 如果提示词不包含质量相关词汇，添加一些
  const qualityKeywords = ['high quality', 'detailed', 'smooth motion', 'stable', '高质量', '流畅', '稳定'];
  const hasQualityKeywords = qualityKeywords.some(keyword => 
    optimized.toLowerCase().includes(keyword)
  );
  
  if (!hasQualityKeywords) {
    optimized = `${prompt}, high quality, detailed, smooth motion, stable footage`;
  }
  
  return optimized;
}

