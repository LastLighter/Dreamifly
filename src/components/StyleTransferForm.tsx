import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface StyleTransferFormProps {
  uploadedImages: string[];
  setUploadedImages: (value: string[] | ((prev: string[]) => string[])) => void;
  onStyleTransfer: (style: string) => void;
  isGenerating: boolean;
}

interface StyleOption {
  id: string;
  name: string;
  prompt: string;
  previewImage: string;
}

export const styleOptions: StyleOption[] = [
  {
    id: 'cartoon',
    name: 'cartoon',
    prompt: 'convert the style to cartoon',
    previewImage: '/styles/cartoon.png'
  },
  {
    id: 'anime',
    name: 'anime',
    prompt: 'convert the style to anime',
    previewImage: '/styles/anima.png'
  },
  {
    id: 'oil-painting',
    name: 'oilPainting',
    prompt: 'convert the style to oil painting',
    previewImage: '/styles/oil-painting.png'
  },
  {
    id: 'line-art',
    name: 'lineArt',
    prompt: 'convert the style to line art',
    previewImage: '/styles/line-Art.png'
  },
  {
    id: 'vector-line',
    name: 'vectorLine',
    prompt: 'convert the style to vector line art',
    previewImage: '/styles/vector line.png'
  },
  {
    id: 'pixel',
    name: 'pixel',
    prompt: 'convert the style to pixel art',
    previewImage: '/styles/pixel.png'
  },
  {
    id: 'lego',
    name: 'lego',
    prompt: 'convert the style to lego style',
    previewImage: '/styles/lego.png'
  },
  {
    id: 'risograph',
    name: 'risograph',
    prompt: 'convert the style to risograph illustration',
    previewImage: '/styles/risograph.png'
  },
  {
    id: 'realistic',
    name: 'realistic',
    prompt: 'convert the style to realistic',
    previewImage: '/styles/realistic.png'
  },
  {
    id: 'puppet',
    name: 'puppet',
    prompt: 'convert the style to puppet style',
    previewImage: '/styles/puppet.png'
  },
  {
    id: 'emoji',
    name: 'emoji',
    prompt: 'convert the style to emoji icon style',
    previewImage: '/styles/emoji-Icon.png'
  }
];

