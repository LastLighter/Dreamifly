'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useTranslations } from 'next-intl'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'
import { useSession } from '@/lib/auth-client'
import { usePoints } from '@/contexts/PointsContext'
import { getVideoModelById, calculateVideoResolution } from '@/utils/videoModelConfig'
import { optimizeVideoPrompt } from '@/utils/videoPromptOptimizer'
import Toast from '@/components/Toast'

interface VideoGenerateFormProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  negativePrompt: string;
  setNegativePrompt: (negativePrompt: string) => void;
  width: number;
  setWidth: (width: number) => void;
  height: number;
  setHeight: (height: number) => void;
  aspectRatio: number;
  setAspectRatio: (aspectRatio: number) => void;
  model: string;
  setModel: (model: string) => void;
  uploadedImage: string | null;
  setUploadedImage: (image: string | null) => void;
  generatedVideo: string | null;
  setGeneratedVideo: (video: string | null) => void;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  isQueuing: boolean;
  setIsQueuing: (queuing: boolean) => void;
  onGenerate: (videoUrl: string) => void;
  setErrorModal: (show: boolean, type: 'concurrency' | 'daily_limit' | 'insufficient_points' | 'login_required' | 'maintenance_mode', message?: string) => void;
}

const VideoGenerateForm = ({
  prompt,
  setPrompt,
  negativePrompt,
  setNegativePrompt,
  width,
  setWidth,
  height,
  setHeight,
  aspectRatio,
  setAspectRatio,
  model,
  setModel,
  uploadedImage,
  setUploadedImage,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generatedVideo: _generatedVideo,
  setGeneratedVideo,
  isGenerating,
  setIsGenerating,
  isQueuing,
  setIsQueuing,
  onGenerate,
  setErrorModal,
}: VideoGenerateFormProps) => {
  const t = useTranslations('home.generate')
  const tVideo = useTranslations('home.generate.form.videoGeneration')
  const { data: session, isPending } = useSession()
  const { refreshPoints } = usePoints()

  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isNegativePromptEnabled, setIsNegativePromptEnabled] = useState(false)
  const [isRatioOpen, setIsRatioOpen] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'warning' | 'success' | 'info' } | null>(null)
  const [progress, setProgress] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(280) // 预期时间280秒
  const ratioDropdownRef = useRef<HTMLDivElement>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 用户认证状态
  const authStatus = isPending ? 'loading' : (session?.user ? 'authenticated' : 'unauthenticated')

  // 点击外部关闭宽高比下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(event.target as Node)) {
        setIsRatioOpen(false)
      }
    }

    if (isRatioOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isRatioOpen])

  // 加载可用视频模型 - 使用 useLayoutEffect 在 DOM 更新前同步执行，提高优先级
  useLayoutEffect(() => {
    let cancelled = false
    const loadModels = async () => {
      try {
        // 使用 fetchPriority 提示浏览器优先加载（如果支持）
        const fetchOptions: RequestInit = {}
        if ('priority' in Request.prototype) {
          (fetchOptions as any).priority = 'high'
        }
        const response = await fetch('/api/video-models', fetchOptions)
        if (cancelled) return
        
        if (response.ok) {
          const data = await response.json()
          if (cancelled) return
          
          setAvailableModels(data.models || [])
          if (data.models && data.models.length > 0 && !model) {
            // 设置默认模型为推荐模型或第一个可用模型
            const defaultModel = data.models.find((m: any) => m.isRecommended) || data.models[0]
            setModel(defaultModel.id)
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load video models:', error)
        }
      }
    }
    // 立即执行，不等待其他操作
    loadModels()
    
    return () => {
      cancelled = true
    }
  }, []) // 空依赖数组，只在组件挂载时执行一次

  // 计算预估积分消耗
  useEffect(() => {
    const calculateCost = async () => {
      if (!model) return

      const modelConfig = getVideoModelById(model)
      if (!modelConfig) return

      // 视频生成固定消耗基础积分
      const baseCost = await getVideoModelBaseCost(modelConfig)
      setEstimatedCost(baseCost || null)
    }

    calculateCost()
  }, [model])

  // 视频生成进度条动画
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isGenerating && !isQueuing) {
      // 预期时间280秒
      const generationTime = 280
      setEstimatedTime(generationTime)
      
      // 进度条动画
      let currentProgress = 0
      const startTime = Date.now()
      
      timer = setInterval(() => {
        const currentTime = Date.now()
        const elapsedTime = (currentTime - startTime) / 1000 // 转换为秒
        
        // 计算实际生成的时间比例
        const timeRatio = elapsedTime / generationTime
        
        // 计算目标进度（参考图片生成的进度计算逻辑）
        let targetProgress
        if (timeRatio < 0.2) {
          // 前20%时间快速进展到30%
          targetProgress = timeRatio * 2 * 30
        } else if (timeRatio < 0.8) {
          // 20%-80%时间进展到80%
          targetProgress = 40 + (timeRatio - 0.2) * (40 / 0.6)
        } else {
          // 最后20%时间进展到95%
          targetProgress = 80 + (timeRatio - 0.8) * (15 / 0.2)
        }
        
        // 平滑过渡到目标进度
        const maxStep = 0.5 // 每帧最大进度变化
        const step = Math.min(maxStep, Math.abs(targetProgress - currentProgress))
        
        if (targetProgress > currentProgress) {
          currentProgress = Math.min(95, currentProgress + step)
        } else {
          currentProgress = Math.max(currentProgress - step, currentProgress)
        }
        
        setProgress(currentProgress)
      }, 50) // 更频繁的更新以获得更平滑的动画
    } else {
      setProgress(0)
      setEstimatedTime(280)
    }

    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [isGenerating, isQueuing])

  // 获取视频模型的基础积分消耗
  const getVideoModelBaseCost = async (modelConfig: any): Promise<number | null> => {
    try {
      // 获取积分配置
      const response = await fetch(`/api/points/model-base-cost?modelId=${modelConfig.id}`)
      if (response.ok) {
        const data = await response.json()
        return data.baseCost
      }
    } catch (error) {
      console.error('Failed to get video model base cost:', error)
    }
    return null
  }

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setUploadError(t('error.validation.fileType'))
      return
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(t('error.validation.fileSize'))
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
            // 计算宽高比
            const imageAspectRatio = img.width / img.height
            setAspectRatio(imageAspectRatio)

            // 根据宽高比计算视频分辨率（保持总像素不变）
            const modelConfig = getVideoModelById(model)
            if (modelConfig) {
              const resolution = calculateVideoResolution(modelConfig, imageAspectRatio)
              setWidth(resolution.width)
              setHeight(resolution.height)
            }

            // 设置上传的图片
            setUploadedImage(base64String)
            setUploadError(null)
          }
          img.src = event.target.result as string
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error processing image:', error)
      setUploadError(t('error.validation.imageProcessing'))
    }
  }

  // 移除上传的图片
  const handleRemoveImage = () => {
    setUploadedImage(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 处理视频生成
  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      setErrorModal(true, 'concurrency', t('error.validation.promptRequired'))
      return
    }

    if (!uploadedImage) {
      setErrorModal(true, 'concurrency', tVideo('imageRequired'))
      return
    }

    if (!model) {
      setErrorModal(true, 'concurrency', t('error.validation.modelRequired'))
      return
    }

    // 检查用户是否登录
    console.log('Video generation - auth status:', authStatus)
    if (authStatus !== 'authenticated') {
      console.log('Video generation - user not authenticated, showing login modal')
      setErrorModal(true, 'login_required', tVideo('loginRequired'))
      return
    }

    setIsGenerating(true)
    setIsQueuing(false)
    setGeneratedVideo(null)
    setProgress(0)
    setEstimatedTime(280) // 重置预期时间为280秒

    try {
      const token = await generateDynamicTokenWithServerTime()

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negative_prompt: negativePrompt.trim(),
          width,
          height,
          model,
          image: uploadedImage, // base64 格式
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()

        if (response.status === 401) {
          if (errorData.code === 'LOGIN_REQUIRED') {
            setErrorModal(true, 'login_required', errorData.error)
            return
          }
        } else if (response.status === 402) {
          if (errorData.code === 'INSUFFICIENT_POINTS') {
            setErrorModal(true, 'insufficient_points', errorData.error)
            return
          }
        } else if (response.status === 429) {
          if (errorData.code === 'DAILY_LIMIT_EXCEEDED') {
            setErrorModal(true, 'daily_limit', errorData.error)
            return
          } else if (errorData.code === 'IP_CONCURRENCY_LIMIT_EXCEEDED') {
            setErrorModal(true, 'concurrency', errorData.error)
            return
          }
        } else if (response.status === 503) {
          if (errorData.code === 'MAINTENANCE_MODE') {
            setErrorModal(true, 'maintenance_mode', errorData.error)
            return
          }
        }

        throw new Error(errorData.error || 'Failed to generate video')
      }

      const data = await response.json()
      const videoUrl = data.videoUrl

      setGeneratedVideo(videoUrl)

      // 刷新积分
      await refreshPoints()

      // 通知父组件
      onGenerate(videoUrl)

    } catch (error) {
      console.error('Video generation error:', error)
      setErrorModal(true, 'concurrency', error instanceof Error ? error.message : 'Failed to generate video')
    } finally {
      setIsGenerating(false)
      setIsQueuing(false)
    }
  }

  // 处理宽高比变化
  const handleAspectRatioChange = (newAspectRatio: number) => {
    setAspectRatio(newAspectRatio)
    if (model) {
      const modelConfig = getVideoModelById(model)
      if (modelConfig) {
        const resolution = calculateVideoResolution(modelConfig, newAspectRatio)
        setWidth(resolution.width)
        setHeight(resolution.height)
      }
    }
  }

  // 预设宽高比选项
  const aspectRatioOptions = [
    { value: 16/9, label: '16:9' },
    { value: 4/3, label: '4:3' },
    { value: 1, label: '1:1' },
    { value: 3/4, label: '3:4' },
    { value: 9/16, label: '9:16' },
  ]

  // 将数字宽高比转换为字符串格式（如 1.777... -> "16:9"）
  const normalizeRatioToString = (ratio: number): string => {
    // 先尝试匹配预设选项
    const option = aspectRatioOptions.find(opt => Math.abs(opt.value - ratio) < 0.001)
    if (option) return option.label
    
    // 如果不在预设选项中，计算最接近的整数比例
    // 使用连分数算法找到最接近的整数比例
    const precision = 0.01
    let bestNum = 1
    let bestDen = 1
    let bestError = Math.abs(ratio - bestNum / bestDen)
    
    for (let den = 1; den <= 100; den++) {
      const num = Math.round(ratio * den)
      if (num < 1) continue
      const error = Math.abs(ratio - num / den)
      if (error < bestError) {
        bestError = error
        bestNum = num
        bestDen = den
      }
      if (bestError < precision) break
    }
    
    // 简化分数（找最大公约数）
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
    const divisor = gcd(bestNum, bestDen)
    return `${bestNum / divisor}:${bestDen / divisor}`
  }

  // 获取当前选中的宽高比标签
  const getCurrentRatioLabel = () => {
    return normalizeRatioToString(aspectRatio)
  }

  // 处理优化提示词
  const handleOptimizePrompt = async () => {
    // 如果没有上传图片，优雅提示
    if (!uploadedImage) {
      setToast({
        message: tVideo('imageRequiredForOptimization') || '请先上传参考图片，以便基于图片优化提示词',
        type: 'info'
      });
      return;
    }

    // 如果没有提示词，则生成新提示词；如果有提示词，则优化现有提示词
    const hasPrompt = prompt.trim().length > 0;

    setIsOptimizing(true);
    try {
      const optimizedPrompt = await optimizeVideoPrompt(hasPrompt ? prompt : '', uploadedImage);
      setPrompt(optimizedPrompt);
      setToast({
        message: hasPrompt ? (t('form.promptOptimized') || '提示词优化成功') : (t('form.promptGenerated') || '提示词生成成功'),
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to optimize prompt:', error);
      setToast({
        message: error instanceof Error ? error.message : (hasPrompt ? '优化提示词失败' : '生成提示词失败'),
        type: 'error'
      });
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleGenerateVideo(); }} className="space-y-8 relative flex flex-col">
      <div className="space-y-8">
        {/* 上传图片区域 */}
        <div className="pt-0">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
              <img src="/form/image.svg" alt="Image" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
              {tVideo('inputImage')}
            </label>
            <div
              onClick={() => !uploadedImage && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (!uploadedImage) {
                  const file = e.dataTransfer.files?.[0]
                  if (file && file.type.startsWith('image/')) {
                    const fakeEvent = {
                      target: { files: [file] }
                    } as unknown as React.ChangeEvent<HTMLInputElement>
                    handleImageUpload(fakeEvent)
                  }
                }
              }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                uploadedImage
                  ? 'border-orange-400/40 bg-white'
                  : 'border-orange-400/40 bg-white hover:border-orange-400'
              }`}
            >
              {!uploadedImage ? (
                <div className="flex flex-col items-center justify-center">
                  <svg className="w-16 h-16 text-orange-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-700">
                    {t('form.upload.clickOrDrag')}
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={`data:image/jpeg;base64,${uploadedImage}`}
                    alt="Uploaded"
                    className="max-w-full max-h-64 mx-auto rounded-lg shadow-lg"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveImage()
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-all duration-300 transform hover:scale-110 shadow-lg"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
            </div>
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
            )}
          </div>
        </div>

        {/* 提示词区域 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
              <img src="/form/prompt.svg" alt="Prompt" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
              {t('form.prompt.label')}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={tVideo('promptPlaceholder')}
              className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300 resize-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              rows={4}
              disabled={isGenerating}
            />
            
            {/* 宽高比选择按钮行 */}
            <div className="flex flex-col md:flex-row md:justify-between gap-3 items-stretch md:items-center mt-4">
              <div className="flex gap-2 md:gap-3">
                <div
                  onClick={() => !isGenerating && setIsRatioOpen(!isRatioOpen)}
                  className="px-3 py-1 text-xs md:px-4 md:py-2 md:text-sm rounded-xl bg-white/95 border border-amber-400/40 text-gray-900 hover:bg-amber-50/50 hover:border-amber-400/50 transition-all duration-300 shadow-md shadow-amber-400/10 hover:shadow-lg hover:shadow-amber-400/20 whitespace-nowrap flex items-center relative cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  tabIndex={0}
                  role="button"
                  aria-disabled={isGenerating}
                >
                  <svg className="w-3 h-3 mr-1 md:w-4 md:h-4 text-orange-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"></path>
                  </svg>
                  {getCurrentRatioLabel()}
                  {isRatioOpen && (
                    <div ref={ratioDropdownRef} className="absolute top-full left-0 mt-2 bg-white/95 border border-amber-400/40 rounded-xl shadow-xl p-2 min-w-[150px] z-50">
                      {(() => {
                        // 检查当前比例是否在预设选项中
                        const currentOption = aspectRatioOptions.find(opt => Math.abs(opt.value - aspectRatio) < 0.001);
                        const currentLabel = getCurrentRatioLabel();
                        const showCurrentCustom = !currentOption && currentLabel;
                        
                        return (
                          <>
                            {/* 如果当前是自定义比例，先显示它 */}
                            {showCurrentCustom && (
                              <div
                                onClick={() => setIsRatioOpen(false)}
                                className="flex items-center px-3 py-2 text-sm text-gray-900 bg-amber-100/50 w-full rounded-lg cursor-default border border-amber-400/30 mb-1"
                              >
                                <div className="bg-amber-400/40 mr-2" style={{
                                  width: aspectRatio >= 1 ? '20px' : `${Math.round(20 * aspectRatio)}px`,
                                  height: aspectRatio >= 1 ? `${Math.round(20 / aspectRatio)}px` : '20px'
                                }}></div>
                                {currentLabel} (当前)
                              </div>
                            )}
                            {/* 预设选项 */}
                            {aspectRatioOptions.map((option) => {
                              const [rw, rh] = option.label.split(':').map(Number);
                              const isHorizontal = rw >= rh;
                              const rectWidth = 20;
                              const rectHeight = isHorizontal ? Math.round(rectWidth * rh / rw) : Math.round(rectWidth * rw / rh);
                              const rectStyle = isHorizontal ? {width: `${rectWidth}px`, height: `${rectHeight}px`} : {width: `${rectHeight}px`, height: `${rectWidth}px`};
                              const isSelected = Math.abs(option.value - aspectRatio) < 0.001;
                              return (
                                <div
                                  key={option.value}
                                  onClick={() => { 
                                    handleAspectRatioChange(option.value); 
                                    setIsRatioOpen(false); 
                                  }}
                                  className={`flex items-center px-3 py-2 text-sm text-gray-900 hover:bg-gray-100/50 w-full rounded-lg cursor-pointer ${isSelected ? 'bg-amber-100/50' : ''}`}
                                >
                                  <div className="bg-amber-400/40 mr-2" style={rectStyle}></div>
                                  {option.label}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleOptimizePrompt}
                  className="px-2 py-1 text-xs md:px-3 md:py-2 md:text-sm rounded-xl bg-white/95 border border-amber-400/40 text-gray-900 hover:bg-amber-50/50 hover:border-amber-400/50 transition-all duration-300 shadow-md shadow-amber-400/10 hover:shadow-lg hover:shadow-amber-400/20 whitespace-nowrap flex items-center"
                  disabled={isGenerating || isOptimizing || !uploadedImage}
                >
                  <svg className="w-3 h-3 mr-1 md:w-4 md:h-4 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
                  </svg>
                  {isOptimizing ? t('form.optimizingPrompt') || 'Optimizing...' : t('form.optimizePrompt')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 负面提示词区域 */}
        <div className="pt-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center text-sm font-medium text-gray-900">
                <img src="/form/negative.svg" alt="Negative Prompt" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
                {t('form.negativePrompt')}
              </label>
              <button
                type="button"
                onClick={() => {
                  const newValue = !isNegativePromptEnabled
                  setIsNegativePromptEnabled(newValue)
                  if (!newValue) {
                    // 关闭时清空负面提示词
                    setNegativePrompt('')
                  }
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:ring-offset-2 ${
                  isNegativePromptEnabled ? 'bg-orange-500' : 'bg-gray-200'
                }`}
                disabled={isGenerating}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isNegativePromptEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            {isNegativePromptEnabled && (
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder={t('form.negativePromptPlaceholder')}
                className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-sm text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300 resize-none"
                rows={3}
                disabled={isGenerating}
              />
            )}
          </div>
        </div>

        {/* 模型选择区域 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
              <img src="/form/models.svg" alt="Model" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
              {t('form.model.label')}
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3.5 text-sm text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300"
              disabled={isGenerating}
            >
              {availableModels.map((modelOption) => (
                <option key={modelOption.id} value={modelOption.id}>
                  {modelOption.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 生成按钮 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isGenerating || isQueuing || !prompt.trim() || !uploadedImage || !model}
              className="relative w-full px-4 py-2 text-sm md:px-6 md:py-3 md:text-base font-semibold rounded-2xl bg-white/95 text-gray-900 hover:bg-amber-50/95 transition-all duration-500 shadow-xl shadow-amber-400/20 hover:shadow-2xl hover:shadow-amber-400/30 hover:-translate-y-0.5 transform border border-amber-400/40 overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* 高级光效背景 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out"></div>
              
              {/* 微妙的发光效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-transparent to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <span className="relative z-10 flex items-center justify-center font-bold">
                {isGenerating ? (
                  isQueuing ? (
                    <>
                      {/* 排队中 - 黄色时钟图标 */}
                      <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path className="opacity-75" fill="currentColor" d="M12 6v6l4 2"></path>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('form.progress.status.queuing')}
                    </>
                  ) : (
                    <>
                      {/* 生成中 - 绿色spinner */}
                      <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('form.generating')}
                    </>
                  )
                ) : (
                  <>
                    <svg className="mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-orange-500" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                      <path fill="currentColor" d="M640 224A138.666667 138.666667 0 0 0 778.666667 85.333333h64A138.666667 138.666667 0 0 0 981.333333 224v64A138.666667 138.666667 0 0 0 842.666667 426.666667h-64A138.666667 138.666667 0 0 0 640 288v-64zM170.666667 298.666667a85.333333 85.333333 0 0 1 85.333333-85.333334h298.666667V128H256a170.666667 170.666667 0 0 0-170.666667 170.666667v426.666666a170.666667 170.666667 0 0 0 170.666667 170.666667h512a170.666667 170.666667 0 0 0 170.666667-170.666667v-213.333333h-85.333334v213.333333a85.333333 85.333333 0 0 1-85.333333 85.333334H256a85.333333 85.333333 0 0 1-85.333333-85.333334V298.666667z"></path>
                    </svg>
                    {tVideo('generateButton')}
                  </>
                )}
              </span>
              
              {/* 预计消耗积分数 - 显示在按钮右下角 */}
              {estimatedCost !== null && authStatus === 'authenticated' && !isGenerating && !isQueuing && (
                <div className="absolute bottom-1.5 right-2.5 flex items-center gap-0.5 bg-amber-100/90 px-1.5 py-0.5 rounded-full backdrop-blur-sm border border-amber-300/70 shadow-sm">
                  <svg className="w-2.5 h-2.5 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] md:text-xs text-amber-700 font-semibold">{estimatedCost}</span>
                </div>
              )}
            </button>
          </div>
          
          {/* 进度条信息 - 在按钮下方 */}
          {isGenerating && !isQueuing && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-900">{t('form.progress.title')}</span>
                <span className="text-gray-900">
                  {t('form.progress.estimatedTime')}: {Math.ceil(estimatedTime)} {t('form.progress.seconds')}
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-300 relative overflow-hidden"
                  style={{ width: `${progress}%` }}
                >
                  {/* 进度条内的水流效果 */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-shimmer"
                       style={{ 
                         width: '200%', 
                         left: '-100%'
                       }} />
                </div>
              </div>
              <div className="text-xs text-gray-600/80 text-right">
                {progress < 20 ? t('form.progress.status.initializing') :
                 progress < 90 ? t('form.progress.status.processing') :
                 t('form.progress.status.finalizing')}
              </div>
            </div>
          )}
        </div>
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </form>
  )
}

export default VideoGenerateForm
