/**
 * 调用LLM接口优化提示词
 * @param prompt 用户输入的原始提示词
 * @returns 优化后的提示词
 */
export async function optimizePrompt(prompt: string): Promise<string> {
  try {
    console.log('Calling local API to optimize prompt...');
    
    // 调用我们的本地API端点
    const response = await fetch('/api/optimize-prompt', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} - ${errorData.error || 'Unknown error'}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.optimizedPrompt) {
      throw new Error('Invalid response from optimization API');
    }

    console.log('Prompt optimization successful');
    return data.optimizedPrompt;

  } catch (error) {
    console.error('Error optimizing prompt:', error);
    
    // 如果API调用失败，返回原始提示词并添加一些基本优化
    return fallbackOptimization(prompt);
  }
}

/**
 * 备用优化方案：当LLM调用失败时使用
 * @param prompt 原始提示词
 * @returns 基本优化后的提示词
 */
function fallbackOptimization(prompt: string): string {
  // 简单的备用优化逻辑
  let optimized = prompt;
  
  // 如果是中文，添加一些通用的英文描述
  if (/[\u4e00-\u9fa5]/.test(prompt)) {
    optimized = `${prompt}, high quality, detailed, 8K resolution, professional photography`;
  } else {
    // 如果是英文，添加一些通用的质量描述
    optimized = `${prompt}, high quality, detailed, professional`;
  }
  
  return optimized;
}

/**
 * 检查提示词是否需要优化
 * @param prompt 提示词
 * @returns 是否需要优化
 * 
 * 注意：这个函数现在主要用于参考，不再阻止用户手动优化
 */
export function needsOptimization(prompt: string): boolean {
  // 检查提示词是否过短或缺乏细节
  if (prompt.length < 10) return true;
  
  // 检查是否包含中文（通常需要翻译优化）
  if (/[\u4e00-\u9fa5]/.test(prompt)) return true;
  
  // 检查是否缺乏具体的描述词
  const detailKeywords = ['style', 'quality', 'detailed', 'realistic', 'artistic', 'format'];
  const hasDetailKeywords = detailKeywords.some(keyword => 
    prompt.toLowerCase().includes(keyword)
  );
  
  return !hasDetailKeywords;
}
