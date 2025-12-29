import { VideoModelConfig } from './videoModelConfig';

/**
 * 根据视频模型配置生成工作流
 * @param modelConfig 视频模型配置
 * @param options 生成选项
 * @returns 工作流对象
 */
export function generateVideoWorkflow(
  modelConfig: VideoModelConfig,
  options: {
    prompt: string;
    negativePrompt?: string;
    width: number;
    height: number;
    length?: number;
    fps?: number;
    seed?: number;
    steps?: number;
    imagePath?: string; // 输入图片文件名（用于 I2V）
  }
): Record<string, any> {
  // 深拷贝工作流模板，避免修改原始模板
  // 注意：这里不直接读取JSON文件，而是构建工作流对象
  const workflow: Record<string, any> = {
    "6": {
      "inputs": {
        "text": options.prompt,
        "clip": ["38", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Positive Prompt)"
      }
    },
    "7": {
      "inputs": {
        "text": options.negativePrompt || "",
        "clip": ["38", 0]
      },
      "class_type": "CLIPTextEncode",
      "_meta": {
        "title": "CLIP Text Encode (Negative Prompt)"
      }
    },
    "8": {
      "inputs": {
        "samples": ["58", 0],
        "vae": ["39", 0]
      },
      "class_type": "VAEDecode",
      "_meta": {
        "title": "VAE解码"
      }
    },
    "37": {
      "inputs": {
        "unet_name": modelConfig.files.unetHighNoise,
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNet加载器"
      }
    },
    "38": {
      "inputs": {
        "clip_name": modelConfig.files.clip,
        "type": "wan",
        "device": "default"
      },
      "class_type": "CLIPLoader",
      "_meta": {
        "title": "加载CLIP"
      }
    },
    "39": {
      "inputs": {
        "vae_name": modelConfig.files.vae
      },
      "class_type": "VAELoader",
      "_meta": {
        "title": "加载VAE"
      }
    },
    "54": {
      "inputs": {
        "shift": 5.000000000000001,
        "model": ["67", 0]
      },
      "class_type": "ModelSamplingSD3",
      "_meta": {
        "title": "采样算法（SD3）"
      }
    },
    "55": {
      "inputs": {
        "shift": 5.000000000000001,
        "model": ["68", 0]
      },
      "class_type": "ModelSamplingSD3",
      "_meta": {
        "title": "采样算法（SD3）"
      }
    },
    "56": {
      "inputs": {
        "unet_name": modelConfig.files.unetLowNoise,
        "weight_dtype": "default"
      },
      "class_type": "UNETLoader",
      "_meta": {
        "title": "UNet加载器"
      }
    },
    "57": {
      "inputs": {
        "add_noise": "enable",
        "noise_seed": options.seed || 42,
        "steps": options.steps || 4,
        "cfg": 1,
        "sampler_name": "euler",
        "scheduler": "simple",
        "start_at_step": 0,
        "end_at_step": Math.ceil((options.steps || 4) / 2),
        "return_with_leftover_noise": "enable",
        "model": ["54", 0],
        "positive": ["73", 0],
        "negative": ["73", 1],
        "latent_image": ["73", 2]
      },
      "class_type": "KSamplerAdvanced",
      "_meta": {
        "title": "K采样器（高级）"
      }
    },
    "58": {
      "inputs": {
        "add_noise": "disable",
        "noise_seed": options.seed || 42,
        "steps": options.steps || 4,
        "cfg": 1,
        "sampler_name": "euler",
        "scheduler": "simple",
        "start_at_step": Math.ceil((options.steps || 4) / 2),
        "end_at_step": options.steps || 4,
        "return_with_leftover_noise": "disable",
        "model": ["55", 0],
        "positive": ["73", 0],
        "negative": ["73", 1],
        "latent_image": ["57", 0]
      },
      "class_type": "KSamplerAdvanced",
      "_meta": {
        "title": "K采样器（高级）"
      }
    },
    "60": {
      "inputs": {
        "fps": options.fps || modelConfig.defaultFps || 20,
        "images": ["8", 0]
      },
      "class_type": "CreateVideo",
      "_meta": {
        "title": "创建视频"
      }
    },
    "61": {
      "inputs": {
        "filename_prefix": "WanVideo2_2_I2V_Lightning",
        "format": "mp4",
        "codec": "h264",
        "video": ["60", 0]
      },
      "class_type": "SaveVideo",
      "_meta": {
        "title": "保存视频"
      }
    },
    "67": {
      "inputs": {
        "lora_name": modelConfig.files.loraHighNoise,
        "strength_model": 1.0000000000000002,
        "model": ["37", 0]
      },
      "class_type": "LoraLoaderModelOnly",
      "_meta": {
        "title": "LoRA加载器（仅模型）"
      }
    },
    "68": {
      "inputs": {
        "lora_name": modelConfig.files.loraLowNoise,
        "strength_model": 1.0000000000000002,
        "model": ["56", 0]
      },
      "class_type": "LoraLoaderModelOnly",
      "_meta": {
        "title": "LoRA加载器（仅模型）"
      }
    },
    "71": {
      "inputs": {
        "image": options.imagePath || "",
        "upload": "image"
      },
      "class_type": "LoadImage",
      "_meta": {
        "title": "加载图像"
      }
    },
    "73": {
      "inputs": {
        "width": options.width,
        "height": options.height,
        "length": options.length || modelConfig.defaultLength || 100,
        "batch_size": 1,
        "positive": ["6", 0],
        "negative": ["7", 0],
        "vae": ["39", 0],
        "start_image": ["71", 0]
      },
      "class_type": "WanImageToVideo",
      "_meta": {
        "title": "Wan图像到视频"
      }
    }
  };

  return workflow;
}

