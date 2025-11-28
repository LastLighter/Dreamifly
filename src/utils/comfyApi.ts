import { hidreamFp8T2IWorkflow,  fluxDevT2IWorkflow, stableDiffusion3T2IWorkflow, fluxKreaT2IWorkflow, qwenImageT2IWorkflow, waiSDXLV150Workflow, zImageTurboT2IWorkflow, flux2T2IWorkflow } from "./t2iworkflow";
import { fluxI2IWorkflow, fluxKontextI2IMultiImageWorkflow, fluxKontextI2IWorkflow, QwenImageEdit2ImagesWorkflow, QwenImageEdit3ImagesWorkflow, QwenImageEditWorkflow } from "./i2iworkflow";
const T2IModelMap = {
  "HiDream-full-fp8": hidreamFp8T2IWorkflow,
  "Flux-Dev": fluxDevT2IWorkflow,
  "Stable-Diffusion-3.5": stableDiffusion3T2IWorkflow,
  "Flux-Krea": fluxKreaT2IWorkflow,
  "Qwen-Image": qwenImageT2IWorkflow,
  "Wai-SDXL-V150": waiSDXLV150Workflow,
  "Z-Image-Turbo": zImageTurboT2IWorkflow,
  "Flux-2": flux2T2IWorkflow
}

const I2IModelMap = {
  "Qwen-Image-Edit": QwenImageEditWorkflow,
  "Flux-Dev": fluxI2IWorkflow,
  "Flux-Kontext": fluxKontextI2IWorkflow
}

interface ComfyUIResponse {
  images: string[];
}

interface GenerateParams {
  prompt: string;
  width: number;
  height: number;
  steps: number;
  seed?: number;
  batch_size: number;
  model: string;
  images?: string[];
  negative_prompt?: string;
}

