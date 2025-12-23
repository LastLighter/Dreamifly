const supirUpscaleWorkflowTemplate = {
  "1": {
    "inputs": {
      "supir_model": "SUPIR-v0Q.ckpt",
      "sdxl_model": "sd_xl_base_1.0_0.9vae.safetensors",
      "seed": 608078894450978,
      "resize_method": "lanczos",
      "scale_by": 1,
      "steps": 30,
      "restoration_scale": 2,
      "cfg_scale": 7.5,
      "a_prompt": "",
      "n_prompt": "bad quality, blurry, messy",
      "s_churn": 5,
      "s_noise": 1.003,
      "control_scale": 1,
      "cfg_scale_start": 0,
      "control_scale_start": 0,
      "color_fix_type": "Wavelet",
      "keep_model_loaded": true,
      "use_tiled_vae": true,
      "encoder_tile_size_pixels": 512,
      "decoder_tile_size_latent": 544,
      "diffusion_dtype": "auto",
      "encoder_dtype": "auto",
      "batch_size": 1,
      "use_tiled_sampling": false,
      "sampler_tile_size": 512,
      "sampler_tile_stride": 512,
      "fp8_unet": false,
      "fp8_vae": false,
      "sampler": "RestoreEDMSampler",
      "image": [
        "2",
        0
      ]
    },
    "class_type": "SUPIR_Upscale",
    "_meta": {
      "title": "SUPIR Upscale (Legacy)"
    }
  },
  "2": {
    "inputs": {
      "image": "banner.png"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "加载图像"
    }
  },
  "10": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "1",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  }
} as const

interface SupirUpscaleOptions {
  scaleBy?: number
  positivePrompt?: string
  negativePrompt?: string
  steps?: number
  seed?: number
}

interface SupirResponsePayload {
  images?: string[]
}

export async function runSupirUpscaleWorkflow(
  imageBase64: string,
  options: SupirUpscaleOptions = {}
): Promise<string> {
  if (!imageBase64) {
    throw new Error('缺少输入图片')
  }

  const baseUrl = process.env.Supir_Repair_URL
  if (!baseUrl) {
    throw new Error('Supir_Repair_URL 未配置，请在环境变量中设置')
  }

  const workflow: Record<string, any> = JSON.parse(JSON.stringify(supirUpscaleWorkflowTemplate))

  if (!workflow['2']) {
    throw new Error('工作流中缺少上传节点（2）')
  }

  workflow['2'].inputs.image = imageBase64
  workflow['2'].inputs.upload = 'image'

  // 设置放大倍数
  if (typeof options.scaleBy === 'number' && options.scaleBy > 0) {
    workflow['1'].inputs.scale_by = options.scaleBy
  }

  if (options.positivePrompt) {
    workflow['1'].inputs.a_prompt = options.positivePrompt
  }

  if (options.negativePrompt) {
    workflow['1'].inputs.n_prompt = options.negativePrompt
  }

  if (typeof options.steps === 'number') {
    workflow['1'].inputs.steps = options.steps
  }

  // 如果没有传递 seed，动态生成一个随机种子
  if (typeof options.seed === 'number') {
    workflow['1'].inputs.seed = options.seed
  } else {
    // 动态生成随机种子：0 到 4294967295 (2^32-1)
    workflow['1'].inputs.seed = Math.floor(Math.random() * 4294967296)
  }

  const response = await fetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt: workflow })
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `Supir Upscale 服务错误 (${response.status})`
    
    if (response.status === 404) {
      errorMessage = 'Supir Upscale 服务不可用，请检查服务配置或联系管理员'
    } else if (response.status === 500) {
      // 尝试解析详细错误信息
      if (errorText) {
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.error || errorJson.message || errorJson.detail || errorMessage
        } catch {
          // 如果不是 JSON，使用原始文本（限制长度避免过长）
          if (errorText.length < 500) {
            errorMessage = `Supir Upscale 服务内部错误: ${errorText}`
          } else {
            errorMessage = `Supir Upscale 服务内部错误: ${errorText.substring(0, 500)}...`
          }
        }
      } else {
        errorMessage = 'Supir Upscale 服务内部错误，请稍后重试'
      }
    } else if (errorText) {
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorJson.message || errorMessage
      } catch {
        // 如果不是 JSON，使用原始文本
        if (errorText.length < 200) {
          errorMessage = `${errorMessage}: ${errorText}`
        }
      }
    }
    
    throw new Error(errorMessage)
  }

  const text = await response.text()

  if (text.includes('no healthy upstream') || text.includes('upstream')) {
    throw new Error(`Supir Upscale 服务不可用: ${text}`)
  }

  const data = JSON.parse(text) as SupirResponsePayload

  if (!data.images || data.images.length === 0) {
    throw new Error('Supir Upscale 服务未返回图片')
  }

  return `data:image/png;base64,${data.images[0]}`
}

