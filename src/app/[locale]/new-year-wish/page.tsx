'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import NineGridDisplay from '@/components/NineGridDisplay'
import { generateDynamicToken } from '@/utils/dynamicToken'

interface Wish {
  id: string
  name: string
  icon: string
}

export default function NewYearWishPage() {
  const t = useTranslations('newYearWish')
  
  const [uploadedAvatar, setUploadedAvatar] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [wishes, setWishes] = useState<Wish[]>([])
  const [error, setError] = useState<string>('')
  const [progress, setProgress] = useState<string>('')
  const [currentWishIndex, setCurrentWishIndex] = useState<number>(0)
  const [currentWishName, setCurrentWishName] = useState<string>('')
  const [selectedWishes, setSelectedWishes] = useState<Wish[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件')
      return
    }

    // 验证文件大小 (最大10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('图片大小不能超过10MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64String = event.target?.result as string
      setUploadedAvatar(base64String)
      setError('')
      setGeneratedImages([])
      setWishes([])
      setCurrentWishIndex(0)
      setCurrentWishName('')
      setSelectedWishes([])
    }
    reader.readAsDataURL(file)
  }

  // 处理拖拽上传
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const base64String = event.target?.result as string
        setUploadedAvatar(base64String)
        setError('')
        setGeneratedImages([])
        setWishes([])
        setCurrentWishIndex(0)
        setCurrentWishName('')
        setSelectedWishes([])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  // 生成图片
  const handleGenerate = async () => {
    if (!uploadedAvatar) {
      setError('请先上传照片')
      return
    }

    setIsGenerating(true)
    setError('')
    setCurrentWishIndex(0)
    setCurrentWishName('')
    
    // 先获取愿望列表
    try {
      const wishesResponse = await fetch('/data/wishes.json')
      const allWishes = await wishesResponse.json()
      
      // 随机抽取8个愿望
      const shuffled = [...allWishes].sort(() => 0.5 - Math.random())
      const selected = shuffled.slice(0, 8)
      setSelectedWishes(selected)
      
      setProgress('已抽取8个愿望，开始生成...')
      
      // 模拟生成进度
      const progressInterval = setInterval(() => {
        setCurrentWishIndex(prev => {
          const next = prev + 1
          if (next <= 8) {
            if (next <= selected.length) {
              setCurrentWishName(selected[next - 1].name)
            }
            return next
          }
          return prev
        })
      }, 15000) // 每15秒更新一次进度（假设每个愿望生成15秒）

      const token = generateDynamicToken()
      
      // 提取base64数据（去除data:image/xxx;base64,前缀）
      const base64Data = uploadedAvatar.split(',')[1]

      const response = await fetch('/api/new-year-wish/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatar: base64Data,
          token: token,
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '生成失败')
      }

      const data = await response.json()
      
      if (data.success) {
        setGeneratedImages(data.images)
        setWishes(data.wishes)
        setProgress('生成成功！')
        setCurrentWishIndex(8)
      } else {
        throw new Error('生成失败')
      }
    } catch (err) {
      console.error('Generation error:', err)
      setError(err instanceof Error ? err.message : '生成失败，请重试')
    } finally {
      setIsGenerating(false)
    }
  }

  // 一键下载所有图片
  const handleDownloadAll = async () => {
    if (!uploadedAvatar || generatedImages.length === 0) return

    setIsDownloading(true)

    try {
      // 组合所有图片（中间是用户原图，周围是生成的图）
      const allImages = [
        ...generatedImages.slice(0, 4),
        uploadedAvatar,
        ...generatedImages.slice(4, 8),
      ]

      // 依次下载每张图片（延迟300ms避免浏览器拦截）
      for (let i = 0; i < allImages.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 300))
        
        const link = document.createElement('a')
        const imageData = allImages[i].startsWith('data:') 
          ? allImages[i] 
          : `data:image/png;base64,${allImages[i]}`
        
        link.href = imageData
        link.download = `新年愿望九宫格_${i + 1}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (err) {
      console.error('Download error:', err)
      setError('下载失败，请重试')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-yellow-50 to-red-50 relative overflow-hidden">
      {/* 背景装饰 - 飘落的烟花粒子 */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 bg-red-300 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-yellow-300 rounded-full opacity-20 animate-pulse delay-150"></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-red-400 rounded-full opacity-10 animate-pulse delay-300"></div>
        <div className="absolute bottom-40 right-1/3 w-12 h-12 bg-yellow-400 rounded-full opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:py-12 lg:py-16 relative z-10">
        {/* 标题区域 */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-3 bg-gradient-to-r from-red-600 via-yellow-500 to-red-600 bg-clip-text text-transparent animate-gradient">
            {t('title')}
          </h1>
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600 mb-4">
            🐍 {t('subtitle')} 🧧
          </h2>
          <p className="text-base sm:text-lg text-gray-700 max-w-2xl mx-auto">
            {t('description')}
          </p>
        </div>

        {/* 主内容区域 */}
        <div className="max-w-4xl mx-auto">
          {/* 上传区域 */}
          {!uploadedAvatar && (
            <div className="mb-8">
              <div
                className="border-4 border-dashed border-red-300 rounded-2xl p-8 sm:p-12 text-center bg-white/80 backdrop-blur-sm hover:border-yellow-400 transition-all duration-300 cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-6xl mb-4">🎊</div>
                <p className="text-xl sm:text-2xl font-bold text-gray-700 mb-2">
                  {t('upload.button')}
                </p>
                <p className="text-sm sm:text-base text-gray-500 mb-4">
                  {t('upload.dragTip')}
                </p>
                <p className="text-xs sm:text-sm text-gray-400">
                  {t('upload.fileTip')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* 已上传图片预览 */}
          {uploadedAvatar && !generatedImages.length && (
            <div className="mb-8">
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-32 h-32 sm:w-40 sm:h-40 relative rounded-2xl overflow-hidden border-4 border-yellow-400 shadow-lg">
                    <img
                      src={uploadedAvatar}
                      alt="上传的照片"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <p className="text-lg font-bold text-gray-700 mb-4">
                      照片已准备好！点击按钮开始生成 🎉
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`
                          px-8 py-4 rounded-full font-bold text-lg
                          bg-gradient-to-r from-red-600 to-yellow-500
                          text-white shadow-xl
                          transform transition-all duration-300
                          ${isGenerating 
                            ? 'opacity-50 cursor-not-allowed' 
                            : 'hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/50'
                          }
                        `}
                      >
                        {isGenerating ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {t('generate.generating')}
                          </span>
                        ) : (
                          <span>✨ {t('generate.button')}</span>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setUploadedAvatar('')
                          setError('')
                        }}
                        className="px-6 py-3 rounded-full font-bold text-red-600 border-2 border-red-600 hover:bg-red-50 transition-all"
                      >
                        重新上传
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 生成进度 */}
          {isGenerating && (
            <div className="mb-8">
              <div className="max-w-2xl mx-auto bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8">
                {/* 标题 */}
                <div className="text-center mb-6">
                  <p className="text-2xl font-bold text-red-600 mb-2">
                    🎊 福星高照生成中... 🎊
                  </p>
                  <p className="text-sm text-gray-600">
                    预计需要 30-60 秒，请耐心等待
                  </p>
                </div>

                {/* 显示抽取的愿望 */}
                {selectedWishes.length > 0 && (
                  <div className="mb-6">
                    <p className="text-center text-sm font-bold text-gray-700 mb-3">
                      已抽取的8个愿望：
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {selectedWishes.map((wish, index) => (
                        <div
                          key={wish.id}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                            index < currentWishIndex
                              ? 'bg-green-100 text-green-700 border-2 border-green-300'
                              : index === currentWishIndex
                              ? 'bg-red-100 text-red-700 border-2 border-red-400 animate-pulse'
                              : 'bg-gray-100 text-gray-600 border-2 border-gray-300'
                          }`}
                        >
                          {wish.icon} {wish.name}
                          {index < currentWishIndex && ' ✓'}
                          {index === currentWishIndex && ' ⏳'}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 当前生成的愿望 */}
                {currentWishName && currentWishIndex > 0 && currentWishIndex <= 8 && (
                  <div className="text-center mb-6">
                    <div className="inline-block bg-gradient-to-r from-red-100 to-yellow-100 px-6 py-3 rounded-full border-2 border-red-300">
                      <p className="text-lg font-bold text-red-700">
                        正在生成：{currentWishName} ({currentWishIndex}/8)
                      </p>
                    </div>
                  </div>
                )}

                {/* 进度条 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm font-medium text-gray-700 mb-2">
                    <span>生成进度</span>
                    <span>{currentWishIndex}/8 ({Math.round((currentWishIndex / 8) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 transition-all duration-500 ease-out rounded-full animate-gradient"
                      style={{ width: `${(currentWishIndex / 8) * 100}%` }}
                    >
                      <div className="h-full w-full bg-white/20 animate-pulse"></div>
                    </div>
                  </div>
                </div>

                {/* 加载动画 */}
                <div className="flex justify-center">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-bounce delay-100"></div>
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mb-8 bg-red-100 border-2 border-red-300 rounded-xl p-4 text-center">
              <p className="text-red-700 font-bold">{error}</p>
            </div>
          )}

          {/* 九宫格展示 */}
          {generatedImages.length > 0 && uploadedAvatar && (
            <div className="mb-12">
              <h3 className="text-2xl sm:text-3xl font-bold text-center mb-6 text-red-600">
                🎊 {t('result.title')} 🎊
              </h3>
              <NineGridDisplay
                userAvatar={uploadedAvatar}
                generatedImages={generatedImages}
                wishes={wishes}
                onDownloadAll={handleDownloadAll}
                isDownloading={isDownloading}
              />
              <div className="text-center mt-6">
                <button
                onClick={() => {
                  setUploadedAvatar('')
                  setGeneratedImages([])
                  setWishes([])
                  setError('')
                  setCurrentWishIndex(0)
                  setCurrentWishName('')
                  setSelectedWishes([])
                }}
                  className="px-6 py-3 rounded-full font-bold text-red-600 border-2 border-red-600 hover:bg-red-50 transition-all"
                >
                  {t('generate.retry')}
                </button>
              </div>
            </div>
          )}

          {/* 特色说明 */}
          {!uploadedAvatar && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
              {[
                { title: t('features.free'), desc: t('features.freeDesc'), icon: '🎁' },
                { title: t('features.noLogin'), desc: t('features.noLoginDesc'), icon: '👤' },
                { title: t('features.fast'), desc: t('features.fastDesc'), icon: '⚡' },
                { title: t('features.share'), desc: t('features.shareDesc'), icon: '📱' },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-white/80 backdrop-blur-sm rounded-xl p-4 text-center shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                  <div className="text-4xl mb-2">{feature.icon}</div>
                  <h4 className="font-bold text-gray-800 mb-1">{feature.title}</h4>
                  <p className="text-xs text-gray-600">{feature.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* 使用步骤 */}
          {!uploadedAvatar && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-xl mb-12">
              <h3 className="text-2xl font-bold text-center mb-6 text-red-600">
                {t('steps.title')}
              </h3>
              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  { step: '1', title: t('steps.step1'), desc: t('steps.step1Desc'), icon: '📸' },
                  { step: '2', title: t('steps.step2'), desc: t('steps.step2Desc'), icon: '🎨' },
                  { step: '3', title: t('steps.step3'), desc: t('steps.step3Desc'), icon: '💾' },
                ].map((item, index) => (
                  <div key={index} className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3 shadow-lg">
                      {item.step}
                    </div>
                    <div className="text-3xl mb-2">{item.icon}</div>
                    <h4 className="font-bold text-gray-800 mb-2">{item.title}</h4>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 温馨提示 */}
          {!uploadedAvatar && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 sm:p-8">
              <h3 className="text-xl font-bold text-center mb-4 text-yellow-800">
                💡 {t('tips.title')}
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>{t('tips.tip1')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>{t('tips.tip2')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>{t('tips.tip3')}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  <span>{t('tips.tip4')}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* 添加渐变动画 */}
      <style jsx>{`
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .delay-100 {
          animation-delay: 0.1s;
        }
        .delay-200 {
          animation-delay: 0.2s;
        }
      `}</style>
    </div>
  )
}
