// Z-Image-Turbo 工作流模板
const zImageTurboWorkflowTemplate = {
  "3": {
    "inputs": {
      "seed": 47447417949230,
      "steps": 9,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "16",
        0
      ],
      "positive": [
        "6",
        0
      ],
      "negative": [
        "7",
        0
      ],
      "latent_image": [
        "13",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "6": {
    "inputs": {
      "text": "cute anime style girl with massive fluffy fennec ears and a big fluffy tail blonde messy long hair blue eyes wearing a maid outfit with a long black gold leaf pattern dress and a white apron, it is a postcard held by a hand in front of a beautiful realistic city at sunset and there is cursive writing that says \"ZImage, Now in ComfyUI\"",
      "clip": [
        "18",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "7": {
    "inputs": {
      "text": "blurry ugly bad",
      "clip": [
        "18",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Negative Prompt)"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "3",
        0
      ],
      "vae": [
        "17",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "13": {
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
    "class_type": "EmptySD3LatentImage",
    "_meta": {
      "title": "空Latent图像（SD3）"
    }
  },
  "16": {
    "inputs": {
      "unet_name": "z_image_turbo_bf16.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNet加载器"
    }
  },
  "17": {
    "inputs": {
      "vae_name": "ae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "18": {
    "inputs": {
      "clip_name": "qwen_3_4b.safetensors",
      "type": "lumina2",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "加载CLIP"
    }
  }
}

const hidreamWorkflowTemplate = {
  "3": {
    "inputs": {
      "seed": 1008338326435302,
      "steps": 50,
      "cfg": 5,
      "sampler_name": "uni_pc",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "70",
        0
      ],
      "positive": [
        "16",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "53",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "3",
        0
      ],
      "vae": [
        "55",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "16": {
    "inputs": {
      "text": "The dusk thickens, lanterns flicker on.\nShadows flow over flagstones, past taverns heavy with aroma and fluttering silk fans.\nThen—a flute’s clear note splits the air, startling doves from the eaves.\nSomewhere, an opera singer’s tremolo melts into the night, steeped in tea and applause.",
      "clip": [
        "54",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Positive Prompt"
    }
  },
  "40": {
    "inputs": {
      "text": "blurry",
      "clip": [
        "54",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Negative Prompt"
    }
  },
  "53": {
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
    "class_type": "EmptySD3LatentImage",
    "_meta": {
      "title": "空Latent图像（SD3）"
    }
  },
  "54": {
    "inputs": {
      "clip_name1": "clip_l_hidream.safetensors",
      "clip_name2": "clip_g_hidream.safetensors",
      "clip_name3": "t5xxl_fp8_e4m3fn.safetensors",
      "clip_name4": "llama_3.1_8b_instruct_fp8_scaled.safetensors"
    },
    "class_type": "QuadrupleCLIPLoader",
    "_meta": {
      "title": "QuadrupleCLIPLoader"
    }
  },
  "55": {
    "inputs": {
      "vae_name": "ae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "69": {
    "inputs": {
      "unet_name": "hidream_i1_full_fp8.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNet加载器"
    }
  },
  "70": {
    "inputs": {
      "shift": 3.0000000000000004,
      "model": [
        "69",
        0
      ]
    },
    "class_type": "ModelSamplingSD3",
    "_meta": {
      "title": "采样算法（SD3）"
    }
  }
}

const fluxWorkflowTemplate = {
  "8": {
    "inputs": {
      "samples": [
        "40",
        0
      ],
      "vae": [
        "10",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "10": {
    "inputs": {
      "vae_name": "ae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "11": {
    "inputs": {
      "clip_name1": "t5xxl_fp8_e4m3fn.safetensors",
      "clip_name2": "clip_l.safetensors",
      "type": "flux",
      "device": "default"
    },
    "class_type": "DualCLIPLoader",
    "_meta": {
      "title": "双CLIP加载器"
    }
  },
  "17": {
    "inputs": {
      "scheduler": "normal",
      "steps": 25,
      "denoise": 1,
      "model": [
        "46",
        0
      ]
    },
    "class_type": "BasicScheduler",
    "_meta": {
      "title": "基本调度器"
    }
  },
  "38": {
    "inputs": {
      "model": [
        "46",
        0
      ],
      "conditioning": [
        "42",
        0
      ]
    },
    "class_type": "BasicGuider",
    "_meta": {
      "title": "基本引导器"
    }
  },
  "39": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "40": {
    "inputs": {
      "noise": [
        "45",
        0
      ],
      "guider": [
        "38",
        0
      ],
      "sampler": [
        "47",
        0
      ],
      "sigmas": [
        "17",
        0
      ],
      "latent_image": [
        "44",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "自定义采样器（高级）"
    }
  },
  "42": {
    "inputs": {
      "guidance": 3.5,
      "conditioning": [
        "43",
        0
      ]
    },
    "class_type": "FluxGuidance",
    "_meta": {
      "title": "Flux引导"
    }
  },
  "43": {
    "inputs": {
      "text": "best quality,a cute anime girl,sunshine,soft features,swing,a blue white edged dress,solo,flower,blue eyes,blush,blue flower,long hair,barefoot,sitting,looking at viewer,blue rose,blue theme,rose,light particles,pale skin,blue background,off shoulder,full body,smile,collarbone,long hair,blue hair,vines,plants,",
      "clip": [
        "11",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP文本编码"
    }
  },
  "44": {
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
    "class_type": "EmptySD3LatentImage",
    "_meta": {
      "title": "空Latent图像（SD3）"
    }
  },
  "45": {
    "inputs": {
      "noise_seed": 1114957019097397
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "随机噪波"
    }
  },
  "46": {
    "inputs": {
      "max_shift": 1.15,
      "base_shift": 0.5,
      "width": 1024,
      "height": 1024,
      "model": [
        "48",
        0
      ]
    },
    "class_type": "ModelSamplingFlux",
    "_meta": {
      "title": "采样算法（Flux）"
    }
  },
  "47": {
    "inputs": {
      "sampler_name": "euler"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "K采样器选择"
    }
  },
  "48": {
    "inputs": {
      "unet_name": "flux1-dev.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNet加载器"
    }
  }
}

const stableDiffusion3WorkflowTemplate = {
  "3": {
    "inputs": {
      "seed": 996048915053053,
      "steps": 30,
      "cfg": 4.5,
      "sampler_name": "euler",
      "scheduler": "sgm_uniform",
      "denoise": 1,
      "model": [
        "4",
        0
      ],
      "positive": [
        "16",
        0
      ],
      "negative": [
        "40",
        0
      ],
      "latent_image": [
        "53",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "4": {
    "inputs": {
      "ckpt_name": "sd3.5_large.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Checkpoint加载器（简易）"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "3",
        0
      ],
      "vae": [
        "4",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "16": {
    "inputs": {
      "text": "A dark-mode-friendly logo with glowing neon blue outlines forming a cloud and binary code particles, evoking 'always online' reliability.",
      "clip": [
        "43",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Positive Prompt"
    }
  },
  "40": {
    "inputs": {
      "text": "Vibrant tones, overexposed, static, details unclear,  worst quality, low quality, ugly, flawed, excessive fingers, poorly drawn hands, poorly drawn faces, deformed, disfigured, misshapen limbs, fingers merging, motionless image, cluttered background, three legs",
      "clip": [
        "43",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "Negative Prompt"
    }
  },
  "41": {
    "inputs": {
      "clip_name": "t5xxl_fp8_e4m3fn.safetensors",
      "type": "sd3",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "加载CLIP"
    }
  },
  "42": {
    "inputs": {
      "clip_name1": "clip_l.safetensors",
      "clip_name2": "clip_g.safetensors",
      "type": "sd3",
      "device": "default"
    },
    "class_type": "DualCLIPLoader",
    "_meta": {
      "title": "双CLIP加载器"
    }
  },
  "43": {
    "inputs": {
      "clip_name1": "clip_l.safetensors",
      "clip_name2": "clip_g.safetensors",
      "clip_name3": "t5xxl_fp8_e4m3fn.safetensors"
    },
    "class_type": "TripleCLIPLoader",
    "_meta": {
      "title": "三重CLIP加载器"
    }
  },
  "53": {
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
    "class_type": "EmptySD3LatentImage",
    "_meta": {
      "title": "空Latent图像（SD3）"
    }
  }
}

const FluxKreaWorkflowTemplate = {
  "8": {
    "inputs": {
      "samples": [
        "31",
        0
      ],
      "vae": [
        "39",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "flux_krea/flux_krea",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "27": {
    "inputs": {
      "width": 1280,
      "height": 1280,
      "batch_size": 1
    },
    "class_type": "EmptySD3LatentImage",
    "_meta": {
      "title": "空Latent图像（SD3）"
    }
  },
  "31": {
    "inputs": {
      "seed": 552296666437597,
      "steps": 25,
      "cfg": 1,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "38",
        0
      ],
      "positive": [
        "45",
        0
      ],
      "negative": [
        "42",
        0
      ],
      "latent_image": [
        "27",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "38": {
    "inputs": {
      "unet_name": "flux1-krea-dev.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNet加载器"
    }
  },
  "39": {
    "inputs": {
      "vae_name": "ae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "40": {
    "inputs": {
      "clip_name1": "clip_l.safetensors",
      "clip_name2": "t5xxl_fp8_e4m3fn_scaled.safetensors",
      "type": "flux",
      "device": "default"
    },
    "class_type": "DualCLIPLoader",
    "_meta": {
      "title": "双CLIP加载器"
    }
  },
  "42": {
    "inputs": {
      "conditioning": [
        "45",
        0
      ]
    },
    "class_type": "ConditioningZeroOut",
    "_meta": {
      "title": "条件零化"
    }
  },
  "45": {
    "inputs": {
      "text": "On a spring afternoon, cherry blossom petals drift gently through the air. A girl in a sailor uniform stands beneath the sakura tree, hearing familiar footsteps behind her. She turns slightly, her eyes soft and shy, cheeks blushing — as if the whole of spring pauses in that moment.",
      "clip": [
        "40",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP文本编码"
    }
  }
}

const qwenImageWorkflowTemplate = {
  "3": {
    "inputs": {
      "seed": 472458551817235,
      "steps": 20,
      "cfg": 2.5,
      "sampler_name": "euler",
      "scheduler": "simple",
      "denoise": 1,
      "model": [
        "66",
        0
      ],
      "positive": [
        "6",
        0
      ],
      "negative": [
        "7",
        0
      ],
      "latent_image": [
        "58",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  },
  "6": {
    "inputs": {
      "text": "cute anime girl with massive fennec ears and a big fluffy fox tail with long wavy blonde hair between eyes and large blue eyes blonde colored eyelashes chubby wearing oversized clothes summer uniform long blue maxi skirt muddy clothes happy sitting on the side of the road in a run down dark gritty cyberpunk city with neon and a crumbling skyscraper in the rain at night while dipping her feet in a river of water she is holding a sign that says \"ComfyUI is the best\" written in cursive",
      "clip": [
        "38",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "7": {
    "inputs": {
      "text": " ",
      "clip": [
        "38",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Negative Prompt)"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "3",
        0
      ],
      "vae": [
        "39",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "37": {
    "inputs": {
      "unet_name": "qwen_image_fp8_e4m3fn.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNet加载器"
    }
  },
  "38": {
    "inputs": {
      "clip_name": "qwen_2.5_vl_7b_fp8_scaled.safetensors",
      "type": "qwen_image",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "加载CLIP"
    }
  },
  "39": {
    "inputs": {
      "vae_name": "qwen_image_vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "58": {
    "inputs": {
      "width": 1328,
      "height": 1328,
      "batch_size": 1
    },
    "class_type": "EmptySD3LatentImage",
    "_meta": {
      "title": "空Latent图像（SD3）"
    }
  },
  "60": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "66": {
    "inputs": {
      "shift": 2.5,
      "model": [
        "37",
        0
      ]
    },
    "class_type": "ModelSamplingAuraFlow",
    "_meta": {
      "title": "采样算法（AuraFlow）"
    }
  }
}

export const zImageTurboT2IWorkflow = zImageTurboWorkflowTemplate as object;

export const waiSDXLV150Workflow = {
  "5": {
    "inputs": {
      "width": 1280,
      "height": 1280,
      "batch_size": 1
    },
    "class_type": "EmptyLatentImage",
    "_meta": {
      "title": "空Latent图像"
    }
  },
  "6": {
    "inputs": {
      "text": "smile,shirt,large breasts,long sleeves,holding,ribbon,closed mouth,cleavage,bare shoulders,sitting,collarbone,white shirt,flower,sidelocks,one eye closed,sky,collared shirt,day,indoors,artist name,off shoulder,red ribbon,cup,pillow,head tilt,feet out of frame,petals,window,dress shirt,buttons,shadow,watermark,bird,rose,white flower,light smile,red flower,curtains,holding cup,light particles,knee up,red rose,purple flower,mug,mountain,blanket,on couch,partially unbuttoned,single bare shoulder,white rose,hair spread out,coffee,reclining,mountainous horizon,waking up,coffee mug,half-closed eye,arm rest,holding drink,morning,asymmetrical sidelocks,single off shoulder,",
      "clip": [
        "20",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP文本编码"
    }
  },
  "7": {
    "inputs": {
      "text": "bad quality,worst quality,worst detail,",
      "clip": [
        "20",
        1
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP文本编码"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "30",
        0
      ],
      "vae": [
        "20",
        2
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "20": {
    "inputs": {
      "ckpt_name": "waiNSFWIllustrious_v150.safetensors"
    },
    "class_type": "CheckpointLoaderSimple",
    "_meta": {
      "title": "Checkpoint加载器（简易）"
    }
  },
  "27": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "30": {
    "inputs": {
      "seed": 1104207659704876,
      "steps": 20,
      "cfg": 5,
      "sampler_name": "ddim",
      "scheduler": "ddim_uniform",
      "denoise": 1,
      "model": [
        "20",
        0
      ],
      "positive": [
        "6",
        0
      ],
      "negative": [
        "7",
        0
      ],
      "latent_image": [
        "5",
        0
      ]
    },
    "class_type": "KSampler",
    "_meta": {
      "title": "K采样器"
    }
  }
}

const model1 = JSON.parse(JSON.stringify(hidreamWorkflowTemplate));
model1["69"].inputs.unet_name = "hidream_i1_full_fp8.safetensors";
export const hidreamFp8T2IWorkflow = model1 as object;

const model2 = JSON.parse(JSON.stringify(hidreamWorkflowTemplate));
model2["69"].inputs.unet_name = "hidream_i1_full_fp16.safetensors";
export const hidreamFp16T2IWorkflow = model2 as object;

const model3 = JSON.parse(JSON.stringify(fluxWorkflowTemplate))
export const fluxDevT2IWorkflow = model3 as object;

export const stableDiffusion3T2IWorkflow = stableDiffusion3WorkflowTemplate
export const fluxKreaT2IWorkflow = FluxKreaWorkflowTemplate as object;
export const qwenImageT2IWorkflow = qwenImageWorkflowTemplate as object;

// Flux-2 工作流模板
const flux2WorkflowTemplate = {
  "6": {
    "inputs": {
      "text": "cute anime girl with gigantic fennec ears and a big fluffy fox tail with long wavy blonde hair and large blue eyes blonde colored eyelashes wearing a pink sweater a large oversized gold trimmed black winter coat and a long blue maxi skirt and a red scarf, she is happy while singing on stage like an idol while holding a microphone, there are colorful lights, it is a postcard held by a hand in front of a beautiful city at sunset and there is cursive writing that says \"Flux 2, Now in ComfyUI\"",
      "clip": [
        "38",
        0
      ]
    },
    "class_type": "CLIPTextEncode",
    "_meta": {
      "title": "CLIP Text Encode (Positive Prompt)"
    }
  },
  "8": {
    "inputs": {
      "samples": [
        "13",
        0
      ],
      "vae": [
        "10",
        0
      ]
    },
    "class_type": "VAEDecode",
    "_meta": {
      "title": "VAE解码"
    }
  },
  "9": {
    "inputs": {
      "filename_prefix": "ComfyUI",
      "images": [
        "8",
        0
      ]
    },
    "class_type": "SaveImage",
    "_meta": {
      "title": "保存图像"
    }
  },
  "10": {
    "inputs": {
      "vae_name": "flux2-vae.safetensors"
    },
    "class_type": "VAELoader",
    "_meta": {
      "title": "加载VAE"
    }
  },
  "12": {
    "inputs": {
      "unet_name": "flux2_dev_fp8mixed.safetensors",
      "weight_dtype": "default"
    },
    "class_type": "UNETLoader",
    "_meta": {
      "title": "UNet加载器"
    }
  },
  "13": {
    "inputs": {
      "noise": [
        "25",
        0
      ],
      "guider": [
        "22",
        0
      ],
      "sampler": [
        "16",
        0
      ],
      "sigmas": [
        "48",
        0
      ],
      "latent_image": [
        "47",
        0
      ]
    },
    "class_type": "SamplerCustomAdvanced",
    "_meta": {
      "title": "自定义采样器（高级）"
    }
  },
  "16": {
    "inputs": {
      "sampler_name": "euler"
    },
    "class_type": "KSamplerSelect",
    "_meta": {
      "title": "K采样器选择"
    }
  },
  "22": {
    "inputs": {
      "model": [
        "12",
        0
      ],
      "conditioning": [
        "26",
        0
      ]
    },
    "class_type": "BasicGuider",
    "_meta": {
      "title": "基本引导器"
    }
  },
  "25": {
    "inputs": {
      "noise_seed": 435922656034510
    },
    "class_type": "RandomNoise",
    "_meta": {
      "title": "随机噪波"
    }
  },
  "26": {
    "inputs": {
      "guidance": 4,
      "conditioning": [
        "6",
        0
      ]
    },
    "class_type": "FluxGuidance",
    "_meta": {
      "title": "Flux引导"
    }
  },
  "38": {
    "inputs": {
      "clip_name": "mistral_3_small_flux2_fp8.safetensors",
      "type": "flux2",
      "device": "default"
    },
    "class_type": "CLIPLoader",
    "_meta": {
      "title": "加载CLIP"
    }
  },
  "47": {
    "inputs": {
      "width": 1024,
      "height": 1024,
      "batch_size": 1
    },
    "class_type": "EmptyFlux2LatentImage",
    "_meta": {
      "title": "Empty Flux 2 Latent"
    }
  },
  "48": {
    "inputs": {
      "steps": 20,
      "width": 1024,
      "height": 1024
    },
    "class_type": "Flux2Scheduler",
    "_meta": {
      "title": "Flux2Scheduler"
    }
  }
}

export const flux2T2IWorkflow = flux2WorkflowTemplate as object;