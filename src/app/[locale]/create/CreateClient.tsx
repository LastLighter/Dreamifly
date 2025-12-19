'use client'

import Image from 'next/image'
import { useMemo, useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import GenerateSection from '@/components/GenerateSection'
import CommunityMasonry, { type CommunityWork } from '@/components/CommunityMasonry'
import { transferUrl } from '@/utils/locale'
import community from '../communityWorks'

export default function CreateClient() {
  const t = useTranslations('home')
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  
  // 社区作品数据状态
  const [communityWorks, setCommunityWorks] = useState<CommunityWork[]>(
    community as unknown as CommunityWork[]
  )

  // 加载社区作品图片
  useEffect(() => {
    const fetchCommunityImages = async () => {
      try {
        const response = await fetch('/api/community/images')
        
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.images && data.images.length > 0) {
            // 使用从数据库获取的图片，确保包含 userAvatar、userNickname、model 和 avatarFrameId
            const dbImages: CommunityWork[] = data.images.map((img: any) => ({
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
              const defaultImages: CommunityWork[] = (community as any[]).map((work: any) => ({
                ...work,
                model: '默认',
                userAvatar: '/images/default-avatar.svg',
                userNickname: '默认',
                avatarFrameId: null,
              }))
              
              // 合并数据库图片和默认图片，优先显示数据库图片
              // 使用 'default-' 前缀确保默认图片的ID不会与数据库图片ID冲突
              const fillImages: CommunityWork[] = defaultImages
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
            setCommunityWorks((community as any[]).map((work: any) => ({
              ...work,
              model: '默认',
              userAvatar: '/images/default-avatar.svg',
              userNickname: '默认',
              avatarFrameId: null,
            })))
          }
        } else {
          // 请求失败，使用默认图片（添加默认头像信息）
          setCommunityWorks((community as any[]).map((work: any) => ({
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
        setCommunityWorks((community as any[]).map((work: any) => ({
          ...work,
          model: '默认',
          userAvatar: '/images/default-avatar.svg',
          userNickname: '默认',
          avatarFrameId: null,
        })))
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

  const navigateToCreate = (promptText?: string, modelId?: string) => {
    const params = new URLSearchParams()
    if (promptText) params.set('prompt', promptText)
    // 只有当模型ID存在且不是"默认"时才传递模型参数
    if (modelId && modelId.trim() !== '' && modelId !== '默认') {
      params.set('model', modelId)
    }
    const query = params.toString()
    router.push(transferUrl(`/create${query ? `?${query}` : ''}`, locale))

    // 同页跳转时手动滚回顶部，确保用户立即看到生成表单
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 overflow-x-hidden">
      {/* 图片放大模态框 */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-gray-200/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-4 animate-fadeInUp"
          onClick={() => setZoomedImage(null)}
        >
          {/* 顶部控制栏 */}
          <div className="w-full max-w-[1400px] flex justify-end mb-4">
            <button
              className="p-2 text-gray-700 hover:text-gray-900 transition-colors hover:scale-110 transform duration-300 bg-gray-100/50 rounded-full hover:bg-gray-200/50"
              onClick={(e) => {
                e.stopPropagation()
                setZoomedImage(null)
              }}
              aria-label={t('banner.closeButton')}
            >
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 图片容器 */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full max-w-[1400px] max-h-[calc(100vh-8rem)] flex items-center justify-center">
              <Image
                src={zoomedImage}
                alt="Zoomed preview"
                width={1400}
                height={800}
                className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto object-contain rounded-lg shadow-2xl border border-orange-400/30 animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
                priority={false}
              />
            </div>
          </div>

          {/* 底部提示 */}
          <div className="w-full max-w-[1400px] mt-4 text-center text-sm text-gray-600">
            <p>{t('preview.closeHint')}</p>
          </div>
        </div>
      )}

      <main className="transition-all duration-300 mx-auto lg:pl-40 pt-10 sm:pt-8 lg:pt-2 lg:mt-0">
        <GenerateSection
          communityWorks={communityWorks}
          initialPrompt={initialPrompt}
          initialModel={initialModel}
        />

        {/* Community Showcase Section（从首页复用，但不包含 SiteStats） */}
        <section
          id="community-showcase"
          className="py-14 sm:py-20 px-5 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 bg-gray-50/90 backdrop-blur-md relative"
        >
          <div className="w-full max-w-[1260px] mx-auto relative px-4 sm:px-6">
            <div className="text-center mb-12 sm:mb-15">
              <div className="flex items-center justify-center gap-5 mb-7">
                <Image
                  src="/common/comunity.svg"
                  alt="Community"
                  width={40}
                  height={40}
                  className="w-10 h-10"
                  priority={false}
                />
                <h2 className="text-2xl font-bold text-gray-900 animate-fadeInUp">
                  {t('community.title')}
                </h2>
              </div>
            </div>

            <div className="text-center mb-8">
              <p className="text-lg text-gray-700 animate-fadeInUp animation-delay-200">
                {t('community.subtitle')}
              </p>
            </div>

            <div className="animate-fadeInUp">
              <CommunityMasonry
                works={communityWorks}
                onGenerateSame={(prompt, model) => navigateToCreate(prompt, model)}
                onPreview={(img) => setZoomedImage(img)}
                generateSameText={t('community.generateSame')}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

