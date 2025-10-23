import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { getAvailableModels, filterModelsByImageCount, type ModelConfig } from '@/utils/modelConfig'

type ModelWithAvailability = ModelConfig & { isAvailable: boolean };

interface GenerateFormProps {
  width: number;
  setWidth: (value: number) => void;
  height: number;
  setHeight: (value: number) => void;
  steps: number;
  setSteps: (value: number) => void;
  batch_size: number;
  setBatchSize: (value: number) => void;
  model: string;
  setModel: (value: string) => void;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  onGenerate: () => void;
  isAdvancedOpen: boolean;
  setIsAdvancedOpen: (value: boolean) => void;
  promptRef: React.RefObject<HTMLTextAreaElement | null>;
  communityWorks: { prompt: string }[];
  isGenerating: boolean;
  uploadedImages: string[];
  setUploadedImages: (value: string[] | ((prev: string[]) => string[])) => void;
  stepsError?: string | null;
  batchSizeError?: string | null;
  imageCountError?: string | null;
  stepsRef?: React.RefObject<HTMLInputElement | null>;
  batchSizeRef?: React.RefObject<HTMLInputElement | null>;
  generatedImageToSetAsReference?: string | null;
  setIsQueuing?: (value: boolean) => void;
}

export default function GenerateForm({
  width,
  setWidth,
  height,
  setHeight,
  steps,
  setSteps,
  batch_size,
  setBatchSize,
  model,
  setModel,
  status,
  onGenerate,
  isAdvancedOpen,
  setIsAdvancedOpen,
  isGenerating,
  uploadedImages,
  setUploadedImages,
  stepsError,
  batchSizeError,
  imageCountError,
  stepsRef,
  batchSizeRef,
  generatedImageToSetAsReference,
  setIsQueuing: setIsQueuingProp
}: GenerateFormProps) {
  const t = useTranslations('home.generate')
  const [progress, setProgress] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(0)
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const modelDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [isQueuing, setIsQueuing] = useState(false)
  
  // 获取未登录用户延迟时间（秒）
  const unauthDelay = parseInt(process.env.NEXT_PUBLIC_UNAUTHENTICATED_USER_DELAY || '20', 10)

  // 获取标签样式的函数
  const getTagStyle = (tag: string) => {
    switch (tag) {
      case 'chineseSupport':
        return 'bg-gradient-to-r from-orange-600/30 to-amber-600/30 text-amber-900 border-amber-500/40';
      case 'fastGeneration':
        return 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 text-emerald-900 border-emerald-500/40';
      case 'realisticStyle':
        return 'bg-gradient-to-r from-purple-600/30 to-violet-600/30 text-violet-900 border-violet-500/40';
      default:
        return 'bg-gradient-to-r from-gray-600/30 to-slate-600/30 text-slate-900 border-slate-500/40';
    }
  };

  // 防抖的拖拽状态更新
  const setDraggingWithDebounce = (value: boolean) => {
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current)
    }
    
    if (value) {
      setIsDragging(true)
    } else {
      dragTimeoutRef.current = setTimeout(() => {
        setIsDragging(false)
      }, 100) // 100ms 防抖延迟
    }
  }

  // 加载可用模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelsLoading(true);
        const models = await getAvailableModels();
        setAvailableModels(models);
      } catch (error) {
        console.error('Failed to load models:', error);
        // 如果加载失败，使用空数组
        setAvailableModels([]);
      } finally {
        setModelsLoading(false);
      }
    };

    loadModels();
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isGenerating) {
      // 计算预期时间：基于像素数、步数和模型
      // 基准：1024*1024像素，30步 = 60秒 (HiDream-full-fp8)
      const basePixels = 1024 * 1024;
      const baseSteps = 30;
      const baseTime = 60;
      
      // 模型时间系数
      const modelTimeFactors = {
        'HiDream-full-fp16': 2.0,    // 两倍于 fp8
        'HiDream-full-fp8': 1.0,     // 基准
        'Flux-Dev': 0.67,            // 40s/60s
        'Flux-Kontext': 1.0,         // 40s/60s
        'Flux-Krea': 0.67,           // 40s/60s (与Flux-Dev类似)
        'Stable-Diffusion-3.5': 0.67,  // 40s/60s
        'Qwen-Image': 1.5,             // 48s/60s
        'Qwen-Image-Edit': 1.2,
        'Wai-SDXL-V150': 0.1
      };
      
      const currentPixels = width * height;
      const pixelFactor = currentPixels / basePixels;
      const stepsFactor = steps / baseSteps;
      const modelFactor = modelTimeFactors[model as keyof typeof modelTimeFactors] || 1.0;
      
      const generationTime = baseTime * pixelFactor * stepsFactor * modelFactor;
      // 预期时间只显示生图时间，不包含排队时间
      setEstimatedTime(generationTime);
      
      // 如果用户未登录，先设置排队状态
      if (status === 'unauthenticated') {
        setIsQueuing(true);
        setIsQueuingProp?.(true);
      }
      
      // 进度条动画
      let currentProgress = 0;
      const startTime = Date.now();
      let queuingEnded = false; // 使用局部变量而不是state来避免重新渲染导致timer重置
      
      timer = setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000; // 转换为秒
        
        // 如果用户未登录且在排队期间
        if (status === 'unauthenticated' && elapsedTime < unauthDelay) {
          // 排队期间进度保持为0
          setProgress(0);
          return;
        }
        
        // 排队结束，开始生成（只执行一次）
        if (status === 'unauthenticated' && !queuingEnded) {
          queuingEnded = true;
          setIsQueuing(false);
          setIsQueuingProp?.(false);
        }
        
        // 计算实际生成的时间比例（排除排队时间）
        const generationElapsedTime = status === 'unauthenticated' 
          ? elapsedTime - unauthDelay 
          : elapsedTime;
        const timeRatio = generationElapsedTime / generationTime;
        
        // 计算目标进度
        let targetProgress;
        if (timeRatio < 0.2) {
          // 前20%时间快速进展到30%
          targetProgress = timeRatio * 2 * 30;
        } else if (timeRatio < 0.8) {
          // 20%-80%时间进展到80%
          targetProgress = 40 + (timeRatio - 0.2) * (40 / 0.6);
        } else {
          // 最后20%时间进展到95%
          targetProgress = 80 + (timeRatio - 0.8) * (15 / 0.2);
        }
        
        // 平滑过渡到目标进度
        const maxStep = 0.5; // 每帧最大进度变化
        const step = Math.min(maxStep, Math.abs(targetProgress - currentProgress));
        
        if (targetProgress > currentProgress) {
          currentProgress = Math.min(95, currentProgress + step);
        } else {
          currentProgress = Math.max(currentProgress - step, currentProgress);
        }
        
        setProgress(currentProgress);
      }, 50); // 更频繁的更新以获得更平滑的动画
    } else {
      setProgress(0);
      setEstimatedTime(0);
      setIsQueuing(false);
      setIsQueuingProp?.(false);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isGenerating, steps, width, height, model, status, unauthDelay, setIsQueuingProp]);

  // Add click outside handler for dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 清理防抖定时器
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current)
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isGenerating) return
    
    setProgress(0)
    onGenerate()
  }

  // 获取当前模型信息
  const currentModel = availableModels.find(m => m.id === model);
  const maxImages = currentModel?.maxImages || 1;
  const canUploadMore = uploadedImages.length < maxImages;

  // 上传图片区域，始终显示
  const renderImageUploadSection = () => {
    return (
      <div>
        <label className="flex items-center text-sm font-medium text-gray-900 mb-4">
          <img src="/form/upload.svg" alt="Upload" className="w-5 h-5 mr-2 text-gray-800 [&>path]:fill-current" />
          {t('form.upload.label')}
        </label>
        <div className="relative">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {uploadedImages.map((image, index) => (
              <div key={index} className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-orange-400/40 bg-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-orange-400/50">
                <Image
                  src={`data:image/jpeg;base64,${image}`}
                  alt={`Uploaded reference ${index + 1}`}
                  fill
                  className="object-contain"
                />
                {/* 图片标记 */}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-900 border border-orange-400/40 shadow-lg">
                  Image{index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-900 hover:text-red-500 hover:bg-red-100/20 transition-all duration-300 shadow-lg border border-orange-200/50 hover:border-red-500/50 opacity-0 group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {/* 添加图片卡片 - 根据模型限制控制可用性 */}
            <div
              onClick={canUploadMore ? () => fileInputRef.current?.click() : undefined}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`group relative aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 p-4 ${
                canUploadMore 
                  ? (isDragging 
                      ? 'border-orange-500 bg-gradient-to-br from-orange-100/20 to-amber-100/20 shadow-lg shadow-orange-400/20' 
                      : 'border-orange-400/40 bg-gradient-to-br from-white/50 to-white/50 hover:border-orange-400/60 hover:bg-gradient-to-br hover:from-white/60 hover:to-white/60 cursor-pointer hover:shadow-lg hover:shadow-orange-400/10')
                  : 'border-orange-200/30 bg-gradient-to-br from-white/30 to-white/30 cursor-not-allowed opacity-60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                disabled={!canUploadMore}
              />
              <div className={`flex flex-col items-center justify-center h-full space-y-2 ${canUploadMore ? 'group-hover:scale-105 transition-transform duration-300' : ''}`}>
                <div className={`relative ${canUploadMore ? 'group-hover:animate-pulse' : ''}`}>
                  <svg className={`w-6 h-6 ${canUploadMore ? 'text-orange-500/70 group-hover:text-orange-400' : 'text-orange-300/50'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  {canUploadMore && (
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-100/20 to-amber-100/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  )}
                </div>
                <div className="text-center">
                  {canUploadMore ? (
                    <div className="space-y-1">
                      <p className="text-gray-900/90 font-medium text-sm group-hover:text-gray-900 transition-colors leading-tight">
                        {t('form.upload.clickOrDrag')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-orange-400/80 font-medium text-sm leading-tight">
                        {t('form.upload.limitReached')}
                      </p>
                      <p className="text-orange-500/60 text-xs leading-tight">
                        {t('form.upload.maxImages', { maxImages })}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* 拖拽时的视觉反馈 */}
              {isDragging && canUploadMore && (
                <div className="absolute inset-0 bg-gradient-to-br from-orange-100/30 to-amber-100/30 rounded-2xl flex items-center justify-center">
                  <div className="text-gray-900 font-semibold text-lg">{t('form.upload.dropToUpload')}</div>
                </div>
              )}
            </div>
          </div>
        </div>
        {imageCountError && (
          <p className="mt-2 text-sm text-red-400">{imageCountError}</p>
        )}
      </div>
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (uploadedImages.length >= maxImages) {
      alert(t('error.validation.imageCountLimit', { model: currentModel?.name || model, maxImages }))
      return
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert(t('error.validation.fileType'))
      return
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert(t('error.validation.fileSize'))
      return
    }

    try {
      // 读取文件为 base64
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          // 移除 base64 前缀（如 "data:image/jpeg;base64,"）
          const base64String = event.target.result.toString().split(',')[1]
          
          // 创建图片对象以获取尺寸
          const img = new window.Image()
          img.onload = () => {
            console.log('GenerateForm: Successfully set previewImage')
            
            // 计算合适的尺寸（保持8的倍数）
            let newWidth = Math.round(img.width / 8) * 8
            let newHeight = Math.round(img.height / 8) * 8
            
            // 如果图片尺寸超过1440，按比例缩放
            if (newWidth > 1440 || newHeight > 1440) {
              const scale = Math.min(1440 / newWidth, 1440 / newHeight)
              newWidth = Math.round(newWidth * scale / 8) * 8
              newHeight = Math.round(newHeight * scale / 8) * 8
            }
            
            // 确保尺寸在允许范围内
            const finalWidth = Math.min(Math.max(newWidth, 64), 1440)
            const finalHeight = Math.min(Math.max(newHeight, 64), 1440)
            
            // 更新宽高状态
            setWidth(finalWidth)
            setHeight(finalHeight)

            // 更新父组件中的图片数据（使用无前缀的 base64）
            setUploadedImages((prev: string[]) => [...prev, base64String])
          }
          img.src = event.target.result as string
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error processing image:', error)
      alert(t('error.validation.imageProcessing'))
    }
  }

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev: string[]) => prev.filter((_: string, i: number) => i !== index))
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canUploadMore) {
      setDraggingWithDebounce(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingWithDebounce(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggingWithDebounce(false)
    
    if (!canUploadMore) {
      alert(t('error.validation.imageCountLimit', { model: currentModel?.name || model, maxImages }))
      return
    }
    
    const file = e.dataTransfer.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      alert(t('error.validation.fileType'))
      return
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert(t('error.validation.fileSize'))
      return
    }

    // 使用与 handleImageUpload 相同的处理逻辑
    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        const base64String = event.target.result.toString().split(',')[1]
        const img = new window.Image()
        img.onload = () => {
          // 计算合适的尺寸（保持8的倍数）
          let newWidth = Math.round(img.width / 8) * 8
          let newHeight = Math.round(img.height / 8) * 8
          
          // 如果图片尺寸超过1440，按比例缩放
          if (newWidth > 1440 || newHeight > 1440) {
            const scale = Math.min(1440 / newWidth, 1440 / newHeight)
            newWidth = Math.round(newWidth * scale / 8) * 8
            newHeight = Math.round(newHeight * scale / 8) * 8
          }
          
          const finalWidth = Math.min(Math.max(newWidth, 64), 1440)
          const finalHeight = Math.min(Math.max(newHeight, 64), 1440)
          setWidth(finalWidth)
          setHeight(finalHeight)
          setUploadedImages((prev: string[]) => [...prev, base64String])
          console.log('GenerateForm: Successfully set uploadedImage to new base64 string')
          console.log('GenerateForm: New image dimensions:', finalWidth, 'x', finalHeight)
        }
        img.src = event.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }

  // 根据上传图片数量过滤可用模型
  const filteredModels: ModelWithAvailability[] = filterModelsByImageCount(uploadedImages.length, availableModels);

  // 如果当前选中的模型不可用，自动切换到第一个可用模型
  useEffect(() => {
    if (modelsLoading || availableModels.length === 0) return;
    
    const currentModel = filteredModels.find(m => m.id === model)
    if (currentModel && !currentModel.isAvailable) {
      const firstAvailable = filteredModels.find(m => m.isAvailable)
      if (firstAvailable) {
        setModel(firstAvailable.id)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImages.length, modelsLoading, availableModels.length])

  // 处理从 URL 设置参考图片
  useEffect(() => {
    if (generatedImageToSetAsReference) {
      const setImageFromUrl = async () => {
        try {
          let blob;
          
          // 检查是否是 data URL
          if (generatedImageToSetAsReference.startsWith('data:')) {
            // 直接使用 data URL
            const response = await fetch(generatedImageToSetAsReference);
            blob = await response.blob();
          } else {
            // 普通 URL
            const response = await fetch(generatedImageToSetAsReference);
            blob = await response.blob();
          }
          
          return new Promise<void>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                const base64String = event.target.result.toString().split(',')[1];
                
                // 创建图片对象以获取尺寸
                const img = new window.Image();
                img.onload = () => {
                  // 计算合适的尺寸（保持8的倍数）
                  let newWidth = Math.round(img.width / 8) * 8;
                  let newHeight = Math.round(img.height / 8) * 8;
                  
                  // 如果图片尺寸超过1440，按比例缩放
                  if (newWidth > 1440 || newHeight > 1440) {
                    const scale = Math.min(1440 / newWidth, 1440 / newHeight);
                    newWidth = Math.round(newWidth * scale / 8) * 8;
                    newHeight = Math.round(newHeight * scale / 8) * 8;
                  }
                  
                  // 确保尺寸在允许范围内
                  const finalWidth = Math.min(Math.max(newWidth, 64), 1440);
                  const finalHeight = Math.min(Math.max(newHeight, 64), 1440);
                  
                  // 更新宽高状态
                  setWidth(finalWidth);
                  setHeight(finalHeight);

                  // 更新父组件中的图片数据（使用无前缀的 base64）
                  setUploadedImages((prev: string[]) => [...prev, base64String]);
                  
                  // 添加小延迟确保状态更新完成
                  setTimeout(() => {
                    resolve();
                  }, 100);
                };
                img.src = event.target.result as string;
              } else {
                reject(new Error('Failed to read image'));
              }
            };
            reader.onerror = () => reject(new Error('Failed to read image'));
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error('Error setting image from URL:', error);
        }
      };

      setImageFromUrl();
    }
  }, [generatedImageToSetAsReference, setWidth, setHeight, setUploadedImages]);

  return (
    <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl lg:p-6 p-3 border border-orange-400/40 flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-orange-100/10 to-amber-100/10 rounded-3xl"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(249,115,22,0.1),rgba(255,255,255,0))] shadow-orange-400/20"></div>
      <form onSubmit={handleSubmit} className="space-y-8 relative flex flex-col">
        <div className="space-y-8">
          {/* 上传图片区域（仅支持图生图模型时显示） */}
          {renderImageUploadSection()}

          {/* 模型选择区域 */}
          <div className="border-t border-orange-400/40 pt-8">
            <div>
              <label htmlFor="model" className="flex items-center text-sm font-medium text-gray-900 mb-3">
                <img src="/form/models.svg" alt="Model" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
                {t('form.model.label')}
              </label>
              <div className="relative" ref={modelDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className={`w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-left text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300 flex items-center justify-between ${
                    !filteredModels.find(m => m.id === model)?.isAvailable ? 'opacity-50' : ''
                  }`}
                  disabled={status === 'loading'}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-6 rounded overflow-hidden flex-shrink-0">
                      <img 
                        src={filteredModels.find(m => m.id === model)?.image} 
                        alt={model} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col">
                      <span>{model}</span>
                      {(() => {
                        const currentModel = filteredModels.find(m => m.id === model);
                        return (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {currentModel?.use_t2i && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600/40 to-cyan-600/40 text-cyan-900 border border-cyan-500/50">
                                {t('form.model.tags.textToImage')}
                              </span>
                            )}
                            {currentModel?.use_i2i && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-600/40 to-pink-600/40 text-pink-900 border border-pink-500/50">
                                {t('form.model.tags.imageToImage')}
                              </span>
                            )}
                            {currentModel?.tags && currentModel.tags.map((tag: string) => (
                              <span key={tag} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTagStyle(tag)}`}>
                                {t(`form.model.tags.${tag}`)}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <svg
                    className={`w-4 h-4 text-gray-600 transform transition-transform duration-300 ${isModelDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isModelDropdownOpen && (
                  <div className="absolute z-10 w-96 mt-2 bg-white/95 backdrop-blur-xl rounded-xl border border-orange-400/40 shadow-xl max-h-80 overflow-y-auto custom-scrollbar">
                    {modelsLoading ? (
                      <div className="px-4 py-4 text-center text-gray-600">
                        {t('form.model.loading')}
                      </div>
                    ) : filteredModels.length === 0 ? (
                      <div className="px-4 py-4 text-center text-gray-600">
                        {t('form.model.noModelsAvailable')}
                      </div>
                    ) : (
                      filteredModels.map((modelOption) => (
                      <button
                        key={modelOption.id}
                        type="button"
                        onClick={() => {
                          if (modelOption.isAvailable) {
                            setModel(modelOption.id)
                            setIsModelDropdownOpen(false)
                          }
                        }}
                        disabled={!modelOption.isAvailable}
                        className={`w-full px-4 py-4 text-left transition-colors duration-200 flex flex-col space-y-3 ${
                          model === modelOption.id ? 'bg-white/50' : ''
                        } ${
                          modelOption.isAvailable 
                            ? 'hover:bg-gray-200 hover:shadow-sm transition-all' 
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-24 h-12 rounded overflow-hidden flex-shrink-0">
                            <img 
                              src={modelOption.image} 
                              alt={modelOption.name} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-gray-900 font-medium">{modelOption.name}</div>
                              {modelOption.isRecommended && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-600/30 to-red-600/30 text-orange-900 border border-orange-500/40">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 6 8 6c0 0 .5-.5 2-2.5C10.5.5 11 0 11 0c0 0 .5 0 1.5 1C14 2 16 3.75 17 6c1 0 1.657-.343 1.657-.343A8 8 0 0121 12c0 2.707-1.34 5.106-3.343 6.657z"></path>
                                  </svg>
                                  推荐
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {modelOption.use_t2i && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-blue-600/30 to-cyan-600/30 text-cyan-900 border border-cyan-500/40">
                                  {t('form.model.tags.textToImage')}
                                </span>
                              )}
                              {modelOption.use_i2i && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-pink-900 border border-pink-500/40">
                                  {t('form.model.tags.imageToImage')}
                                </span>
                              )}
                              {modelOption.tags && modelOption.tags.map((tag: string) => (
                                <span key={tag} className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${getTagStyle(tag)}`}>
                                  {t(`form.model.tags.${tag}`)}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-600/80 line-clamp-2 pl-27">
                          {t(`form.model.descriptions.${modelOption.id.replace(/\./g, '')}`)}
                        </div>
                        {!modelOption.isAvailable && (
                          <div className="text-sm text-red-500 pl-27">
                            {uploadedImages.length > 0 ? 
                              (modelOption.use_i2i ? 
                                t('error.validation.modelNotAvailable.maxImagesExceeded', { maxImages: modelOption.maxImages || 1 }) : 
                                t('error.validation.modelNotAvailable.needReference')
                              ) : 
                              t('error.validation.modelNotAvailable.needReference')
                            }
                          </div>
                        )}
                      </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600/80">{t('form.model.hint')}</p>
            </div>
          </div>

          {/* 高级设置区域 */}
          <div className="border-t border-orange-400/40 pt-8">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              {isAdvancedOpen ? t('form.advanced.collapse') : t('form.advanced.expand')}
              <svg
                className={`ml-2 h-5 w-5 transform transition-transform duration-300 ${isAdvancedOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isAdvancedOpen && (
              <div className="mt-6 space-y-6">
                {/* 宽高输入表单已隐藏，宽高由比例决定 */}



                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="steps" className="flex items-center text-sm font-medium text-gray-900 mb-3">
                      <img src="/form/steps.svg" alt="Steps" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
                      {t('form.steps.label')}
                    </label>
                    <div className="relative flex items-center bg-white/50 backdrop-blur-sm border border-amber-400/40 rounded-xl focus-within:ring-2 focus-within:ring-amber-400/50 focus-within:border-amber-400/50 shadow-inner transition-all duration-300">
                      <input
                        type="number"
                        id="steps"
                        value={steps}
                        onChange={(e) => setSteps(Number(e.target.value))}
                        className="w-full bg-transparent text-center text-gray-900 border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="10"
                        max="32"
                        disabled={status === 'loading'}
                        ref={stepsRef}
                      />
                      <div className="flex items-center border-l border-orange-400/30">
                        <button
                          type="button"
                          onClick={() => setSteps(Math.max(10, steps - 1))}
                          className="px-3 text-gray-700 hover:text-gray-900 disabled:opacity-50 h-full flex items-center justify-center transition-colors"
                          disabled={status === 'loading' || steps <= 10}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSteps(Math.min(32, steps + 1))}
                          className="px-3 text-gray-700 hover:text-gray-900 disabled:opacity-50 h-full flex items-center justify-center transition-colors"
                          disabled={status === 'loading' || steps >= 32}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600/80">{t('form.steps.hint')}</p>
                    {stepsError && (
                      <p className="mt-1 text-sm text-red-400">{stepsError}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="batch_size" className="flex items-center text-sm font-medium text-gray-900 mb-3">
                      <img src="/form/generation-number.svg" alt="Batch Size" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
                      {t('form.batch_size.label')}
                    </label>
                    <div className="relative flex items-center bg-white/50 backdrop-blur-sm border border-amber-400/40 rounded-xl focus-within:ring-2 focus-within:ring-amber-400/50 focus-within:border-amber-400/50 shadow-inner transition-all duration-300">
                      <input
                        type="number"
                        id="batch_size"
                        value={batch_size}
                        onChange={(e) => setBatchSize(Number(e.target.value))}
                        className="w-full bg-transparent text-center text-gray-900 border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="1"
                        max="2"
                        disabled={status === 'loading'}
                        ref={batchSizeRef}
                      />
                      <div className="flex items-center border-l border-orange-400/30">
                        <button
                          type="button"
                          onClick={() => setBatchSize(Math.max(1, batch_size - 1))}
                          className="px-3 text-gray-700 hover:text-gray-900 disabled:opacity-50 h-full flex items-center justify-center transition-colors"
                          disabled={status === 'loading' || batch_size <= 1}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchSize(Math.min(2, batch_size + 1))}
                          className="px-3 text-gray-700 hover:text-gray-900 disabled:opacity-50 h-full flex items-center justify-center transition-colors"
                          disabled={status === 'loading' || batch_size >= 2}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-gray-600/80">{t('form.batch_size.hint')}</p>
                    {batchSizeError && (
                      <p className="mt-1 text-sm text-red-400">{batchSizeError}</p>
                    )}
                  </div>
                </div>

                {/* Denoising strength input removed as requested */}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          {/* Generate button removed for external placement */}
        </div>

        {isGenerating && !isQueuing && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-900">{t('form.progress.title')}</span>
              <span className="text-gray-700">
                {t('form.progress.estimatedTime')}: {Math.ceil(estimatedTime)} {t('form.progress.seconds')}
              </span>
            </div>
            <div className="w-full h-2 bg-white/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-700/80 text-right">
              {progress < 20 ? t('form.progress.status.initializing') :
               progress < 90 ? t('form.progress.status.processing') :
               t('form.progress.status.finalizing')}
            </div>
          </div>
        )}
      </form>
    </div>
  )
} 