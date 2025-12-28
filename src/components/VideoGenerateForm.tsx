'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'
import { useSession } from '@/lib/auth-client'
import { usePoints } from '@/contexts/PointsContext'
import { getVideoModelById, calculateVideoResolution, getAllVideoModels } from '@/utils/videoModelConfig'
import { calculateEstimatedCost } from '@/utils/pointsClient'
import { getVideoModelBaseCost } from '@/utils/videoModelConfig'
import { transferUrl } from '@/utils/locale'

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
  setErrorModal: (show: boolean, type: 'concurrency' | 'daily_limit' | 'insufficient_points' | 'login_required', message?: string) => void;
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
  generatedVideo,
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
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  const [availableModels, setAvailableModels] = useState<any[]>([])
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null)
  const [showLoginTip, setShowLoginTip] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 用户认证状态
  const authStatus = isPending ? 'loading' : (session?.user ? 'authenticated' : 'unauthenticated')

  // 加载可用视频模型
  useEffect(() => {
    const loadModels = async () => {
      try {
        const response = await fetch('/api/video-models')
        if (response.ok) {
          const data = await response.json()
          setAvailableModels(data.models || [])
          if (data.models && data.models.length > 0 && !model) {
            // 设置默认模型为推荐模型或第一个可用模型
            const defaultModel = data.models.find((m: any) => m.isRecommended) || data.models[0]
            setModel(defaultModel.id)
          }
        }
      } catch (error) {
        console.error('Failed to load video models:', error)
      }
    }
    loadModels()
  }, [model, setModel])

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
            const resolution = calculateVideoResolution(getVideoModelById(model), imageAspectRatio)
            setWidth(resolution.width)
            setHeight(resolution.height)

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
    if (authStatus !== 'authenticated') {
      setErrorModal(true, 'login_required', tVideo('loginRequired'))
      return
    }

    setIsGenerating(true)
    setIsQueuing(false)
    setGeneratedVideo(null)

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

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleGenerateVideo(); }} className="space-y-8 relative flex flex-col">
      <div className="space-y-8">
        {/* 上传图片区域 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
              <img src="/form/image.svg" alt="Image" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
              {tVideo('inputImage')}
            </label>
            <div className="border-2 border-dashed border-orange-400/40 rounded-xl p-6 text-center hover:border-orange-400 transition-colors bg-white/50 backdrop-blur-sm">
              {!uploadedImage ? (
                <div>
                  <svg className="mx-auto h-12 w-12 text-orange-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div className="text-sm text-gray-600 mb-4">
                    {tVideo('uploadImageHint')}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 cursor-pointer transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {tVideo('selectImage')}
                  </label>
                </div>
              ) : (
                <div className="relative">
                  <img
                    src={`data:image/jpeg;base64,${uploadedImage}`}
                    alt="Uploaded"
                    className="max-w-full max-h-48 mx-auto rounded-lg shadow-lg border border-orange-400/30"
                  />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 hover:bg-red-600 transition-all duration-300 transform hover:scale-110 shadow-lg"
                    type="button"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {uploadError && (
              <p className="mt-2 text-sm text-red-600">{uploadError}</p>
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
              className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300"
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

        {/* 分辨率设置区域 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
                <img src="/form/aspect-ratio.svg" alt="Aspect Ratio" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
                {t('form.aspectRatio')}
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => handleAspectRatioChange(parseFloat(e.target.value))}
                className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300"
                disabled={isGenerating}
              >
                {aspectRatioOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
                <img src="/form/resolution.svg" alt="Resolution" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
                {t('form.resolution')}
              </label>
              <div className="bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-gray-900 shadow-inner">
                <span className="text-lg font-medium">{width} × {height}</span>
                <span className="text-sm text-gray-600 ml-2">(720p)</span>
              </div>
            </div>
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
              className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300 resize-none"
              rows={3}
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* 负面提示词区域 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div>
            <label className="flex items-center text-sm font-medium text-gray-900 mb-3">
              <img src="/form/negative.svg" alt="Negative Prompt" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
              {t('form.negativePrompt')}
            </label>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder={t('form.negativePromptPlaceholder')}
              className="w-full bg-white/50 backdrop-blur-sm border border-orange-400/40 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 shadow-inner transition-all duration-300 resize-none"
              rows={2}
              disabled={isGenerating}
            />
          </div>
        </div>

        {/* 积分消耗显示 */}
        {estimatedCost !== null && authStatus === 'authenticated' && (
          <div className="border-t border-orange-400/40 pt-8">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-4 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-800 flex items-center">
                  <img src="/form/points.svg" alt="Points" className="w-4 h-4 mr-2 text-orange-600 [&>path]:fill-current" />
                  {t('form.estimatedCost')}
                </span>
                <span className="text-lg font-bold text-orange-600">
                  {estimatedCost} {t('form.points')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 生成按钮 */}
        <div className="border-t border-orange-400/40 pt-8">
          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isGenerating || isQueuing || !prompt.trim() || !uploadedImage || !model}
              className="px-12 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center space-x-3"
            >
              {isGenerating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{t('form.generating')}</span>
                </>
              ) : isQueuing ? (
                <>
                  <svg className="animate-pulse -ml-1 mr-3 h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t('form.queuing')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l.707.707A1 1 0 0012.414 11H15m-3-3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{tVideo('generateButton')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}

export default VideoGenerateForm
