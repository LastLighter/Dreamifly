import { NextRequest, NextResponse } from 'next/server';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
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
  if (chineseChars > 0 && chineseChars >= englishChars) {
    return 'chinese';
  }
  return 'english';
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, image } = await request.json();

    // 图片是必需的
    if (!image || typeof image !== 'string') {
      return NextResponse.json(
        { error: 'Image is required and must be a base64 string' },
        { status: 400 }
      );
    }

    // 提示词是可选的，如果为空则生成新提示词
    const hasPrompt = prompt && typeof prompt === 'string' && prompt.trim().length > 0;

    // 检查环境变量
    const apiUrl = process.env.PROMPT_OPTIMIZATION_BASE_URL || process.env.OPEN_AI_API;
    if (!apiUrl) {
      console.error('PROMPT_OPTIMIZATION_BASE_URL or OPEN_AI_API environment variable is not set');
      return NextResponse.json(
        { error: 'LLM service is not configured' },
        { status: 500 }
      );
    }

    // 检测用户输入的语言（如果有提示词）
    const inputLanguage = hasPrompt ? detectLanguage(prompt) : 'chinese';
    const isChineseInput = inputLanguage === 'chinese';

    // 构建系统提示词 - 针对图生视频场景
    let systemPrompt: string;
    
    if (hasPrompt) {
      // 有提示词：优化现有提示词
      if (isChineseInput) {
        systemPrompt = `你是一位专业的AI提示词优化工程师，专注于图像到视频（I2V）生成。你的任务是基于用户提供的参考图片和提示词，优化和完善提示词，使其在视频生成模型中达到最佳效果。请严格遵循以下规则：

语言保持：保持提示词为中文，不要翻译成英文。在中文的基础上进行优化和增强。

图片分析：仔细分析用户提供的参考图片，理解图片中的内容、风格、构图、光线、色彩等视觉元素。

细节增强：基于参考图片和用户提示词，添加适当的细节，包括：

主题：明确定义主要焦点（例如：人物、动物、场景、物体）。
风格：指定艺术风格（例如：写实、动漫、赛博朋克、油画、概念艺术），应与参考图片风格一致。
构图：添加取景、视角或光线描述（例如：广角镜头、特写、黄金时刻光线），应与参考图片构图相符。
动作和动态：为视频生成添加适当的动作描述（例如：缓慢移动、旋转、缩放、淡入淡出）。
细节：增强纹理、颜色、情绪和精细元素（例如："反射霓虹灯的湿路面"、"精美的蕾丝图案"）。
质量标签：在适当的时候包含标准的视频质量修饰词（例如："超详细"、"流畅运动"、"稳定画面"）。
模型意识：使用与主要I2V模型兼容的术语和结构优化提示词（例如：使用逗号、关键词排序、动作描述）。

语法和清晰度修正：纠正所有语法错误和不当措辞。确保提示词简洁、逻辑清晰，并针对高质量视频生成进行优化。

保持核心意图：永远不要改变基本主题或概念。所有添加的内容必须支持和阐明用户的愿景，而不是改变它。确保优化后的提示词与参考图片内容一致。

输出格式：只返回优化后的中文提示词，可直接用于I2V模型。除非明确要求，否则不要包含解释、注释或替代方案。

你的目标是将薄弱、抽象或不完整的描述转化为丰富、生动且技术上有效的提示词，结合参考图片的视觉特征，以产生高质量、视觉准确的视频。

你现在准备好优化用户的图像到视频提示词了。`;
    } else {
      systemPrompt = `You are an expert AI Prompt Optimization Engineer specializing in image-to-video (I2V) generation. Your task is to refine and enhance user-provided prompts based on the reference image for maximum effectiveness in video synthesis models. Follow these rules strictly:

Language Keeping: Keep the prompt in English. Optimize and enhance it based on English without translating to Chinese.

Image Analysis: Carefully analyze the reference image provided by the user, understanding the visual elements such as content, style, composition, lighting, colors, etc.

Detail Enhancement: Based on the reference image and user prompt, enrich with appropriate details including:

Subject: Clearly define the main focus (e.g., person, animal, scene, object).
Style: Specify artistic style (e.g., photorealistic, anime, cyberpunk, oil painting, concept art) that matches the reference image style.
Composition: Add framing, perspective, or lighting descriptions (e.g., wide-angle shot, close-up, golden hour lighting) that match the reference image composition.
Motion and Dynamics: Add appropriate motion descriptions for video generation (e.g., slow movement, rotation, zoom, fade in/out).
Details: Enhance with textures, colors, mood, and fine elements (e.g., "wet pavement reflecting neon lights", "intricate lace patterns").
Quality Tags: Include standard video quality modifiers when appropriate (e.g., "ultra-detailed", "smooth motion", "stable footage").
Model Awareness: Optimize prompts using terminology and structure known to work well with major I2V models (e.g., use of commas, keyword ordering, motion descriptions).

Grammar & Clarity Fixing: Correct all grammatical errors and awkward phrasing. Ensure the prompt is concise, logically structured, and optimized for high-fidelity video generation.

Stay on Core Intent: Never change the fundamental subject or concept. All additions must support and clarify the user's vision—not alter it. Ensure the optimized prompt is consistent with the reference image content.

Output Format: Return only the optimized English prompt, ready for direct use in an I2V model. Do not include explanations, notes, or alternatives unless explicitly requested.

Your goal is to transform weak, abstract, or incomplete descriptions into rich, vivid, and technically effective prompts that combine the visual characteristics of the reference image to produce high-quality, visually accurate videos.

You are now ready to optimize the user's image-to-video prompt.`;
      }
    } else {
      // 没有提示词：生成新提示词
      systemPrompt = `你是一位专业的AI提示词生成工程师，专注于图像到视频（I2V）生成。你的任务是基于用户提供的参考图片，生成一段详细、专业的提示词，用于将静态图片转换为动态视频。请严格遵循以下规则：

语言：使用中文生成提示词。

图片分析：仔细分析参考图片中的所有视觉元素，包括：
- 主要内容：人物、动物、物体、场景等
- 艺术风格：写实、动漫、油画、概念艺术等
- 构图和视角：广角、特写、俯视、仰视等
- 光线和色彩：自然光、人工光、暖色调、冷色调等
- 细节特征：纹理、材质、装饰等

提示词生成：基于图片内容生成一段完整的提示词，包括：
- 主题描述：清晰描述图片中的主要内容
- 风格说明：指定艺术风格，应与图片风格一致
- 构图信息：描述取景、视角、光线等
- 动作建议：为视频生成添加适当的动作描述（例如：缓慢移动、旋转、缩放、淡入淡出、风吹效果等）
- 细节增强：添加纹理、颜色、情绪等细节
- 质量标签：包含视频质量修饰词（例如："超详细"、"流畅运动"、"稳定画面"、"电影级画质"）

输出格式：只返回生成的提示词，可直接用于I2V模型。不要包含解释、注释或其他内容。

你的目标是生成一段丰富、生动且技术上有效的提示词，能够准确描述参考图片的内容，并适合用于图像到视频的生成。

你现在准备好基于参考图片生成图像到视频提示词了。`;
    }

    // 构建图片URL（base64格式）
    const imageUrl = image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

    // 构建请求体 - 使用多模态消息格式
    const requestBody: ChatCompletionRequest = {
      model: process.env.PROMPT_OPTIMIZATION_MODEL || 'Qwen/Qwen3-VL-8B-Instruct-FP8',
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: hasPrompt 
            ? [
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl
                  }
                },
                {
                  type: "text",
                  text: `请基于这张参考图片优化以下提示词，使其更适合图像到视频生成：\n\n${prompt}`
                }
              ]
            : [
                {
                  type: "image_url",
                  image_url: {
                    url: imageUrl
                  }
                },
                {
                  type: "text",
                  text: `请基于这张参考图片生成一段详细的提示词，用于图像到视频生成。提示词应该准确描述图片内容，并包含适合视频生成的动作和动态效果描述。`
                }
              ]
        }
      ],
      temperature: 0.7,
      max_tokens: process.env.PROMPT_OPTIMIZATION_MAX_TOKENS 
        ? parseInt(process.env.PROMPT_OPTIMIZATION_MAX_TOKENS) 
        : (process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : 1000)
    };

    // 发送请求到LLM服务
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
      throw new Error('No response content received from LLM service');
    }

    return NextResponse.json({
      success: true,
      originalPrompt: prompt,
      optimizedPrompt: optimizedPrompt.trim()
    });

  } catch (error) {
    console.error('Error in optimize-video-prompt API:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to optimize prompt',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

