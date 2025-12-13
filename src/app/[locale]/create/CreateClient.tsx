'use client'

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import GenerateSection from '@/components/GenerateSection'
import community from '../communityWorks'

export default function CreateClient() {
  const searchParams = useSearchParams()
  
  // 社区作品数据状态
  const [communityWorks, setCommunityWorks] = useState(community)
  const [isLoadingCommunityWorks, setIsLoadingCommunityWorks] = useState(true)

  // 加载社区作品图片
  useEffect(() => {
    const fetchCommunityImages = async () => {
      try {
        setIsLoadingCommunityWorks(true)
        const response = await fetch('/api/community/images')
        
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.images && data.images.length > 0) {
            // 使用从数据库获取的图片，确保包含 userAvatar、userNickname、model 和 avatarFrameId
            const dbImages = data.images.map((img: any) => ({
              id: img.id,
              image: img.image,
              prompt: img.prompt,
              model: img.model || '',
              userAvatar: img.userAvatar || '/images/default-avatar.svg',
              userNickname: img.userNickname || '',
              avatarFrameId: img.avatarFrameId || null,
            }))
            
            // 如果数据库中的图片少于12张，用默认图片填充到12张
            if (dbImages.length < 12) {
              const defaultImages = community.map((work: any) => ({
                ...work,
                model: '默认',
                userAvatar: '/images/default-avatar.svg',
                userNickname: '默认',
                avatarFrameId: null,
              }))
              
              // 合并数据库图片和默认图片，优先显示数据库图片
              // 使用 'default-' 前缀确保默认图片的ID不会与数据库图片ID冲突
              const fillImages = defaultImages
                .slice(0, 12 - dbImages.length)
                .map((work: any, index: number) => ({
                  ...work,
                  id: `default-${work.id}-${index}`, // 确保ID唯一
                  model: '默认',
                  userNickname: '默认',
                }))
              
              const combinedImages = [
                ...dbImages,
                ...fillImages
              ]
              
              setCommunityWorks(combinedImages)
            } else {
              // 如果已经有12张或更多，直接使用数据库图片（最多显示12张）
              setCommunityWorks(dbImages.slice(0, 12))
            }
          } else {
            // 如果返回的数据无效或为空，使用默认图片（添加默认头像信息）
            setCommunityWorks(community.map((work: any) => ({
              ...work,
              model: '默认',
              userAvatar: '/images/default-avatar.svg',
              userNickname: '默认',
              avatarFrameId: null,
            })))
          }
        } else {
          // 请求失败，使用默认图片（添加默认头像信息）
          setCommunityWorks(community.map((work: any) => ({
            ...work,
            model: '默认',
            userAvatar: '/images/default-avatar.svg',
            userNickname: '默认',
            avatarFrameId: null,
          })))
        }
      } catch (error) {
        console.error('Error fetching community images:', error)
        // 请求失败，使用默认图片（添加默认头像信息）
        setCommunityWorks(community.map((work: any) => ({
          ...work,
          model: '默认',
          userAvatar: '/images/default-avatar.svg',
          userNickname: '默认',
          avatarFrameId: null,
        })))
      } finally {
        setIsLoadingCommunityWorks(false)
      }
    }

    fetchCommunityImages()
  }, [])

  const initialPrompt = useMemo(() => {
    return searchParams.get('prompt') || ''
  }, [searchParams])

  const initialModel = useMemo(() => {
    return searchParams.get('model') || ''
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 overflow-x-hidden">
      <main className="transition-all duration-300 mx-auto lg:pl-40 pt-10 sm:pt-8 lg:pt-2 lg:mt-0">
        <GenerateSection
          communityWorks={communityWorks}
          initialPrompt={initialPrompt}
          initialModel={initialModel}
        />

      </main>
    </div>
  )
}

