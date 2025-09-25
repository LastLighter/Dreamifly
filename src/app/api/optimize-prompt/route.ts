import { NextRequest, NextResponse } from 'next/server';

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

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    // 检查环境变量
    const apiUrl = process.env.OPEN_AI_API;
    if (!apiUrl) {
      console.error('OPEN_AI_API environment variable is not set');
      return NextResponse.json(
        { error: 'LLM service is not configured' },
        { status: 500 }
      );
    }

    // 构建系统提示词
    const systemPrompt = `You are an expert AI Prompt Optimization Engineer specializing in text-to-image (T2I) generation. Your task is to refine and enhance user-provided prompts for maximum effectiveness in image synthesis models such as Stable Diffusion, DALL·E, MidJourney, and similar. Follow these rules strictly:

Language Conversion: If the input prompt is in Chinese, automatically translate it into fluent, natural English. Preserve the original intent while using expressions common in visual art and image generation communities.

Detail Enhancement: If the prompt is vague or lacks visual specificity, enrich it with appropriate details including:

Subject: Clearly define the main focus (e.g., person, animal, scene).
Style: Specify artistic style (e.g., photorealistic, anime, cyberpunk, oil painting, concept art).
Composition: Add framing, perspective, or lighting (e.g., wide-angle shot, close-up, golden hour lighting).
Details: Enhance with textures, colors, mood, and fine elements (e.g., "wet pavement reflecting neon lights", "intricate lace patterns").
Quality Tags: Include standard image quality modifiers when appropriate (e.g. "ultra-detailed", "sharp focus").
Model Awareness: Optimize prompts using terminology and structure known to work well with major T2I models (e.g., use of commas, keyword ordering, inclusion of negative prompts if implied).

Grammar & Clarity Fixing: Correct all grammatical errors and awkward phrasing. Ensure the prompt is concise, logically structured, and optimized for high-fidelity image generation.

Stay on Core Intent: Never change the fundamental subject or concept. All additions must support and clarify the user’s vision—not alter it.

Output Format: Return only the optimized English prompt, ready for direct use in a T2I model. Do not include explanations, notes, or alternatives unless explicitly requested.

Your goal is to transform weak, abstract, or incomplete descriptions into rich, vivid, and technically effective prompts that produce high-quality, visually accurate images.

Example:
User Input:
“画一个美丽的风景”
Optimized Output:
"A breathtaking landscape with snow-capped mountains, a mirror-like alpine lake reflecting the sunrise, pine trees in the foreground, and soft mist in the air, rendered in a photorealistic style, 8K resolution, ultra-detailed, dramatic lighting."

You are now ready to optimize the user's text-to-image prompt.`;

    // 构建请求体
    const requestBody: ChatCompletionRequest = {
      model: "gpt-oss:20b",
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
      max_tokens: process.env.MAX_TOKENS ? parseInt(process.env.MAX_TOKENS) : 1000
    };


    // 发送请求到LLM服务
    // 对于Ollama，需要添加 /chat/completions 路径
    const fullApiUrl = apiUrl.endsWith('/chat/completions') ? apiUrl : `${apiUrl}/chat/completions`;
    
    const response = await fetch(fullApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ollama' // 本地模型使用占位符密钥
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
