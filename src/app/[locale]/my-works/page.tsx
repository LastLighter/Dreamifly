'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import Link from 'next/link'
import Image from 'next/image'

interface UserImage {
  id: string
  imageUrl: string
  prompt?: string | null
  model?: string | null
  width?: number | null
  height?: number | null
  createdAt: string
}

interface StorageInfo {
  currentCount: number
  maxImages: number
  isSubscribed: boolean
  subscriptionExpiresAt: string | null
  canAddMore: boolean
  message?: string
}

export default function MyWorksPage() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const t = useTranslations('myWorks')
  
  const [images, setImages] = useState<UserImage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [showHeaderSpacer, setShowHeaderSpacer] = useState(false)

  useEffect(() => {
    if (isPending) return
    
    if (!session?.user) {
      router.push(transferUrl('/', locale))
      return
    }
    
    fetchImages()
    fetchStorageInfo()
  }, [session, isPending, locale, router])

  // 检测页眉是否显示
  useEffect(() => {
    const checkHeader = () => {
      // 检查是否有固定定位在顶部的元素（页眉）
      // 查找所有固定定位的元素，检查是否在顶部
      const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const style = window.getComputedStyle(el)
        return style.position === 'fixed' && 
               (parseFloat(style.top) === 0 || style.top === '0px')
      })
      
      if (fixedElements.length > 0) {
        // 检查这些元素是否可见
        const visibleHeader = fixedElements.find(el => {
          const style = window.getComputedStyle(el)
          return style.display !== 'none' && 
                 style.visibility !== 'hidden' &&
                 parseFloat(style.opacity) > 0 &&
                 parseFloat(style.height) > 0
        })
        setShowHeaderSpacer(!!visibleHeader)
      } else {
        // 如果没有找到固定定位的顶部元素，根据窗口宽度判断（移动端通常小于 1024px）
        setShowHeaderSpacer(window.innerWidth < 1024)
      }
    }

    // 延迟检查，确保 DOM 已渲染
    const timeoutId = setTimeout(checkHeader, 100)

    // 监听窗口大小变化
    window.addEventListener('resize', checkHeader)
    
    // 使用 MutationObserver 监听 DOM 变化（页眉可能被动态隐藏/显示）
    const observer = new MutationObserver(() => {
      setTimeout(checkHeader, 50)
    })
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    })

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('resize', checkHeader)
      observer.disconnect()
    }
  }, [])

  const fetchImages = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/user/images')
      if (!response.ok) {
        throw new Error('获取图片失败')
      }
      const data = await response.json()
      setImages(data.images || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取图片失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchStorageInfo = async () => {
    try {
      const response = await fetch('/api/user/images/storage-info')
      if (response.ok) {
        const data = await response.json()
        setStorageInfo(data)
      }
    } catch (err) {
      console.error('获取存储信息失败:', err)
    }
  }

  const handleDeleteClick = (imageId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    setConfirmDeleteId(imageId)
    setDeleteError(null)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return
    
    try {
      setDeletingId(confirmDeleteId)
      setConfirmDeleteId(null)
      const response = await fetch(`/api/user/images/${confirmDeleteId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        throw new Error('删除失败')
      }
      
      // 重新获取图片列表和存储信息
      await fetchImages()
      await fetchStorageInfo()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleCancelDelete = () => {
    setConfirmDeleteId(null)
    setDeleteError(null)
  }

  const handleDownload = (imageUrl: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `image-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleImageClick = (imageUrl: string, e: React.MouseEvent) => {
    // 如果点击的是按钮区域，不触发预览
    const target = e.target as HTMLElement
    if (target.closest('button') || target.closest('[data-action-button]')) {
      return
    }
    setZoomedImage(imageUrl)
  }

  const handleCopyPrompt = async (prompt: string, imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (prompt) {
      try {
        await navigator.clipboard.writeText(prompt)
        setCopiedPromptId(imageId)
        setTimeout(() => setCopiedPromptId(null), 2000)
      } catch (err) {
        console.error('复制失败:', err)
      }
    }
  }

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      {/* 页眉占位符 - 当页眉显示时需要占位 */}
      {showHeaderSpacer && <div className="h-16"></div>}
      <div className="max-w-7xl mx-auto px-4 pb-16 pt-10 lg:pl-48">
        {/* 页面标题和统计 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('title')}</h1>
          
          {/* 审核提示 */}
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 backdrop-blur-sm px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-amber-800">
              未通过审核的图片将不会显示在此处
            </p>
          </div>
          
          {/* 存储信息卡片 */}
          {storageInfo && (
            <div className={`rounded-2xl border p-6 mb-6 ${
              storageInfo.message 
                ? 'border-blue-200 bg-blue-50' 
                : 'border-gray-200 bg-white'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{t('saved')}</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {storageInfo.currentCount} / {storageInfo.maxImages}
                  </span>
                  {storageInfo.isSubscribed ? (
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                      {t('member')}
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                      {t('regular')}
                    </span>
                  )}
                </div>
                {!storageInfo.isSubscribed && (
                  <Link
                    href={transferUrl('/pricing', locale)}
                    className="px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all text-sm font-medium"
                  >
                    {t('subscribe')}
                  </Link>
                )}
              </div>
              
              {storageInfo.message && (
                <div className="mt-3 p-3 rounded-lg bg-blue-100 border border-blue-200">
                  <p className="text-sm text-blue-800">{storageInfo.message}</p>
                </div>
              )}
              
              {storageInfo.subscriptionExpiresAt && storageInfo.isSubscribed && (
                <p className="mt-2 text-xs text-gray-500">
                  {t('expiresAt')}: {new Date(storageInfo.subscriptionExpiresAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* 图片网格 */}
        {images.length === 0 ? (
          <div className="text-center py-20">
            <div className="mb-6">
              <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('empty.title')}</h2>
            <p className="text-gray-600 mb-6">{t('empty.description')}</p>
            <Link
              href={transferUrl('/create', locale)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-xl hover:from-orange-500 hover:to-amber-500 transition-all font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {t('empty.button')}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((image) => (
                <div key={image.id} className="group relative rounded-2xl overflow-hidden bg-white border border-gray-200 hover:shadow-xl transition-all">
                  <div className="aspect-square relative overflow-hidden bg-gray-100">
                    <Image
                      src={image.imageUrl}
                      alt={image.prompt || '生成的图片'}
                      fill
                      className="object-cover cursor-zoom-in"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      onClick={(e) => handleImageClick(image.imageUrl, e as any)}
                    />
                    
                    {/* 左上角删除按钮 - 灰色磨砂玻璃底 */}
                    <button
                      data-action-button
                      onClick={(e) => handleDeleteClick(image.id, e)}
                      disabled={deletingId === image.id}
                      className="absolute top-3 left-3 p-2 bg-gray-500/60 backdrop-blur-md rounded-lg hover:bg-gray-600/70 transition-all duration-200 shadow-lg z-20 disabled:opacity-50"
                      title="删除图片"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* 右上角保存/下载按钮 - 灰色磨砂玻璃底 */}
                    <button
                      data-action-button
                      onClick={(e) => handleDownload(image.imageUrl, e)}
                      className="absolute top-3 right-3 p-2 bg-gray-500/60 backdrop-blur-md rounded-lg hover:bg-gray-600/70 transition-all duration-200 shadow-lg z-20"
                      title="保存图片"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    </button>

                    {/* 提示词显示区域 - 底部 */}
                    {image.prompt && (
                      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 via-black/40 to-transparent backdrop-blur-sm">
                        {/* 分辨率和模型标签 - 向右对齐 */}
                        {(image.width && image.height) || image.model ? (
                          <div className="flex justify-end gap-2 mb-2">
                            {image.width && image.height && (
                              <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs rounded-md border border-white/30">
                                {image.width} × {image.height}
                              </span>
                            )}
                            {image.model && (
                              <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs rounded-md border border-white/30">
                                {image.model}
                              </span>
                            )}
                          </div>
                        ) : null}
                        <p 
                          className="text-white text-xs line-clamp-2 cursor-pointer hover:text-orange-300 transition-colors"
                          onClick={(e) => handleCopyPrompt(image.prompt!, image.id, e)}
                          title="点击复制提示词"
                        >
                          {image.prompt}
                        </p>
                        {copiedPromptId === image.id && (
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-full mb-2 px-3 py-1.5 bg-green-500/90 backdrop-blur-md text-white text-xs rounded-lg whitespace-nowrap z-30 animate-fadeIn">
                            已复制提示词！
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-green-500/90"></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* 只在没有提示词时显示底部信息 */}
                  {!image.prompt && (
                    <div className="p-4">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        {image.width && image.height && (
                          <span>{image.width} × {image.height}</span>
                        )}
                        <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 图片放大预览模态框 */}
            {zoomedImage && (
              <div
                className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-4 animate-fadeInUp"
                onClick={() => setZoomedImage(null)}
              >
                {/* 顶部控制栏 */}
                <div className="w-full max-w-[1400px] flex justify-end mb-4">
                  <button
                    className="p-2 text-orange-300 hover:text-orange-100 transition-colors hover:scale-110 transform duration-300 bg-orange-800/50 rounded-full hover:bg-orange-700/50"
                    onClick={(e) => {
                      e.stopPropagation()
                      setZoomedImage(null)
                    }}
                    aria-label="关闭预览"
                  >
                    <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* 图片容器 */}
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className="relative w-full max-w-[1400px] max-h-[calc(100vh-8rem)] flex items-center justify-center">
                    <img
                      src={zoomedImage}
                      alt="预览图片"
                      className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto object-contain rounded-lg shadow-2xl border border-orange-400/30 animate-scaleIn"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* 底部提示 */}
                <div className="w-full max-w-[1400px] mt-4 text-center text-sm text-orange-200/60">
                  <p>点击背景或关闭按钮退出预览</p>
                </div>
              </div>
            )}

            {/* 删除确认模态框 */}
            {confirmDeleteId && (
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeInUp"
                onClick={handleCancelDelete}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">确认删除</h3>
                      <p className="text-sm text-gray-600 mt-1">确定要删除这张图片吗？此操作无法撤销。</p>
                    </div>
                  </div>

                  {deleteError && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                      <p className="text-sm text-red-700">{deleteError}</p>
                    </div>
                  )}

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={handleCancelDelete}
                      disabled={deletingId === confirmDeleteId}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={deletingId === confirmDeleteId}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {deletingId === confirmDeleteId ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          删除中...
                        </>
                      ) : (
                        '确认删除'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