export async function generateImage(params: GenerateParams): Promise<string> {
  // 1. 准备工作流数据
  let workflow = {};
  if(params.images && params.images.length > 0){
    if(params.model === 'Flux-Kontext' && params.images.length > 1){
      workflow = fluxKontextI2IMultiImageWorkflow
    }else if(params.model === 'Qwen-Image-Edit' && params.images.length == 2){
      workflow = QwenImageEdit2ImagesWorkflow
    }else if(params.model === 'Qwen-Image-Edit' && params.images.length == 3){
      workflow = QwenImageEdit3ImagesWorkflow
    }else{
      workflow = I2IModelMap[params.model as keyof typeof I2IModelMap];
    }
  }else{
    workflow = T2IModelMap[params.model as keyof typeof T2IModelMap];
  }

  // 检查工作流是否加载成功
  if (!workflow || Object.keys(workflow).length === 0) {
    throw new Error(`模型 ${params.model} 的工作流未找到或为空`);
  }

  // 深拷贝工作流，避免修改原始模板
  workflow = JSON.parse(JSON.stringify(workflow));

  let baseUrl = '';
  if(params.model === 'HiDream-full-fp8') {
    baseUrl = process.env.HiDream_Fp8_URL || ''
    setHiDreamWT2IorkflowParams(workflow, params);
    console.log('HiDream-full-fp8', workflow)
  }else if(params.model === 'Flux-Dev') {
    baseUrl = process.env.Flux_Dev_URL || ''
    if(params.images && params.images.length > 0){
      setFluxDevI2IorkflowParams(workflow, params);
    }else{
      setFluxDevWT2IorkflowParams(workflow, params);
    }
  }else if(params.model === 'Flux-Kontext') {
    baseUrl = process.env.Kontext_fp8_URL || ''
    if(params.images && params.images.length > 0){
      setFluxKontxtI2IorkflowParams(workflow, params);
    }
  }else if(params.model === 'Stable-Diffusion-3.5') {
    baseUrl = process.env.Stable_Diffusion_3_5_URL || ''
    setStableDiffusion3T2IorkflowParams(workflow, params);
  }else if(params.model === 'Flux-Krea') {
    baseUrl = process.env.Flux_Krea_URL || ''
    setFluxKreaT2IorkflowParams(workflow, params);
  }else if(params.model === 'Qwen-Image') {
    baseUrl = process.env.Qwen_Image_URL || ''
    setQwenImageT2IorkflowParams(workflow, params);
  }else if(params.model === 'Qwen-Image-Edit') {
    baseUrl = process.env.Qwen_Image_Edit_URL || ''
    setQwenImageEditorkflowParams(workflow, params);
  }else if(params.model === 'Wai-SDXL-V150') {
    baseUrl = process.env.Wai_SDXL_V150_URL || ''
    setWaiSDXLV150T2IorkflowParams(workflow, params);
  }else if(params.model === 'Z-Image-Turbo') {
    baseUrl = process.env.Z_Image_Turbo_URL || ''
    setZImageTurboT2IorkflowParams(workflow, params);
    console.log('Z-Image-Turbo workflow:', JSON.stringify(workflow, null, 2));
  }else if(params.model === 'Flux-2') {
    baseUrl = process.env.Flux_2_URL || ''
    setFlux2T2IorkflowParams(workflow, params);
    console.log('Flux-2 workflow configured, baseUrl:', baseUrl ? `${baseUrl.substring(0, 50)}...` : 'NOT SET');
  }

  // 检查baseUrl是否配置
  if (!baseUrl) {
    throw new Error(`模型 ${params.model} 的服务URL未配置，请检查环境变量`);
  }

  // 规范化 baseUrl（移除末尾斜杠）
  baseUrl = baseUrl.replace(/\/+$/, '');

  try {
    // 2. 发送提示请求并等待响应
    const apiEndpoint = `${baseUrl}/prompt`;
    console.log(`[${params.model}] 调用 API: ${apiEndpoint}`);
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: workflow }),
    });

    // 检查HTTP响应状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${params.model}] API 错误响应:`, {
        status: response.status,
        statusText: response.statusText,
        url: apiEndpoint,
        error: errorText
      });
      
      // 如果是 404 错误，提供更详细的提示
      if (response.status === 404) {
        throw new Error(`API 端点不存在 (404): ${apiEndpoint}。请检查 ${params.model} 的服务URL配置是否正确，确保指向正确的 ComfyUI 服务地址`);
      }
      
      // 如果是 503 错误，提供连接相关的提示
      if (response.status === 503) {
        throw new Error(`ComfyUI服务不可用 (503): ${errorText || '无法连接到服务'}。请检查 ${params.model} 的服务是否正在运行，以及环境变量 ${params.model === 'Flux-2' ? 'Flux_2_URL' : 'URL'} 配置是否正确`);
      }
      
      throw new Error(`ComfyUI服务错误 (${response.status}): ${errorText || '未知错误'}`);
    }

    let base64Image: string = '';
    let text = ''
    try {
      text = await response.text();
      
      // 检查响应是否为"no healthy upstream"错误
      if (text.includes('no healthy upstream') || text.includes('upstream')) {
        throw new Error(`ComfyUI服务不可用: ${text}。请检查服务是否正常运行`);
      }
      
      const data = JSON.parse(text) as ComfyUIResponse;
      
      // 检查响应数据格式
      if (!data || !data.images || !Array.isArray(data.images) || data.images.length === 0) {
        throw new Error(`无效的响应格式: 缺少images数据`);
      }
      
      base64Image = "data:image/png;base64," + data.images[0];
    } catch (parseError) {
      // 如果已经是Error对象，直接抛出
      if (parseError instanceof Error) {
        throw parseError;
      }
      // 否则包装为错误
      throw new Error(`无法解析ComfyUI响应: ${text.substring(0, 200)}`);
    }

    return base64Image;
  } catch (error) {
    console.error('Error generating image:', error);
    // 如果是网络错误，提供更友好的错误信息
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`无法连接到ComfyUI服务 (${baseUrl})。请检查服务是否正常运行`);
    }
    throw error;
  }
}

