'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Check, Copy, Download, X } from 'lucide-react'

interface Wish {
  id: string
  name: string
}

interface NineGridDisplayProps {
  userAvatar: string
  generatedImages: string[]
  wishes: Wish[]
  onDownloadAll: () => void
  isDownloading?: boolean
}

export default function NineGridDisplay({
  userAvatar,
  generatedImages,
  wishes,
  onDownloadAll,
  isDownloading = false
}: NineGridDisplayProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewWish, setPreviewWish] = useState<Wish | null>(null)
  const [isCopySuccess, setIsCopySuccess] = useState(false)

  const shareText = 'Dreamifly【dreamifly.com】九宫格， 你也来试试吧'

  // 九宫格布局（中间是用户原图）
  const gridImages = [
    { image: generatedImages[0], wish: wishes[0], isUser: false },
    { image: generatedImages[1], wish: wishes[1], isUser: false },
    { image: generatedImages[2], wish: wishes[2], isUser: false },
    { image: generatedImages[3], wish: wishes[3], isUser: false },
    { image: userAvatar, wish: null, isUser: true },
    { image: generatedImages[4], wish: wishes[4], isUser: false },
    { image: generatedImages[5], wish: wishes[5], isUser: false },
    { image: generatedImages[6], wish: wishes[6], isUser: false },
    { image: generatedImages[7], wish: wishes[7], isUser: false },
  ]

  const handleImageClick = (image: string, wish: Wish | null) => {
    setPreviewImage(image)
    setPreviewWish(wish)
  }

  const closePreview = () => {
    setPreviewImage(null)
    setPreviewWish(null)
  }

  const handleCopyShareText = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = shareText
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setIsCopySuccess(true)
      setTimeout(() => setIsCopySuccess(false), 1800)
    } catch (error) {
      console.error('Copy share text failed:', error)
    }
  }

  return (
    <div className="w-full">
      {/* 九宫格展示 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-sm sm:max-w-md lg:max-w-2xl mx-auto mb-6">
        {gridImages.map((item, index) => (
          <div
            key={index}
            className="aspect-square relative overflow-hidden rounded-[20px] cursor-pointer group transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
            style={{
              boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 15%, transparent), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.05)',
            }}
            onClick={() => handleImageClick(item.image, item.wish)}
          >
            {/* 图片 */}
            <div
              className="relative w-full h-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--card)) 0%, color-mix(in srgb, var(--accent) 10%, var(--card)) 100%)',
              }}
            >
              {item.image ? (
                <Image
                  src={item.image.startsWith('data:') ? item.image : `data:image/png;base64,${item.image}`}
                  alt={item.isUser ? '我的头像' : item.wish?.name || '愿望图'}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}
                  />
                </div>
              )}
            </div>

            {/* Hover 边框 */}
            <div
              className="absolute inset-0 rounded-[20px] opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none"
              style={{
                border: '3px solid var(--accent)',
                boxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 25%, transparent)',
              }}
            />

            {/* 愿望标签 */}
            {!item.isUser && item.wish && (
              <div
                className="absolute bottom-0 left-0 right-0 p-2 transition-opacity duration-200"
                style={{
                  background: 'linear-gradient(to top, color-mix(in srgb, var(--foreground) 70%, transparent), transparent)',
                }}
              >
                <div className="flex items-center justify-center gap-1 text-white text-[10px] sm:text-xs font-bold">
                  <span>{item.wish.name}</span>
                </div>
              </div>
            )}

            {/* 用户原图标识 */}
            {item.isUser && (
              <div
                className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-xl font-bold"
                style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)',
                  color: 'var(--primary-foreground)',
                  boxShadow: '0 2px 6px color-mix(in srgb, var(--primary) 30%, transparent)',
                }}
              >
                ❤️
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 分享文案复制卡片 */}
      <div className="max-w-sm sm:max-w-md lg:max-w-2xl mx-auto mb-4 sm:mb-5">
        <Card variant="flat">
          <CardContent>
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                type="text"
                readOnly
                value={shareText}
                aria-label="分享文案"
                className="flex-1 h-10 px-3 rounded-xl text-sm border"
                style={{
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                  borderColor: 'color-mix(in srgb, var(--border) 85%, transparent)',
                }}
              />
              <Button
                variant={isCopySuccess ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleCopyShareText}
                leftIcon={isCopySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              >
                {isCopySuccess ? '已复制' : '一键复制'}
              </Button>
            </div>
            <p className="text-[11px] sm:text-xs mt-2.5" style={{ color: 'var(--muted-foreground)' }}>
              携带文案发布至任意社交媒体平台，可私信QQ群管理员抽奖， 每人限一次
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 下载按钮 */}
      <div className="text-center">
        <Button
          variant="primary"
          size="xl"
          onClick={onDownloadAll}
          isLoading={isDownloading}
          leftIcon={<Download className="w-5 h-5" />}
        >
          {isDownloading ? '下载中...' : '一键保存九宫格'}
        </Button>
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--muted-foreground)' }}
        >
          可直接分享朋友圈
        </p>
      </div>

      {/* ===== 图片预览 Modal ===== */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          {/* 半透明遮罩 */}
          <div className="absolute inset-0 bg-black/80" />

          <div
            className="relative max-w-3xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 关闭按钮 */}
            <button
              onClick={closePreview}
              className="absolute -top-12 right-0 flex items-center gap-1 text-white text-sm transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            >
              <X className="w-4 h-4" />
              <span>关闭</span>
            </button>

            {/* 预览图片 */}
            <div
              className="relative w-full aspect-square rounded-[24px] overflow-hidden"
              style={{
                boxShadow: '0 16px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
                background: 'black',
              }}
            >
              <Image
                src={previewImage.startsWith('data:') ? previewImage : `data:image/png;base64,${previewImage}`}
                alt="预览"
                fill
                className="object-contain"
                unoptimized
              />
            </div>

            {/* 愿望信息 */}
            {previewWish && (
              <div className="mt-4 text-center">
                <div
                  className="inline-block px-6 py-3 rounded-2xl text-lg font-bold"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--accent) 80%, black) 100%)',
                    color: 'white',
                    boxShadow: '0 4px 16px color-mix(in srgb, var(--primary) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
                  }}
                >
                  {previewWish.name}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
