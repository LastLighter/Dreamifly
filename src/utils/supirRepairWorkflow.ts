const supirRepairWorkflowTemplate = {
  "1": {
    "inputs": {
      "ckpt_name": "sd_xl_base_1.0_0.9vae.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Checkpoint加载器（简易）"
    }
  },
  "2": {
    "inputs": {
      "supir_model": "SUPIR-v0Q.ckpt",
      "fp8_unet": false,
      "diffusion_dtype": "auto",
      "high_vram": false,
      "model": [
        "1",
        0
      ],
      "clip": [
        "1",
        1
      ],
      "vae": [
        "1",
        2
      ]
    },
    "class_type": "SUPIR_model_loader_v2",
    "_meta": {
      "title": "SUPIR Model Loader (v2)"
    }
  },
  "3": {
    "inputs": {
      "use_tiled_vae": true,
      "encoder_tile_size": 512,
      "decoder_tile_size": 512,
      "encoder_dtype": "auto",
      "SUPIR_VAE": [
        "2",
        1
      ],
      "image": [
        "11",
        0
      ]
    },
    "class_type": "SUPIR_first_stage",
    "_meta": {
      "title": "SUPIR First Stage (Denoiser)"
    }
  },
  "4": {
    "inputs": {
      "use_tiled_vae": true,
      "encoder_tile_size": 512,
      "encoder_dtype": "auto",
      "SUPIR_VAE": [
        "3",
        0
      ],
      "image": [
        "3",
        1
      ]
    },
    "class_type": "SUPIR_encode",
    "_meta": {
      "title": "SUPIR Encode"
    }
  },
  "5": {
    "inputs": {
      "positive_prompt": "high quality, detailed,4k",
      "negative_prompt": "bad quality, blurry, messy",
      "SUPIR_model": [
        "2",
        0
      ],
      "latents": [
        "3",
        2
      ]
    },
    "class_type": "SUPIR_conditioner",
    "_meta": {
      "title": "SUPIR Conditioner"
    }
  },
  "6": {
    "inputs": {
      "seed": 475197826553389,
      "steps": 35,
      "cfg_scale_start": 7,
      "cfg_scale_end": 7,
      "EDM_s_churn": 1,
      "s_noise": 1.0030000000000001,
      "DPMPP_eta": 0.1,
      "control_scale_start": 1,
      "control_scale_end": 1,
      "restore_cfg": 5,
      "keep_model_loaded": false,
      "sampler": "RestoreDPMPP2MSampler",
      "sampler_tile_size": 1024,
      "sampler_tile_stride": 512,
      "SUPIR_model": [
        "2",
        0
      ],
      "latents": [
        "4",
        0
      ],
      "positive": [
        "5",
        0
      ],
      "negative": [
        "5",
        1
      ]
    },
    "class_type": "SUPIR_sample",
    "_meta": {
      "title": "SUPIR Sampler"
    }
  },
  "7": {
    "inputs": {
      "use_tiled_vae": true,
      "decoder_tile_size": 512,
      "SUPIR_VAE": [
        "2",
        1
      ],
      "latents": [
        "6",
        0
      ]
    },
    "class_type": "SUPIR_decode",
    "_meta": {
      "title": "SUPIR Decode"
    }
  },
  "11": {
    "inputs": {
      "image": "123.jpg"
    },
    "class_type": "LoadImage",
    "_meta": {
      "title": "加载图像"
    }
  },
  "30": {
    "inputs": {
      "images": [
        "7",
        0
      ]
    },
    "class_type": "PreviewImage",
    "_meta": {
      "title": "预览图像"
    }
  },
  "32": {
    "inputs": {
      "rgthree_comparer": {
        "images": [
          {
            "name": "A",
            "selected": true,
            "url": "/api/view?filename=rgthree.compare._temp_qpmzj_00009_.png&type=temp&subfolder=&rand=0.10679655269071098"
          },
          {
            "name": "B",
            "selected": true,
            "url": "/api/view?filename=rgthree.compare._temp_qpmzj_00010_.png&type=temp&subfolder=&rand=0.9459863848476231"
          }
        ]
      },
      "image_a": [
        "7",
        0
      ],
      "image_b": [
        "11",
        0
      ]
    },
    "class_type": "Image Comparer (rgthree)",
    "_meta": {
      "title": "Image Comparer (rgthree)"
    }
  },
  "40": {
    "inputs": {
      "filename_prefix": "SupirRepair",
      "images": [
        "7",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  }
} as const

interface SupirRepairOptions {
  positivePrompt?: string
  negativePrompt?: string
  steps?: number
  seed?: number
}

interface SupirResponsePayload {
  images?: string[]
}

export async function runSupirRepairWorkflow(
  imageBase64: string,
  options: SupirRepairOptions = {}
): Promise<string> {
  if (!imageBase64) {
    throw new Error('缺少输入图片')
  }

  const baseUrl = process.env.Supir_Repair_URL
  if (!baseUrl) {
    throw new Error('Supir_Repair_URL 未配置，请在环境变量中设置')
  }

  const workflow: Record<string, any> = JSON.parse(JSON.stringify(supirRepairWorkflowTemplate))

  if (!workflow['11']) {
    throw new Error('工作流中缺少上传节点（11）')
  }

  workflow['11'].inputs.image = imageBase64
  workflow['11'].inputs.upload = 'image'

  if (options.positivePrompt) {
    workflow['5'].inputs.positive_prompt = options.positivePrompt
  }

  if (options.negativePrompt) {
    workflow['5'].inputs.negative_prompt = options.negativePrompt
  }

  if (typeof options.steps === 'number') {
    workflow['6'].inputs.steps = options.steps
  }

  if (typeof options.seed === 'number') {
    workflow['6'].inputs.seed = options.seed
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
    throw new Error(`Supir Repair 服务错误 (${response.status}): ${errorText || '未知错误'}`)
  }

  const text = await response.text()

  if (text.includes('no healthy upstream') || text.includes('upstream')) {
    throw new Error(`Supir Repair 服务不可用: ${text}`)
  }

  const data = JSON.parse(text) as SupirResponsePayload

  if (!data.images || data.images.length === 0) {
    throw new Error('Supir Repair 服务未返回图片')
  }

  return `data:image/png;base64,${data.images[0]}`
}

