'use client'

import { useState } from 'react'
import Image from 'next/image'

interface Wish {
  id: string
  name: string
  icon: string
}

interface NineGridDisplayProps {
  userAvatar: string // 用户原图（中间位置）
  generatedImages: string[] // AI生成的8张图片
  wishes: Wish[] // 对应的8个愿望
  onDownloadAll: () => void // 下载所有图片的回调
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

  // 将9张图片按九宫格顺序排列（中间是用户原图）
  const gridImages = [
    { image: generatedImages[0], wish: wishes[0], isUser: false },
    { image: generatedImages[1], wish: wishes[1], isUser: false },
    { image: generatedImages[2], wish: wishes[2], isUser: false },
    { image: generatedImages[3], wish: wishes[3], isUser: false },
    { image: userAvatar, wish: null, isUser: true }, // 中间位置
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

  return (
    <div className="w-full">
      {/* 九宫格展示 */}
      <div className="grid grid-cols-3 gap-1 sm:gap-2 lg:gap-3 max-w-sm sm:max-w-md lg:max-w-2xl mx-auto mb-6">
        {gridImages.map((item, index) => (
          <div
            key={index}
            className="aspect-square relative overflow-hidden rounded-lg cursor-pointer group"
            onClick={() => handleImageClick(item.image, item.wish)}
          >
            {/* 图片 */}
            <div className="relative w-full h-full bg-gradient-to-br from-red-100 to-yellow-100">
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              )}
            </div>

            {/* 金色边框效果 */}
            <div className="absolute inset-0 border-2 border-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg shadow-lg shadow-yellow-400/50"></div>

            {/* 愿望标签 */}
            {!item.isUser && item.wish && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <div className="flex items-center justify-center gap-1 text-white text-xs sm:text-sm font-bold">
                  <span>{item.wish.icon}</span>
                  <span>{item.wish.name}</span>
                </div>
              </div>
            )}

            {/* 用户原图标识 */}
            {item.isUser && (
              <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-bold shadow-lg">
                ❤️ 我
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 下载按钮 */}
      <div className="text-center">
        <button
          onClick={onDownloadAll}
          disabled={isDownloading}
          className={`
            px-8 py-4 rounded-full font-bold text-lg
            bg-gradient-to-r from-red-600 to-yellow-500
            text-white shadow-xl
            transform transition-all duration-300
            ${isDownloading 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/50'
            }
          `}
        >
          {isDownloading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              下载中...
            </span>
          ) : (
            <span>🎉 一键保存九宫格</span>
          )}
        </button>
        <p className="text-sm text-gray-600 mt-2">可直接分享朋友圈</p>
      </div>

      {/* 图片预览Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            {/* 关闭按钮 */}
            <button
              onClick={closePreview}
              className="absolute -top-12 right-0 text-white text-xl hover:text-red-400 transition-colors"
            >
              ✕ 关闭
            </button>

            {/* 预览图片 */}
            <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden">
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
                <div className="inline-block bg-gradient-to-r from-red-600 to-yellow-500 text-white px-6 py-3 rounded-full font-bold text-xl shadow-lg">
                  {previewWish.icon} {previewWish.name}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
