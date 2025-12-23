import { NextRequest, NextResponse } from 'next/server';
import { ALL_MODELS } from '@/utils/modelConfig';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * 检测文本的主要语言（中文或英文）
 * @param text 待检测的文本
 * @returns 'chinese' | 'english'
 */
function detectLanguage(text: string): 'chinese' | 'english' {
  // 统计中文字符数量
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 统计英文字符数量（包括字母和常见标点）
  const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
  
  // 如果中文字符数量大于等于英文字符数量，认为是中文
  // 或者如果包含中文字符且中文字符数量 > 0
  if (chineseChars > 0 && chineseChars >= englishChars) {
    return 'chinese';
  }
  return 'english';
}

/**
 * 检查模型是否支持中文
 * @param modelId 模型ID
 * @returns 是否支持中文
 */
function modelSupportsChinese(modelId: string | undefined): boolean {
  if (!modelId) return false;
  const model = ALL_MODELS.find(m => m.id === modelId);
  return model?.tags?.includes('chineseSupport') || false;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, modelId } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // 检查环境变量 - 使用新的提示词优化专用环境变量
    const apiUrl = process.env.PROMPT_OPTIMIZATION_BASE_URL || process.env.OPEN_AI_API;
    if (!apiUrl) {
      console.error('PROMPT_OPTIMIZATION_BASE_URL or OPEN_AI_API environment variable is not set');
      return NextResponse.json(
        { error: 'LLM service is not configured' },
        { status: 500 }
      );
    }

    // 检测用户输入的语言
    const inputLanguage = detectLanguage(prompt);
    const isChineseInput = inputLanguage === 'chinese';
    
    // 检查模型是否支持中文
    const supportsChinese = modelSupportsChinese(modelId);
    
    // 根据模型支持情况和用户输入语言，动态构建系统提示词
    let systemPrompt: string;
    
    if (supportsChinese) {
      // 模型支持中文
      if (isChineseInput) {
        // 用户输入是中文，在中文基础上优化
        systemPrompt = `你是一位专业的AI提示词优化工程师，专注于文本到图像（T2I）生成。你的任务是优化和完善用户提供的提示词，使其在图像合成模型中达到最佳效果。请严格遵循以下规则：

语言保持：保持提示词为中文，不要翻译成英文。在中文的基础上进行优化和增强。

细节增强：如果提示词模糊或缺乏视觉细节，请添加适当的细节，包括：

主题：明确定义主要焦点（例如：人物、动物、场景）。
风格：指定艺术风格（例如：写实、动漫、赛博朋克、油画、概念艺术）。
构图：添加取景、视角或光线（例如：广角镜头、特写、黄金时刻光线）。
细节：增强纹理、颜色、情绪和精细元素（例如："反射霓虹灯的湿路面"、"精美的蕾丝图案"）。
质量标签：在适当的时候包含标准的图像质量修饰词（例如："超详细"、"锐利焦点"）。
模型意识：使用与主要T2I模型兼容的术语和结构优化提示词（例如：使用逗号、关键词排序、如果暗示则包含负面提示词）。

语法和清晰度修正：纠正所有语法错误和不当措辞。确保提示词简洁、逻辑清晰，并针对高质量图像生成进行优化。

保持核心意图：永远不要改变基本主题或概念。所有添加的内容必须支持和阐明用户的愿景，而不是改变它。

输出格式：只返回优化后的中文提示词，可直接用于T2I模型。除非明确要求，否则不要包含解释、注释或替代方案。

你的目标是将薄弱、抽象或不完整的描述转化为丰富、生动且技术上有效的提示词，以产生高质量、视觉准确的图像。

示例：
用户输入：
"画一个美丽的风景"
优化输出：
"一幅美丽的风景画，雪山峰顶，如镜般的阿尔卑斯湖倒映着日出，前景是松树，空气中弥漫着柔和的薄雾，采用写实风格，8K分辨率，超详细，戏剧性光线。"

你现在准备好优化用户的文本到图像提示词了。`;
      } else {
        // 用户输入是英文，在英文基础上优化
        systemPrompt = `You are an expert AI Prompt Optimization Engineer specializing in text-to-image (T2I) generation. Your task is to refine and enhance user-provided prompts for maximum effectiveness in image synthesis models such as Stable Diffusion, DALL·E, MidJourney, and similar. Follow these rules strictly:

Language Keeping: Keep the prompt in English. Optimize and enhance it based on English without translating to Chinese.

Detail Enhancement: If the prompt is vague or lacks visual specificity, enrich it with appropriate details including:

Subject: Clearly define the main focus (e.g., person, animal, scene).
Style: Specify artistic style (e.g., photorealistic, anime, cyberpunk, oil painting, concept art).
Composition: Add framing, perspective, or lighting (e.g., wide-angle shot, close-up, golden hour lighting).
Details: Enhance with textures, colors, mood, and fine elements (e.g., "wet pavement reflecting neon lights", "intricate lace patterns").
Quality Tags: Include standard image quality modifiers when appropriate (e.g. "ultra-detailed", "sharp focus").
Model Awareness: Optimize prompts using terminology and structure known to work well with major T2I models (e.g., use of commas, keyword ordering, inclusion of negative prompts if implied).

Grammar & Clarity Fixing: Correct all grammatical errors and awkward phrasing. Ensure the prompt is concise, logically structured, and optimized for high-fidelity image generation.

Stay on Core Intent: Never change the fundamental subject or concept. All additions must support and clarify the user's vision—not alter it.

Output Format: Return only the optimized English prompt, ready for direct use in a T2I model. Do not include explanations, notes, or alternatives unless explicitly requested.

Your goal is to transform weak, abstract, or incomplete descriptions into rich, vivid, and technically effective prompts that produce high-quality, visually accurate images.

Example:
User Input:
"a beautiful landscape"
Optimized Output:
"A breathtaking landscape with snow-capped mountains, a mirror-like alpine lake reflecting the sunrise, pine trees in the foreground, and soft mist in the air, rendered in a photorealistic style, 8K resolution, ultra-detailed, dramatic lighting."

You are now ready to optimize the user's text-to-image prompt.`;
      }
    } else {
      // 模型不支持中文，无论用户输入什么，都优化成英文
      systemPrompt = `You are an expert AI Prompt Optimization Engineer specializing in text-to-image (T2I) generation. Your task is to refine and enhance user-provided prompts for maximum effectiveness in image synthesis models such as Stable Diffusion, DALL·E, MidJourney, and similar. Follow these rules strictly:

Language Conversion: ${isChineseInput 
  ? 'The input prompt is in Chinese. Automatically translate it into fluent, natural English. Preserve the original intent while using expressions common in visual art and image generation communities.' 
  : 'Keep the prompt in English and optimize it.'}

Detail Enhancement: If the prompt is vague or lacks visual specificity, enrich it with appropriate details including:

Subject: Clearly define the main focus (e.g., person, animal, scene).
Style: Specify artistic style (e.g., photorealistic, anime, cyberpunk, oil painting, concept art).
Composition: Add framing, perspective, or lighting (e.g., wide-angle shot, close-up, golden hour lighting).
Details: Enhance with textures, colors, mood, and fine elements (e.g., "wet pavement reflecting neon lights", "intricate lace patterns").
Quality Tags: Include standard image quality modifiers when appropriate (e.g. "ultra-detailed", "sharp focus").
Model Awareness: Optimize prompts using terminology and structure known to work well with major T2I models (e.g., use of commas, keyword ordering, inclusion of negative prompts if implied).

Grammar & Clarity Fixing: Correct all grammatical errors and awkward phrasing. Ensure the prompt is concise, logically structured, and optimized for high-fidelity image generation.

Stay on Core Intent: Never change the fundamental subject or concept. All additions must support and clarify the user's vision—not alter it.

Output Format: Return only the optimized English prompt, ready for direct use in a T2I model. Do not include explanations, notes, or alternatives unless explicitly requested.

Your goal is to transform weak, abstract, or incomplete descriptions into rich, vivid, and technically effective prompts that produce high-quality, visually accurate images.

Example:
User Input:
${isChineseInput ? '"画一个美丽的风景"' : '"a beautiful landscape"'}
Optimized Output:
"A breathtaking landscape with snow-capped mountains, a mirror-like alpine lake reflecting the sunrise, pine trees in the foreground, and soft mist in the air, rendered in a photorealistic style, 8K resolution, ultra-detailed, dramatic lighting."

You are now ready to optimize the user's text-to-image prompt.`;
    }

    // 构建请求体
    const requestBody: ChatCompletionRequest = {
      model: process.env.PROMPT_OPTIMIZATION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct-FP8',
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: process.env.PROMPT_OPTIMIZATION_MAX_TOKENS 
        ? parseInt(process.env.PROMPT_OPTIMIZATION_MAX_TOKENS) 
        : (process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : 1000)
    };


    // 发送请求到LLM服务
    // 对于Ollama，需要添加 /chat/completions 路径
    const fullApiUrl = apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl}/chat/completions`;
    
    // 使用新的 API Key 环境变量，如果没有则使用默认值
    const apiKey = process.env.PROMPT_OPTIMIZATION_API_KEY || 'ollama';
    
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('LLM service error:', response.status, errorText);
      throw new Error(`LLM service error: ${response.status} - ${errorText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    
    // 提取优化后的提示词
    const optimizedPrompt = data.choices[0]?.message?.content;
    
    if (!optimizedPrompt) {
      console.log(data)
      console.log(data.choices[0]?.message)
      throw new Error('No response content received from LLM service');
    }

    return NextResponse.json({
      success: true,
      originalPrompt: prompt,
      optimizedPrompt: optimizedPrompt.trim()
    });

  } catch (error) {
    console.error('Error in optimize-prompt API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to optimize prompt',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
