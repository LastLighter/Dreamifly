'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'

interface AvatarWithFrameProps {
  avatar: string
  avatarFrameId?: number | null
  size?: number
  className?: string
  alt?: string
}

/**
 * 带头像框的头像组件
 * 如果 avatarFrameId 为 null 或未提供，则不显示头像框
 * 当有头像框时，会自动隐藏黄色边框
 */
export default function AvatarWithFrame({
  avatar,
  avatarFrameId,
  size = 40,
  className = '',
  alt = 'Avatar'
}: AvatarWithFrameProps) {
  const [frameUrl, setFrameUrl] = useState<string | null>(null)
  const [hasFrame, setHasFrame] = useState<boolean>(false)

  useEffect(() => {
    const fetchFrame = async () => {
      // 如果头像框ID为null或undefined，不显示头像框
      if (avatarFrameId === null || avatarFrameId === undefined) {
        setFrameUrl(null)
        setHasFrame(false)
        return
      }

      try {
        const response = await fetch(`/api/avatar-frame?frameId=${avatarFrameId}`)
        if (response.ok) {
          const data = await response.json()
          // 如果返回的frameUrl为null或空，表示没有头像框
          if (data.frameUrl && data.frameUrl.trim() !== '') {
            setFrameUrl(data.frameUrl)
            setHasFrame(true)
          } else {
            setFrameUrl(null)
            setHasFrame(false)
          }
        } else {
          setFrameUrl(null)
          setHasFrame(false)
        }
      } catch (error) {
        console.error('Error fetching avatar frame:', error)
        setFrameUrl(null)
        setHasFrame(false)
      }
    }

    fetchFrame()
  }, [avatarFrameId])

  // 分离边框样式和其他样式
  const borderClasses: string[] = []
  const otherClasses: string[] = []
  
  className.split(' ').forEach(cls => {
    if (cls.match(/^border(-\d+)?$/) || 
        cls.match(/^border-(orange|amber)-\d+/) || 
        cls.match(/^border-(orange|amber)-\d+\/[\d.]+$/)) {
      borderClasses.push(cls)
    } else if (cls.trim()) {
      otherClasses.push(cls)
    }
  })

  const containerClassName = otherClasses.join(' ').trim()
  const avatarBorderClassName = borderClasses.join(' ').trim()

  // 如果有头像框，移除边框样式
  const processedContainerClassName = hasFrame ? containerClassName : containerClassName
  const processedAvatarClassName = hasFrame ? '' : avatarBorderClassName

  // 如果没有头像框，直接显示头像，边框应用到头像上
  if (!hasFrame) {
    return (
      <div className={processedContainerClassName ? `inline-block ${processedContainerClassName}` : 'inline-block'}>
        <Image
          src={avatar}
          alt={alt}
          width={size}
          height={size}
          className={`rounded-full object-cover ${processedAvatarClassName}`}
          unoptimized={avatar.startsWith('http')}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            if (!target.src.includes('default-avatar.svg')) {
              target.src = '/images/default-avatar.svg'
            }
          }}
        />
      </div>
    )
  }

  // 如果有头像框，使用固定容器和缩小的头像
  return (
    <div className={processedContainerClassName ? `relative inline-block ${processedContainerClassName}` : 'relative inline-block'} style={{ width: size, height: size }}>
      {/* 头像 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Image
          src={avatar}
          alt={alt}
          width={size * 0.85}
          height={size * 0.85}
          className="rounded-full object-cover"
          unoptimized={avatar.startsWith('http')}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            if (!target.src.includes('default-avatar.svg')) {
              target.src = '/images/default-avatar.svg'
            }
          }}
        />
      </div>
      {/* 头像框 */}
      {frameUrl && (
        <Image
          src={frameUrl}
          alt="Avatar Frame"
          width={size}
          height={size}
          className="absolute inset-0 object-contain pointer-events-none"
          unoptimized={frameUrl.startsWith('http')}
          onError={() => {
            // 如果头像框加载失败，隐藏头像框
            setFrameUrl(null)
            setHasFrame(false)
          }}
        />
      )}
    </div>
  )
}