function setHiDreamWT2IorkflowParams(workflow: any, params: GenerateParams) {
  // 更新工作流参数
  workflow["53"].inputs.width = params.width;
  workflow["53"].inputs.height = params.height;
  workflow["16"].inputs.text = params.prompt;
  workflow["3"].inputs.steps = params.steps;
  if (params.seed) {
    workflow["3"].inputs.seed = params.seed;
  }
}
function setFluxDevWT2IorkflowParams(workflow: any, params: GenerateParams) {
  workflow["44"].inputs.width = params.width;
  workflow["44"].inputs.height = params.height;
  workflow["46"].inputs.width = params.width;
  workflow["46"].inputs.height = params.height;
  // workflow["5"].inputs.batch_size = params.batch_size;
  workflow["43"].inputs.text = params.prompt;
  workflow["17"].inputs.steps = params.steps;
  if (params.seed) {
    workflow["45"].inputs.noise_seed = params.seed;
  }
}

function setFluxDevI2IorkflowParams(workflow: any, params: GenerateParams) {
  workflow["50"].inputs.image = params.images?.[0];
  workflow["52"].inputs.width = params.width;
  workflow["52"].inputs.height = params.height;
  workflow["46"].inputs.width = params.width;
  workflow["46"].inputs.height = params.height;
  if (params.seed) {
    workflow["45"].inputs.noise_seed = params.seed;
  }
  workflow["43"].inputs.text = params.prompt;
}

// function setHiDreamI2IorkflowParams(workflow: any, params: GenerateParams) {
//   // 更新工作流参数
//   workflow["74"].inputs.image = params.image;
//   workflow["76"].inputs.width = params.width;
//   workflow["76"].inputs.height = params.height;
//   workflow["16"].inputs.text = params.prompt;
//   workflow["3"].inputs.steps = params.steps;
//   if (params.seed) {
//     workflow["3"].inputs.seed = params.seed;
//   }
//   if (params.denoise) {
//     workflow["3"].inputs.denoise = params.denoise;
//   }
// }

function setFluxKontxtI2IorkflowParams(workflow: any, params: GenerateParams) {
  if(params.images && params?.images.length > 1){
    workflow["192"].inputs.image = params.images?.[0];
    workflow["193"].inputs.image = params.images?.[1];
    workflow["188"].inputs.width = params.width;
    workflow["188"].inputs.height = params.height;
  }else{
    workflow["142"].inputs.image = params.images?.[0];
    workflow["189"].inputs.target_width = params.width;
    workflow["189"].inputs.target_height = params.height;
  }
  workflow["6"].inputs.text = params.prompt;
  workflow["31"].inputs.steps = params.steps;
  if (params.seed) {
    workflow["31"].inputs.seed = params.seed;
  }
  //denoise = 1
}

function setStableDiffusion3T2IorkflowParams(workflow: any, params: GenerateParams) {
  workflow["53"].inputs.width = params.width;
  workflow["53"].inputs.height = params.height;
  workflow["16"].inputs.text = params.prompt;
  workflow["3"].inputs.steps = params.steps;
  if (params.seed) {
    workflow["3"].inputs.seed = params.seed;
  }
}

function setFluxKreaT2IorkflowParams(workflow: any, params: GenerateParams) {
  workflow["31"].inputs.steps = params.steps;
  workflow["27"].inputs.width = params.width;
  workflow["27"].inputs.height = params.height;
  workflow["45"].inputs.text = params.prompt;
  if (params.seed) {
    workflow["31"].inputs.seed = params.seed;
  }
}

function setQwenImageT2IorkflowParams(workflow: any, params: GenerateParams) {
  workflow["58"].inputs.width = params.width;
  workflow["58"].inputs.height = params.height;
  workflow["3"].inputs.seed = params.seed;
  workflow["6"].inputs.text = params.prompt;
  workflow["3"].inputs.steps = params.steps;
  if (params.negative_prompt) {
    workflow["7"].inputs.text = params.negative_prompt;
  }
}

