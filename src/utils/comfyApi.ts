import { hidreamFp8T2IWorkflow,  fluxDevT2IWorkflow, stableDiffusion3T2IWorkflow, fluxKreaT2IWorkflow, qwenImageT2IWorkflow, waiSDXLV150Workflow } from "./t2iworkflow";
import { fluxI2IWorkflow, fluxKontextI2IMultiImageWorkflow, fluxKontextI2IWorkflow, QwenImageEdit2ImagesWorkflow, QwenImageEdit3ImagesWorkflow, QwenImageEditWorkflow } from "./i2iworkflow";
const T2IModelMap = {
  "HiDream-full-fp8": hidreamFp8T2IWorkflow,
  "Flux-Dev": fluxDevT2IWorkflow,
  "Stable-Diffusion-3.5": stableDiffusion3T2IWorkflow,
  "Flux-Krea": fluxKreaT2IWorkflow,
  "Qwen-Image": qwenImageT2IWorkflow,
  "Wai-SDXL-V150": waiSDXLV150Workflow
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
  denoise?: number;
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
  }

  try {
    // 2. 发送提示请求并等待响应
    const response = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: workflow }),
    });

    let base64Image: string = '';
    let text = ''
    try {
      text = await response.text();
      const data = JSON.parse(text) as ComfyUIResponse;
      base64Image = "data:image/png;base64," + data.images[0];
    } catch {
      throw new Error(`Invalid JSON response: ${text}`);
    }

    return base64Image;
  } catch (error) {
    console.error('Error generating image:', error);
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
  if (params.denoise) {
    workflow["17"].inputs.denoise = params.denoise;
  }
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
