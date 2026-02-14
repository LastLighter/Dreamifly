'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import NineGridDisplay from '@/components/NineGridDisplay'
import { generateDynamicToken } from '@/utils/dynamicToken'
import NewYearFooter from '@/components/new-year/NewYearFooter'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Upload, Sparkles, RefreshCw, Camera, Wand2, Download, Check } from 'lucide-react'

interface Wish {
  id: string
  name: string
  image?: string
  prompt?: string
}

export default function NewYearWishPage() {
  const t = useTranslations('newYearWish')
  
  const [uploadedAvatar, setUploadedAvatar] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [wishes, setWishes] = useState<Wish[]>([])
  const [error, setError] = useState<string>('')
  const [currentWishIndex, setCurrentWishIndex] = useState<number>(0)
  const [currentWishName, setCurrentWishName] = useState<string>('')
  const [selectedWishes, setSelectedWishes] = useState<Wish[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [availableFirstWishes, setAvailableFirstWishes] = useState<Wish[]>([])
  const [selectedFirstWish, setSelectedFirstWish] = useState<Wish | null>(null)
  const [isLoadingFirstWishes, setIsLoadingFirstWishes] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 随机抽取 3 个愿望供用户选为首个愿望
  const loadRandomFirstWishes = useCallback(async () => {
    setIsLoadingFirstWishes(true)
    try {
      const wishesResponse = await fetch('/data/wishes.json')
      const allWishes: Wish[] = await wishesResponse.json()
      const shuffled = [...allWishes].sort(() => 0.5 - Math.random())
      setAvailableFirstWishes(shuffled.slice(0, 3))
      setSelectedFirstWish(null)
    } finally {
      setIsLoadingFirstWishes(false)
    }
  }, [])

  useEffect(() => {
    loadRandomFirstWishes()
  }, [loadRandomFirstWishes])

  const handleRefreshFirstWishes = () => {
    loadRandomFirstWishes()
  }

  const handleSelectFirstWish = (wish: Wish) => {
    setSelectedFirstWish(prev => (prev?.id === wish.id ? null : wish))
  }

  // 处理图片上传
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('请上传图片文件')
      return
    }

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
    
    try {
      const wishesResponse = await fetch('/data/wishes.json')
      const allWishes: Wish[] = await wishesResponse.json()
      
      let selected: Wish[]
      if (selectedFirstWish) {
        const remaining = allWishes.filter(w => w.id !== selectedFirstWish.id)
        const shuffled = [...remaining].sort(() => 0.5 - Math.random())
        selected = [selectedFirstWish, ...shuffled.slice(0, 7)]
      } else {
        const shuffled = [...allWishes].sort(() => 0.5 - Math.random())
        selected = shuffled.slice(0, 8)
      }
      setSelectedWishes(selected)
      
      // 智能进度条：前期正常推进，后期减速避免过早到100%
      let progressStep = 0
      const progressInterval = setInterval(() => {
        setCurrentWishIndex(() => {
          progressStep++
          
          // 0-6步：正常推进（每15秒一个愿望，达到75%）
          if (progressStep <= 6) {
            const next = progressStep
            if (next <= selected.length) {
              setCurrentWishName(selected[next - 1].name)
            }
            return next
          }
          // 7-10步：减速推进到90%（避免过早到100%）
          else if (progressStep <= 10) {
            const progress = 6 + (progressStep - 6) * 0.35 // 每步增加0.35
            const index = Math.floor(progress)
            if (index < selected.length) {
              setCurrentWishName(selected[index].name)
            }
            return progress
          }
          // 10+步：缓慢爬升到95%，等待真实完成
          else {
            const progress = 7.6 + Math.min((progressStep - 10) * 0.08, 0.4) // 最多到7.6+0.4=8但不到真正的8
            return progress
          }
        })
      }, 15000)

      const token = generateDynamicToken()
      const base64Data = uploadedAvatar.split(',')[1]

      const response = await fetch('/api/new-year-wish/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatar: base64Data,
          token: token,
          wishes: selected,
        }),
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '生成失败')
      }

      const data = await response.json()
      
      if (data.success) {
        // 立即跳到100%完成状态
        setCurrentWishIndex(8)
        setCurrentWishName('') // 清空当前愿望名称
        // 短暂延迟后显示结果，让用户看到完成状态
        await new Promise(resolve => setTimeout(resolve, 500))
        setGeneratedImages(data.images)
        setWishes(data.wishes)
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
      const allImages = [
        ...generatedImages.slice(0, 4),
        uploadedAvatar,
        ...generatedImages.slice(4, 8),
      ]

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

  // 重置全部状态
  const handleReset = () => {
    setUploadedAvatar('')
    setGeneratedImages([])
    setWishes([])
    setError('')
    setCurrentWishIndex(0)
    setCurrentWishName('')
    setSelectedWishes([])
    setSelectedFirstWish(null)
    loadRandomFirstWishes()
  }

  return (
    <div
      className="new-year-theme min-h-screen relative overflow-x-hidden overflow-y-auto"
      style={{
        background: 'linear-gradient(165deg, var(--background) 0%, color-mix(in srgb, var(--background) 85%, var(--primary)) 50%, color-mix(in srgb, var(--background) 75%, var(--accent)) 100%)',
      }}
    >
      {/* ===== 背景装饰粒子 ===== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-[8%] left-[8%] w-16 h-16 rounded-full ny-float"
          style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
        />
        <div
          className="absolute top-[15%] right-[12%] w-12 h-12 rounded-full ny-float-alt ny-float-delay-1"
          style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
        />
        <div
          className="absolute bottom-[20%] left-[20%] w-20 h-20 rounded-full ny-float ny-float-delay-2"
          style={{ background: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}
        />
        <div
          className="absolute bottom-[30%] right-[18%] w-10 h-10 rounded-full ny-float-alt ny-float-delay-3"
          style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
        />
        <div
          className="absolute top-[45%] left-[5%] w-8 h-8 rounded-full ny-float ny-float-delay-1"
          style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)' }}
        />
        <div
          className="absolute top-[60%] right-[8%] w-14 h-14 rounded-full ny-float-alt ny-float-delay-2"
          style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
        />
      </div>

      {/* ===== 主内容 ===== */}
      <div className="container mx-auto px-4 pt-24 pb-6 sm:pt-8 sm:pb-8 relative z-10 max-w-4xl">

        {/* ===== Hero 区域 ===== */}
        <section className="text-center mb-8 sm:mb-10">
          <div className="mb-4">
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-black mb-2 ny-gradient-animate"
              style={{
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 40%, var(--primary) 80%, var(--accent) 100%)',
                backgroundSize: '200% 200%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {t('title')}
            </h1>
            <h2
              className="text-lg sm:text-xl lg:text-2xl font-bold mb-3"
              style={{ color: 'var(--primary)' }}
            >
              {t('subtitle')}
            </h2>
          </div>
          <p
            className="text-sm sm:text-base max-w-xl mx-auto"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {t('description')}
          </p>
        </section>

        {/* ===== 主功能区域 ===== */}
        <div className="max-w-3xl mx-auto">

          {/* 选择你的新年愿望（首个愿望自选） */}
          {!uploadedAvatar && (
            <div className="mb-8 overflow-visible">
              <Card variant="elevated" className="overflow-visible">
                <CardContent className="pt-4 pb-4 px-2 sm:px-3 overflow-visible">
                  {/* 标题与刷新按钮在同一行 */}
                  <div className="flex items-center justify-between mb-2">
                    <h3
                      className="text-xl font-bold leading-tight"
                      style={{ color: 'var(--primary)' }}
                    >
                      {t('selectFirst.title')}
                    </h3>
                    <button
                      type="button"
                      onClick={handleRefreshFirstWishes}
                      disabled={isLoadingFirstWishes}
                      className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                      style={{
                        background: 'var(--card)',
                        border: '1.5px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                        color: 'var(--primary)',
                      }}
                      title={t('selectFirst.refresh')}
                    >
                      <RefreshCw className={`w-5 h-5 ${isLoadingFirstWishes ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  {/* 副标题 */}
                  <p
                    className="text-sm leading-relaxed max-w-xl mb-5"
                    style={{ color: 'var(--muted-foreground)' }}
                  >
                    {t('selectFirst.subtitle')}
                  </p>
                  {/* 愿望选项 */}
                  <div className="flex gap-3 items-stretch min-w-0 overflow-visible">
                    {availableFirstWishes.map((wish) => {
                      const isSelected = selectedFirstWish?.id === wish.id
                      return (
                        <button
                          key={wish.id}
                          type="button"
                          onClick={() => handleSelectFirstWish(wish)}
                          className="flex-1 min-w-0 rounded-2xl text-center transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--primary)] overflow-hidden flex flex-col"
                          style={{
                            background: 'var(--card)',
                            border: '2px solid ' + (isSelected ? 'color-mix(in srgb, var(--primary) 50%, transparent)' : 'color-mix(in srgb, var(--primary) 18%, var(--border))'),
                            boxShadow: isSelected
                              ? '0 2px 12px color-mix(in srgb, var(--primary) 20%, transparent)'
                              : 'none',
                          }}
                        >
                          {/* 正方形图片容器 - 占据更多空间 */}
                          <div className="relative w-full aspect-square overflow-hidden flex-shrink-0">
                            {wish.image ? (
                              <img
                                src={wish.image}
                                alt={wish.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div 
                                className="w-full h-full flex items-center justify-center"
                                style={{ background: 'color-mix(in srgb, var(--primary) 8%, var(--card))' }}
                              >
                                <Sparkles className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} />
                              </div>
                            )}
                            {/* 选中状态的打勾图标 */}
                            {isSelected && (
                              <div className="absolute top-0 right-0 rounded-full bg-green-500 p-1 shadow-lg transition-all duration-200 border-2 border-white z-10">
                                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                              </div>
                            )}
                          </div>
                          {/* 文字标题 - 减少padding */}
                          <div 
                            className="px-2 py-1.5 flex-shrink-0"
                            style={{
                              background: isSelected
                                ? 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--card)) 0%, color-mix(in srgb, var(--accent) 10%, var(--card)) 100%)'
                                : 'transparent',
                            }}
                          >
                            <span 
                              className="text-xs font-medium leading-snug break-words line-clamp-2"
                              style={{ color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)' }}
                            >
                              {wish.name}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 上传区域 */}
          {!uploadedAvatar && (
            <div className="mb-8">
              <Card variant="elevated" noPadding>
                <div
                  className="rounded-[20px] p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    border: '3px dashed color-mix(in srgb, var(--primary) 40%, transparent)',
                    background: 'color-mix(in srgb, var(--primary) 3%, var(--card))',
                  }}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div
                    className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-4"
                    style={{
                      background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)',
                      boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
                    }}
                  >
                    <Upload className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-lg sm:text-xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
                    {t('upload.button')}
                  </p>
                  <p className="text-sm mb-2" style={{ color: 'var(--muted-foreground)' }}>
                    {t('upload.dragTip')}
                  </p>
                  <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--muted-foreground) 70%, transparent)' }}>
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
              </Card>
            </div>
          )}

          {/* 已上传图片预览 + 操作 */}
          {uploadedAvatar && !generatedImages.length && !isGenerating && (
            <div className="mb-8">
              <Card variant="elevated">
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* 头像预览 */}
                    <div
                      className="w-32 h-32 sm:w-36 sm:h-36 relative rounded-[20px] overflow-hidden flex-shrink-0"
                      style={{
                        border: '3px solid var(--accent)',
                        boxShadow: '0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
                      }}
                    >
                      <img
                        src={uploadedAvatar}
                        alt="上传的照片"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* 操作区 */}
                    <div className="flex-1 text-center sm:text-left">
                      <p
                        className="text-base font-semibold mb-5"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {t('upload.button')}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          variant="primary"
                          size="xl"
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          leftIcon={<Sparkles className="w-5 h-5" />}
                        >
                          {t('generate.button')}
                        </Button>
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={() => {
                            setUploadedAvatar('')
                            setError('')
                          }}
                          leftIcon={<RefreshCw className="w-4 h-4" />}
                        >
                          {t('generate.retry')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== 生成进度 ===== */}
          {isGenerating && (
            <div className="mb-8">
              <Card variant="elevated">
                <CardContent>
                  {/* 标题 */}
                  <div className="text-center mb-6">
                    <p
                      className="text-xl font-bold mb-1"
                      style={{ color: 'var(--primary)' }}
                    >
                      {t('generate.generating')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {t('tips.tip2')}
                    </p>
                  </div>

                  {/* 已抽取的愿望 */}
                  {selectedWishes.length > 0 && (
                    <div className="mb-6">
                      <div className="flex flex-wrap justify-center gap-2">
                        {selectedWishes.map((wish, index) => {
                          const isCompleted = index < Math.floor(currentWishIndex)
                          const isCurrent = index === Math.floor(currentWishIndex) && currentWishIndex < 8
                          
                          return (
                            <div
                              key={wish.id}
                              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-300"
                              style={{
                                background: isCompleted
                                  ? 'color-mix(in srgb, var(--accent) 15%, var(--card))'
                                  : isCurrent
                                  ? 'color-mix(in srgb, var(--primary) 12%, var(--card))'
                                  : 'var(--muted)',
                                color: isCompleted
                                  ? 'color-mix(in srgb, var(--accent) 80%, black)'
                                  : isCurrent
                                  ? 'var(--primary)'
                                  : 'var(--muted-foreground)',
                                border: isCurrent
                                  ? '2px solid color-mix(in srgb, var(--primary) 40%, transparent)'
                                  : isCompleted
                                  ? '2px solid color-mix(in srgb, var(--accent) 30%, transparent)'
                                  : '2px solid color-mix(in srgb, var(--border) 50%, transparent)',
                                boxShadow: isCurrent
                                  ? '0 2px 8px color-mix(in srgb, var(--primary) 15%, transparent)'
                                  : 'none',
                              }}
                            >
                              {wish.name}
                              {isCompleted && ' ✓'}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 当前生成的愿望 */}
                  {currentWishName && currentWishIndex > 0 && currentWishIndex < 8 && (
                    <div className="text-center mb-6">
                      <div
                        className="inline-block px-5 py-2.5 rounded-2xl text-sm font-bold ny-pulse-soft"
                        style={{
                          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--card)) 0%, color-mix(in srgb, var(--accent) 10%, var(--card)) 100%)',
                          color: 'var(--primary)',
                          border: '2px solid color-mix(in srgb, var(--primary) 25%, transparent)',
                        }}
                      >
                        {t('generate.progress', { current: Math.ceil(currentWishIndex), total: 8 })} — {currentWishName}
                      </div>
                    </div>
                  )}

                  {/* 进度条 */}
                  <div className="mb-5">
                    <div className="flex justify-between text-xs font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
                      <span>{t('generate.generating')}</span>
                      <span>
                        {currentWishIndex >= 8 
                          ? '8/8 (100%)'
                          : `${Math.ceil(currentWishIndex)}/8 (${Math.round((currentWishIndex / 8) * 100)}%)`
                        }
                      </span>
                    </div>
                    <div
                      className="w-full h-3 rounded-full overflow-hidden relative"
                      style={{ background: 'var(--muted)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out relative ny-progress-shine"
                        style={{
                          width: `${Math.min((currentWishIndex / 8) * 100, 100)}%`,
                          background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
                        }}
                      />
                    </div>
                  </div>

                  {/* 加载动画 */}
                  <div className="flex justify-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full ny-bounce-dot"
                      style={{ background: 'var(--primary)' }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full ny-bounce-dot ny-bounce-dot-delay-1"
                      style={{ background: 'var(--accent)' }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full ny-bounce-dot ny-bounce-dot-delay-2"
                      style={{ background: 'var(--primary)' }}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* 错误提示 */}
          {error && (
            <div className="mb-6">
              <Card variant="flat">
                <div
                  className="px-5 py-3 rounded-[20px] text-center text-sm font-medium"
                  style={{
                    background: 'color-mix(in srgb, var(--destructive) 8%, var(--card))',
                    color: 'var(--destructive)',
                    border: '2px solid color-mix(in srgb, var(--destructive) 25%, transparent)',
                  }}
                >
                  {error}
                </div>
              </Card>
            </div>
          )}

          {/* ===== 九宫格结果 ===== */}
          {generatedImages.length > 0 && uploadedAvatar && (
            <div className="mb-10">
              <h3
                className="text-xl sm:text-2xl font-bold text-center mb-6"
                style={{ color: 'var(--primary)' }}
              >
                {t('result.title')}
              </h3>
              <NineGridDisplay
                userAvatar={uploadedAvatar}
                generatedImages={generatedImages}
                wishes={wishes}
                onDownloadAll={handleDownloadAll}
                isDownloading={isDownloading}
              />
              <div className="text-center mt-6">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleReset}
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                >
                  {t('generate.retry')}
                </Button>
              </div>
            </div>
          )}

          {/* ===== 使用步骤 ===== */}
          {!uploadedAvatar && (
            <div className="mb-8">
              <Card variant="elevated">
                <CardContent>
                  <h3
                    className="text-lg font-bold text-center mb-6"
                    style={{ color: 'var(--primary)' }}
                  >
                    {t('steps.title')}
                  </h3>
                  <div className="grid sm:grid-cols-3 gap-6">
                    {[
                      { title: t('steps.step1'), desc: t('steps.step1Desc'), Icon: Camera },
                      { title: t('steps.step2'), desc: t('steps.step2Desc'), Icon: Wand2 },
                      { title: t('steps.step3'), desc: t('steps.step3Desc'), Icon: Download },
                    ].map((item, index) => (
                      <div key={index} className="text-center">
                        <div
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                          style={{
                            background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--accent) 80%, black) 100%)',
                            boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
                            color: 'var(--primary-foreground)',
                          }}
                        >
                          <item.Icon
                            className="w-5 h-5 sm:w-6 sm:h-6 mx-auto"
                            style={{ color: 'var(--accent)' }}
                          />
                        </div>
                        <h4
                          className="text-base sm:text-sm font-bold mb-1"
                          style={{ color: 'var(--foreground)' }}
                        >
                          {item.title}
                        </h4>
                        <p className="text-sm sm:text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== 温馨提示 ===== */}
          {!uploadedAvatar && (
            <div className="mb-8">
              <Card variant="flat">
                <CardContent>
                  <h3
                    className="text-base font-bold text-center mb-4"
                    style={{ color: 'color-mix(in srgb, var(--accent) 80%, black)' }}
                  >
                    {t('tips.title')}
                  </h3>
                  <ul className="space-y-2">
                    {[
                      t('tips.tip1'),
                      t('tips.tip2'),
                      t('tips.tip3'),
                      t('tips.tip4'),
                    ].map((tip, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <span
                          className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                          style={{ background: 'var(--accent)' }}
                        />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="max-w-3xl mx-auto">
          <NewYearFooter />
        </div>
      </div>
    </div>
  )
}