function setQwenImageEditorkflowParams(workflow: any, params: GenerateParams) {
  if(params.images && params.images.length >= 1){
    workflow["78"].inputs.image = params.images?.[0];
    if(params.images.length >= 2){
      workflow["79"].inputs.image = params.images?.[1];
      if(params.images.length == 3){
        workflow["80"].inputs.image = params.images?.[2];
      }
    }
  }
  workflow["111"].inputs.prompt = params.prompt;
  workflow["3"].inputs.steps = 4
  workflow["112"].inputs.width = params.width;
  workflow["112"].inputs.height = params.height;
  if (params.seed) {
    workflow["3"].inputs.seed = params.seed;
  }
  if (params.negative_prompt) {
    workflow["110"].inputs.prompt = params.negative_prompt;
  }
}

function setWaiSDXLV150T2IorkflowParams(workflow: any, params: GenerateParams) {
  workflow["30"].inputs.steps = params.steps;
  workflow["5"].inputs.width = params.width;
  workflow["5"].inputs.height = params.height;
  workflow["6"].inputs.text = params.prompt;
  if (params.seed) {
    workflow["30"].inputs.seed = params.seed;
  }
  if (params.negative_prompt) {
    workflow["7"].inputs.text = params.negative_prompt;
  }
}

function setZImageTurboT2IorkflowParams(workflow: any, params: GenerateParams) {
  try {
    // 检查工作流节点是否存在
    if (!workflow["13"] || !workflow["13"].inputs) {
      throw new Error('工作流节点 "13" (EmptySD3LatentImage) 不存在');
    }
    if (!workflow["6"] || !workflow["6"].inputs) {
      throw new Error('工作流节点 "6" (CLIPTextEncode Positive) 不存在');
    }
    if (!workflow["3"] || !workflow["3"].inputs) {
      throw new Error('工作流节点 "3" (KSampler) 不存在');
    }
    if (params.negative_prompt && (!workflow["7"] || !workflow["7"].inputs)) {
      throw new Error('工作流节点 "7" (CLIPTextEncode Negative) 不存在');
    }

    workflow["13"].inputs.width = params.width;
    workflow["13"].inputs.height = params.height;
    workflow["6"].inputs.text = params.prompt;
    workflow["3"].inputs.steps = params.steps;
    if (params.seed) {
      workflow["3"].inputs.seed = params.seed;
    }
    if (params.negative_prompt) {
      workflow["7"].inputs.text = params.negative_prompt;
    }
  } catch (error) {
    console.error('Error setting Z-Image-Turbo workflow params:', error);
    console.error('Workflow structure:', Object.keys(workflow));
    throw error;
  }
}

function setFlux2T2IorkflowParams(workflow: any, params: GenerateParams) {
  try {
    // 检查工作流节点是否存在
    if (!workflow["47"] || !workflow["47"].inputs) {
      throw new Error('工作流节点 "47" (EmptyFlux2LatentImage) 不存在');
    }
    if (!workflow["6"] || !workflow["6"].inputs) {
      throw new Error('工作流节点 "6" (CLIPTextEncode Positive) 不存在');
    }
    if (!workflow["48"] || !workflow["48"].inputs) {
      throw new Error('工作流节点 "48" (Flux2Scheduler) 不存在');
    }
    if (!workflow["25"] || !workflow["25"].inputs) {
      throw new Error('工作流节点 "25" (RandomNoise) 不存在');
    }

    workflow["47"].inputs.width = params.width;
    workflow["47"].inputs.height = params.height;
    workflow["48"].inputs.width = params.width;
    workflow["48"].inputs.height = params.height;
    workflow["48"].inputs.steps = params.steps;
    workflow["6"].inputs.text = params.prompt;
    if (params.seed) {
      workflow["25"].inputs.noise_seed = params.seed;
    }
    // 注意：Flux-2 工作流示例中没有负面提示词节点，如果需要可以添加
  } catch (error) {
    console.error('Error setting Flux-2 workflow params:', error);
    console.error('Workflow structure:', Object.keys(workflow));
    throw error;
  }
}