export default function StyleTransferForm({
  uploadedImages,
  setUploadedImages,
  onStyleTransfer,
  isGenerating
}: StyleTransferFormProps) {
  const t = useTranslations('home.generate')
  const [selectedStyle, setSelectedStyle] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [estimatedTime, setEstimatedTime] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 进度条动画逻辑
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isGenerating) {
      // 风格转换的预估时间（比生成图片稍快）
      const baseTime = 30; // 基础30秒
      const totalTime = baseTime;
      setEstimatedTime(totalTime);
      
      // 进度条动画
      let currentProgress = 0;
      const startTime = Date.now();
      
      timer = setInterval(() => {
        const currentTime = Date.now();
        const elapsedTime = (currentTime - startTime) / 1000; // 转换为秒
        const timeRatio = elapsedTime / totalTime;
        
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
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isGenerating]);

  const handleStyleSelect = (styleId: string) => {
    setSelectedStyle(styleId)
  }

  const handleStyleTransfer = () => {
    if (!selectedStyle || uploadedImages.length === 0) return
    
    const style = styleOptions.find(s => s.id === selectedStyle)
    if (style) {
      onStyleTransfer(style.prompt)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
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

    try {
      // 读取文件为 base64
      const reader = new FileReader()
      reader.onload = (event) => {
        if (event.target?.result) {
          // 移除 base64 前缀（如 "data:image/jpeg;base64,"）
          const base64String = event.target.result.toString().split(',')[1]
          
          // 替换现有图片（风格转换通常只需要一张参考图片）
          setUploadedImages([base64String])
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('Error processing image:', error)
      alert(t('error.validation.imageProcessing'))
    }
  }

  const handleRemoveImage = () => {
    setUploadedImages([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const input = fileInputRef.current
        if (input) {
          const dataTransfer = new DataTransfer()
          dataTransfer.items.add(file)
          input.files = dataTransfer.files
          handleImageUpload({ target: { files: dataTransfer.files } } as any)
        }
      }
    }
  }

  return (
    <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-orange-400/40">
      <div className="space-y-6">
      {/* 图片上传区域 */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-900 mb-4">
          <img src="/form/upload.svg" alt="Upload" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
          {t('form.upload.label')}
        </label>
        <div className="relative">
          <div className="grid grid-cols-1 gap-6">
            {/* 只显示第一张图片 */}
            {uploadedImages.length > 0 && (
              <div className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-orange-400/40 bg-white/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-orange-400/50">
                <Image
                  src={`data:image/jpeg;base64,${uploadedImages[0]}`}
                  alt="Reference image"
                  fill
                  className="object-contain"
                />
                {/* 图片标记 */}
                <div className="absolute bottom-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-gray-900 border border-orange-400/40 shadow-lg">
                  Reference Image
                </div>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-sm rounded-full text-gray-900 hover:text-red-500 hover:bg-red-100/20 transition-all duration-300 shadow-lg border border-orange-200/50 hover:border-red-500/50 opacity-0 group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            
            {/* 只有当没有图片时才显示上传表单 */}
            {uploadedImages.length === 0 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group relative aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all duration-300 p-4 ${
                  isDragging
                    ? 'border-orange-500 bg-gradient-to-br from-orange-100/20 to-amber-100/20 shadow-lg shadow-orange-400/20' 
                    : 'border-orange-400/40 bg-gradient-to-br from-white/50 to-white/50 hover:border-orange-400/60 hover:bg-gradient-to-br hover:from-white/60 hover:to-white/60 cursor-pointer hover:shadow-lg hover:shadow-orange-400/10'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <div className="flex flex-col items-center justify-center h-full space-y-2 group-hover:scale-105 transition-transform duration-300">
                  <div className="relative group-hover:animate-pulse">
                    <svg className="w-6 h-6 text-orange-500/70 group-hover:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-100/20 to-amber-100/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>
                  <div className="text-center">
                    <div className="space-y-1">
                      <p className="text-gray-900/90 font-medium text-sm group-hover:text-gray-900 transition-colors leading-tight">
                        {t('form.upload.clickOrDrag')}
                      </p>
                    </div>
                  </div>
                </div>
                {/* 拖拽时的视觉反馈 */}
                {isDragging && (
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-100/30 to-amber-100/30 rounded-2xl flex items-center justify-center">
                    <div className="text-gray-900 font-semibold text-lg">{t('form.upload.dropToUpload')}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 风格选择区域 */}
      <div>
        <label className="flex items-center text-sm font-medium text-gray-900 mb-4">
          <img src="/form/models.svg" alt="Style" className="w-5 h-5 mr-2 text-gray-900 [&>path]:fill-current" />
          {t('form.styleTransfer.selectStyle')}
        </label>
        <div className="grid grid-cols-2 gap-6 max-h-96 overflow-y-auto custom-scrollbar">
          {styleOptions.map((style) => (
            <div
              key={style.id}
              onClick={() => handleStyleSelect(style.id)}
              className={`group relative aspect-[4/3] rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 ${
                selectedStyle === style.id
                  ? 'border-orange-500 bg-gradient-to-br from-orange-100/20 to-amber-100/20 shadow-lg shadow-orange-400/20'
                  : 'border-orange-400/40 bg-gradient-to-br from-white/50 to-white/50 hover:border-orange-400/50 hover:bg-gradient-to-br hover:from-white/60 hover:to-white/60'
              }`}
            >
              <Image
                src={style.previewImage}
                alt={style.name}
                fill
                className="object-cover"
              />
              {/* 风格名称 */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/30 backdrop-blur-md p-2">
                <p className="text-orange-500 font-semibold text-xs text-center">
                  {t(`form.styleTransfer.styles.${style.name}`)}
                </p>
              </div>
              {/* 选中态指示器 */}
              {selectedStyle === style.id && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-amber-900" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 开始转换按钮 */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleStyleTransfer}
          disabled={isGenerating || !selectedStyle || uploadedImages.length === 0}
          className={`relative w-full px-8 py-3 text-lg rounded-xl transition-all duration-300 shadow-lg overflow-hidden ${
            selectedStyle && uploadedImages.length > 0 && !isGenerating
              ? 'text-white hover:shadow-xl hover:-translate-y-0.5'
              : 'text-gray-400 cursor-not-allowed'
          }`}
        >
          {/* 背景渐变 */}
          <div className={`absolute inset-0 transition-all duration-300 ${
            selectedStyle && uploadedImages.length > 0 && !isGenerating
              ? 'bg-gradient-to-r from-orange-400 to-amber-400'
              : 'bg-gray-100/50'
          }`} />
          
          {/* 进度条覆盖层 */}
          {isGenerating && (
            <div className="absolute inset-0 bg-gradient-to-r from-orange-300 to-amber-300 transition-all duration-300 ease-out"
                 style={{ width: `${progress}%` }} />
          )}
          
          {/* 水流动态效果 */}
          {isGenerating && (
            <>
              {/* 主要水流 */}
              <div className="absolute inset-0 overflow-hidden z-20 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-flow"
                     style={{ 
                       width: '200%', 
                       left: '-100%',
                       top: '0',
                       height: '100%'
                     }} />
              </div>
              
              {/* 次要水流 */}
              <div className="absolute inset-0 overflow-hidden z-20 pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-flow-delayed"
                     style={{ 
                       width: '150%', 
                       left: '-75%',
                       top: '0',
                       height: '100%'
                     }} />
              </div>
            </>
          )}
          
          {/* 按钮文字 */}
          <span className="relative z-10 font-medium">
            {isGenerating ? t('form.styleTransfer.transferring') : t('form.styleTransfer.startTransfer')}
          </span>
        </button>
        
        {/* 进度条信息 */}
        {isGenerating && (
          <div className="space-y-2">
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
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/70 to-transparent animate-flow"
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
    </div>
  )
}
