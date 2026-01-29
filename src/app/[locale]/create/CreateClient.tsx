'use client'

import Image from 'next/image'
import { useMemo, useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import GenerateSection from '@/components/GenerateSection'
import CommunityMasonry, { type CommunityWork } from '@/components/CommunityMasonry'
import { transferUrl } from '@/utils/locale'
import community from '../communityWorks'
import videoCommunityWorks from '../videoCommunityWorks'
import { useSession } from '@/lib/auth-client'

export default function CreateClient() {
  const t = useTranslations('home')
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'
  const { data: session } = useSession()

  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'generate' | 'video-generation'>('generate')

  // 当URL参数改变时，更新activeTab状态
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    const newTab = tabParam === 'video' ? 'video-generation' : 'generate'
    setActiveTab(newTab)
  }, [searchParams])

  const initialPrompt = useMemo(() => {
    return searchParams.get('prompt') || ''
  }, [searchParams])

  const initialModel = useMemo(() => {
    return searchParams.get('model') || ''
  }, [searchParams])
  
  // 社区作品数据状态
  const [communityWorks, setCommunityWorks] = useState<CommunityWork[]>(
    community as unknown as CommunityWork[]
  )
  
  // 视频社区作品数据状态
  const [videoWorks] = useState<CommunityWork[]>(
    videoCommunityWorks.map(work => ({
      id: work.id,
      image: work.image,
      video: work.video, // 添加视频字段
      prompt: work.prompt,
      model: '视频生成',
      userAvatar: '/images/default-avatar.svg',
      userNickname: '默认',
      avatarFrameId: null,
    })) as CommunityWork[]
  )

  // 加载社区作品图片（仅用于图片生成界面）
  useEffect(() => {
    if (activeTab === 'video-generation') {
      // 视频生成界面使用视频社区，不需要从API加载
      return
    }
    
    // 未登录用户直接使用默认图片，不请求API
    if (!session?.user) {
      setCommunityWorks((community as any[]).map((work: any) => ({
        ...work,
        model: '默认',
        userAvatar: '/images/default-avatar.svg',
        userNickname: '默认',
        avatarFrameId: null,
      })))
      return
    }

    // 已登录用户才请求API
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
  }, [activeTab, session?.user])

  // 将图片URL转换为base64
  const imageUrlToBase64 = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64String = reader.result?.toString()
          if (base64String) {
            // 移除 base64 前缀，只返回纯base64字符串
            const base64 = base64String.split(',')[1] || base64String
            resolve(base64)
          } else {
            reject(new Error('Failed to convert image to base64'))
          }
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      console.error('Error converting image URL to base64:', error)
      return null
    }
  }

  const navigateToCreate = async (promptText?: string, modelId?: string, imageUrl?: string) => {
    const params = new URLSearchParams()
    if (promptText) params.set('prompt', promptText)
    // 只有当模型ID存在且不是"默认"时才传递模型参数
    if (modelId && modelId.trim() !== '' && modelId !== '默认') {
      params.set('model', modelId)
    }
    // 如果当前是视频生成模式，保持tab参数
    if (activeTab === 'video-generation') {
      params.set('tab', 'video')
    }
    const query = params.toString()
    router.push(transferUrl(`/create${query ? `?${query}` : ''}`, locale))

    // 如果有图片URL，转换为base64并存储到sessionStorage，供GenerateSection使用
    if (imageUrl && activeTab === 'video-generation') {
      const base64 = await imageUrlToBase64(imageUrl)
      if (base64) {
        sessionStorage.setItem('videoReferenceImage', base64)
        // 触发自定义事件，通知GenerateSection
        window.dispatchEvent(new CustomEvent('videoReferenceImageReady', { detail: { base64, prompt: promptText } }))
      }
    }

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
          communityWorks={activeTab === 'video-generation' ? videoWorks : communityWorks}
          initialPrompt={initialPrompt}
          initialModel={initialModel}
          activeTab={activeTab}
          onTabChange={setActiveTab}
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
                works={activeTab === 'video-generation' ? videoWorks : communityWorks}
                onGenerateSame={(prompt, model, imageUrl) => navigateToCreate(prompt, model, imageUrl)}
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

