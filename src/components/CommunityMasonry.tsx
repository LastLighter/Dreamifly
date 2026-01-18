'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import AvatarWithFrame from '@/components/AvatarWithFrame'
import { isEncryptedImage, getImageDisplayUrl } from '@/utils/imageDisplay'
import ReportDialog from '@/components/ReportDialog'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

export type CommunityWork = {
  id: string | number
  image: string
  prompt: string
  model?: string
  userAvatar?: string
  userNickname?: string
  avatarFrameId?: string | number | null
  video?: string // 视频URL（可选）
}

function hashToIndex(input: string, mod: number) {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return mod === 0 ? 0 : h % mod
}

const aspectPresets = [
  // 比例整体更“矮”一点（更接近方形/轻微竖向），避免 3 列下卡片显得过高
  'aspect-[1/1]',
  'aspect-[6/7]',
  'aspect-[4/5]',
  'aspect-[5/6]',
  'aspect-[3/4]',
  'aspect-[2/3]',
] as const

export default function CommunityMasonry({
  works,
  onGenerateSame,
  onPreview,
  generateSameText,
}: {
  works: CommunityWork[]
  onGenerateSame: (prompt: string, model?: string, imageUrl?: string) => void
  onPreview?: (imageUrl: string) => void
  generateSameText: string
}) {
  // 用“设备能力”来决定交互方式，并对“混合设备”(iPad/触控屏笔记本)做稳定兜底：
  // - 只要检测到触摸能力 => 一律走“点击展开”模式（避免 hover 能力不稳定导致偶发失效）
  // - 仅在无触摸 + 支持 hover + 精准指针时 => 走 PC hover 交互
  const [interactionMode, setInteractionMode] = useState<'tap' | 'hover'>('tap')
  const [activeTapId, setActiveTapId] = useState<string | number | null>(null)

  // 举报相关状态
  const [userPermissions, setUserPermissions] = useState<{ isAdmin: boolean; isPremium: boolean } | null>(null)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [reportingImageId, setReportingImageId] = useState<string>('')

  useEffect(() => {
    const hoverMql = window.matchMedia('(hover: hover) and (pointer: fine)')
    const coarseMql = window.matchMedia('(pointer: coarse)')
    const noHoverMql = window.matchMedia('(hover: none)')

    const apply = () => {
      const hasTouch =
        (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0) ||
        (typeof window !== 'undefined' && 'ontouchstart' in window)

      // 只要是触屏/粗指针/明确无 hover，就强制 tap 模式（避免 iPad / 触屏笔记本的 hover 能力抖动）
      const forceTap = hasTouch || coarseMql.matches || noHoverMql.matches
      const canHover = hoverMql.matches && !forceTap

      setInteractionMode(canHover ? 'hover' : 'tap')
    }

    apply()

    // Safari < 14 fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyHover = hoverMql as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCoarse = coarseMql as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyNoHover = noHoverMql as any

    const add = (mql: MediaQueryList, anyMql: any) => {
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', apply)
        return () => mql.removeEventListener('change', apply)
      }
      if (typeof anyMql.addListener === 'function') {
        anyMql.addListener(apply)
        return () => anyMql.removeListener(apply)
      }
      return () => undefined
    }

    const cleanups = [add(hoverMql, anyHover), add(coarseMql, anyCoarse), add(noHoverMql, anyNoHover)]
    return () => cleanups.forEach((fn) => fn())
  }, [])

  // 切到 hover 模式时，不保留点击"展开态"
  useEffect(() => {
    if (interactionMode === 'hover') setActiveTapId(null)
  }, [interactionMode])

  // 获取用户权限（优质用户或管理员才能看到举报按钮）
  useEffect(() => {
    const checkUserPermissions = async () => {
      try {
        const token = await generateDynamicTokenWithServerTime()
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        if (response.ok) {
          const data = await response.json()
          setUserPermissions({
            isAdmin: data.isAdmin || false,
            isPremium: data.isPremium || false
          })
        }
      } catch (error) {
        console.error('Failed to check user permissions:', error)
        // 权限检查失败时，设置为无权限
        setUserPermissions({ isAdmin: false, isPremium: false })
      }
    }

    checkUserPermissions()
  }, [])

  // 解码加密图片的状态
  const [decodedImages, setDecodedImages] = useState<{ [key: string]: string }>({})
  const [decodingImages, setDecodingImages] = useState<Set<string>>(new Set())

  // 批量解码加密图片
  useEffect(() => {
    if (!works.length) return

    const encryptedImages = works.filter(
      work => isEncryptedImage(work.image) && !decodedImages[work.image] && !decodingImages.has(work.image)
    )

    if (encryptedImages.length === 0) return

    let cancelled = false
    const concurrency = 4
    const queue = [...encryptedImages]

    const runWorker = async () => {
      while (queue.length && !cancelled) {
        const work = queue.shift()
        if (!work) continue

        setDecodingImages(prev => new Set(prev).add(work.image))

        try {
          const decodedUrl = await getImageDisplayUrl(work.image, decodedImages)
          if (!cancelled) {
            setDecodedImages(prev => ({
              ...prev,
              [work.image]: decodedUrl
            }))
          }
        } catch (error) {
          console.error('解码图片失败:', error)
        } finally {
          setDecodingImages(prev => {
            const newSet = new Set(prev)
            newSet.delete(work.image)
            return newSet
          })
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, runWorker)
    Promise.all(workers).catch(err => {
      console.error('批量解码图片失败:', err)
    })

    return () => {
      cancelled = true
    }
  }, [works, decodedImages, decodingImages])

  // 处理举报按钮点击
  const handleReport = (imageId: string) => {
    setReportingImageId(imageId)
    setReportDialogOpen(true)
  }

  // 处理举报弹窗关闭
  const handleReportDialogClose = () => {
    setReportDialogOpen(false)
    setReportingImageId('')
  }

  // 获取图片显示URL
  const getDisplayUrl = (imageUrl: string): string => {
    if (isEncryptedImage(imageUrl)) {
      return decodedImages[imageUrl] || imageUrl // 如果还在解码中，显示原URL（会有加载状态）
    }
    return imageUrl
  }

  return (
    <>
      <div
        className={[
          // 卡片更"大"：减少列数，让每张卡片有更充足的展示空间
          // PC 端避免一行 4 张过窄：最大保持 3 列（更接近旧版 3 列的视觉密度）
          // 移动端也体现瀑布流：默认 2 列
          'columns-2 sm:columns-2 lg:columns-3 2xl:columns-3',
          '[column-gap:0.9rem] sm:[column-gap:1.5rem] lg:[column-gap:1.75rem]',
        ].join(' ')}
      >
        {works.map((work, index) => {
          const aspectClass =
            aspectPresets[hashToIndex(String(work.id ?? index), aspectPresets.length)] ??
            'aspect-[1/1]'

          const nickname = work.userNickname?.trim() || '默认'
          const model = work.model?.trim() || '默认'
          const avatar = work.userAvatar || '/images/default-avatar.svg'
          const isTapMode = interactionMode === 'tap'
          const isTapActive = isTapMode && activeTapId === work.id
          const shouldRenderOverlay = interactionMode === 'hover' || isTapActive

          return (
            <div
              key={work.id}
              className="mb-5 sm:mb-7 break-inside-avoid animate-fadeInUp"
              style={{ animationDelay: `${Math.min(index, 18) * 80}ms` }}
            >
              <div className="group relative overflow-hidden rounded-3xl border border-orange-200/50 bg-white/55 backdrop-blur-md shadow-[0_22px_70px_-50px_rgba(0,0,0,0.55)] ring-1 ring-black/5">
                {/* 图片：瀑布流高度来自不同的 aspect preset */}
                <div
                  className={[
                    'relative w-full overflow-hidden',
                    aspectClass,
                    // 防止某些比例导致卡片过矮：给瀑布流卡片一个高度下限，hover 信息不会显得"要溢出"
                    'min-h-[220px] sm:min-h-[280px] lg:min-h-[320px]',
                    // 点击模式：点击展开浮层；hover 模式：点击预览
                    interactionMode === 'hover' ? 'cursor-zoom-in' : 'cursor-pointer',
                  ].join(' ')}
                  role={onPreview ? 'button' : undefined}
                  tabIndex={onPreview ? 0 : undefined}
                  aria-label={onPreview ? '预览图片' : undefined}
                  onClick={() => {
                    if (interactionMode === 'tap') {
                      setActiveTapId((prev) => (prev === work.id ? null : work.id))
                      return
                    }
                    onPreview?.(getDisplayUrl(work.image))
                  }}
                  onKeyDown={(e) => {
                    if (!onPreview) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (interactionMode === 'tap') {
                        setActiveTapId((prev) => (prev === work.id ? null : work.id))
                        return
                      }
                      onPreview(getDisplayUrl(work.image))
                    }
                  }}
                >
                  {(() => {
                    // 如果有视频，显示视频
                    if (work.video) {
                      return (
                        <video
                          src={work.video}
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls={false}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                          style={{
                            pointerEvents: 'none',
                          }}
                          onLoadedData={(e) => {
                            // 确保视频自动播放
                            const video = e.currentTarget
                            video.play().catch(() => {
                              // 忽略自动播放失败的错误（某些浏览器策略）
                            })
                          }}
                        />
                      )
                    }

                    // 否则显示图片
                    const displayUrl = getDisplayUrl(work.image)
                    const isEncrypted = isEncryptedImage(work.image)
                    const isDecoding = isEncrypted && !decodedImages[work.image]

                    // 如果正在解码，只显示加载状态，不渲染 Image
                    if (isDecoding) {
                      return (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                        </div>
                      )
                    }

                    return (
                      <Image
                        src={displayUrl}
                        alt={`Community work ${work.id}`}
                        fill
                        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                        priority={index < 2}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        unoptimized={isEncrypted}
                      />
                    )
                  })()}
                  {/* 细腻的高光层，让图片更"润" */}
                  <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(900px_circle_at_25%_10%,rgba(255,255,255,0.28),transparent_45%)] opacity-70" />
                </div>

                {/* 信息浮层：tap 模式非激活时直接不渲染 DOM，彻底杜绝"透明但可点到按钮"的问题 */}
                {shouldRenderOverlay && (
                  <div
                    className={[
                      // 明确层级：浮层必须压在图片上
                      'absolute inset-0 z-10 transition-opacity duration-300',
                      interactionMode === 'tap' ? 'opacity-100 pointer-events-auto' : '',
                      // hover 模式：hover / focus 才展示（无 hover 时默认隐藏且不可交互）
                      interactionMode === 'hover'
                        ? 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
                        : '',
                    ].join(' ')}
                    onClick={() => {
                      if (interactionMode === 'tap') setActiveTapId(null)
                    }}
                  >
                    {/* 分层：渐变(z-0) < 底部内容(z-10) < 顶部用户信息(z-20)，避免 prompt 盖住用户信息 */}
                    <div className="absolute inset-0 z-0 bg-gradient-to-t from-gray-950/70 via-gray-950/18 to-transparent" />

                    {/* 顶部信息 */}
                    <div className="pointer-events-none absolute left-3 right-3 top-3 sm:left-5 sm:right-5 sm:top-5 z-20 flex items-start justify-between gap-3">
                      <div className="pointer-events-auto inline-flex max-w-full items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/30 bg-white/70 px-2 py-1.5 sm:px-3.5 sm:py-2.5 backdrop-blur-md shadow-sm">
                        <AvatarWithFrame
                          avatar={avatar}
                          avatarFrameId={
                            work.avatarFrameId === null || work.avatarFrameId === undefined
                              ? null
                              : typeof work.avatarFrameId === 'string'
                                ? Number.parseInt(work.avatarFrameId, 10) || null
                                : work.avatarFrameId
                          }
                          // 移动端缩小至原来的一半左右
                          size={interactionMode === 'hover' ? 40 : 20}
                          className="border border-orange-200/70"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[12px] sm:text-sm font-semibold text-gray-900">{nickname}</div>
                          <div className="mt-0.5 inline-flex max-w-full items-center gap-1">
                            <span className="truncate text-[11px] sm:text-xs text-gray-600">{model}</span>
                          </div>
                        </div>
                      </div>

                      {/* 举报按钮 - 只对优质用户/管理员显示，且只在图片上显示，不在默认图片上显示 */}
                      {userPermissions &&
                       (userPermissions.isPremium || userPermissions.isAdmin) &&
                       !work.video &&
                       !String(work.id).startsWith('default-') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleReport(String(work.id))
                          }}
                          className="pointer-events-auto p-2 rounded-lg bg-red-500/80 hover:bg-red-500 text-white transition-colors shadow-sm"
                          title="举报不当内容"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* 底部文案与按钮 */}
                    <div
                      className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 p-3 sm:p-6"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[13px] sm:text-[15px] leading-relaxed text-white/90 line-clamp-2 sm:line-clamp-4 drop-shadow-[0_1px_12px_rgba(0,0,0,0.35)]">
                        {work.prompt}
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          // 传递图片URL以便自动上传
                          const imageUrl = work.video ? work.image : getDisplayUrl(work.image)
                          onGenerateSame(work.prompt, model, imageUrl)
                        }}
                        className="mt-2.5 sm:mt-5 w-full rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 px-2.5 py-1.5 sm:px-4 sm:py-3 text-[11px] sm:text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-400 hover:to-amber-400 active:scale-[0.99]"
                      >
                        {generateSameText}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 举报弹窗 */}
      <ReportDialog
        isOpen={reportDialogOpen}
        onClose={handleReportDialogClose}
        imageId={reportingImageId}
      />
    </>
  )
}


