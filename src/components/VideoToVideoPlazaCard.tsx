'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { transferUrl } from '@/utils/locale'

interface VideoToVideoPlazaCardProps {
  name: string
  description?: string
  videoSrc: string
  thumbnailSrc: string
}

export default function VideoToVideoPlazaCard({
  name,
  description,
  videoSrc,
  thumbnailSrc
}: VideoToVideoPlazaCardProps) {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  // 点击外部关闭模态框
  const handleClickOutside = (event: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
      setShowInfoModal(false)
    }
  }

  if (showInfoModal) {
    document.addEventListener('mousedown', handleClickOutside)
  } else {
    document.removeEventListener('mousedown', handleClickOutside)
  }

  // 组件挂载时自动播放视频
  useEffect(() => {
    if (videoRef.current && isVideoLoaded) {
      videoRef.current.play().catch(() => {
        // 静音播放失败时不处理
      })
    }
  }, [isVideoLoaded])

  return (
    <div className="relative group">
      <Link
        href={transferUrl('/create?tab=video', locale)}
        className="block"
      >
        {/* 视频卡片 */}
        <div className="relative aspect-square rounded-2xl overflow-hidden shadow-xl border border-orange-400/30 mb-3">
          <div className="relative w-full h-full group-hover:scale-110 transition-transform duration-700 ease-out">
            {/* 视频元素 */}
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                isVideoLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              src={videoSrc}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
              onLoadedData={() => setIsVideoLoaded(true)}
            />

            {/* 缩略图作为加载占位符 */}
            {!isVideoLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse">
                <img
                  src={thumbnailSrc}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

          </div>

          {/* 左上角类型标签 */}
          <div
            className="absolute top-3 left-3 z-10"
            ref={modalRef}
          >
            <div className="relative">
              <button
                className="px-1.5 py-0.5 bg-gradient-to-r from-purple-500/40 to-pink-500/40 backdrop-blur-sm text-white text-[10px] font-medium rounded whitespace-nowrap hover:from-purple-500/60 hover:to-pink-500/60 transition-all duration-300"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowInfoModal(!showInfoModal)
                }}
              >
                模型
              </button>
              {showInfoModal && (
                <div className="absolute top-full left-0 mt-2 px-4 py-3 bg-black/90 backdrop-blur-md text-white text-sm rounded-lg shadow-2xl min-w-[250px] z-20">
                  <p className="font-semibold mb-1">Wan 2.2 I2V Lightning</p>
                  {description && (
                    <p className="text-xs text-gray-300 mt-2 mb-2">{description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="px-2 py-0.5 bg-purple-500/30 rounded text-xs">
                      图生视频
                    </span>
                    <span className="px-2 py-0.5 bg-pink-500/30 rounded text-xs">
                      支持中文
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右下角特征标签 */}
          <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 z-10">
            <div className="flex gap-1 justify-end flex-wrap-reverse items-end">
              <span className="px-1.5 py-0.5 bg-gradient-to-r from-purple-500/40 to-pink-500/40 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-medium rounded whitespace-nowrap">
                图生视频
              </span>
              <span className="px-1.5 py-0.5 bg-gradient-to-r from-pink-500/40 to-purple-500/40 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-medium rounded whitespace-nowrap">
                支持中文
              </span>
            </div>
          </div>
        </div>

        {/* 底部标题区域 */}
        <div className="px-1">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
            {name}
          </h3>
        </div>
      </Link>
    </div>
  )
}
