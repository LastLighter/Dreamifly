'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import Image from 'next/image'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'
import AvatarWithFrame from '@/components/AvatarWithFrame'
import { getThumbnailUrl } from '@/utils/oss'
import { isEncryptedImage, getImageDisplayUrl, getVideoDisplayUrl } from '@/utils/imageDisplay'
import { filterProfanity } from '@/utils/profanityFilter'

type TabType = 'approved' | 'rejected' | 'profanity'
type RoleFilter = 'all' | 'subscribed' | 'premium' | 'oldUser' | 'regular'

interface ImageItem {
  id: string
  imageUrl: string
  mediaType?: string | null // 'image' | 'video'
  prompt: string | null
  model: string | null
  width: number | null
  height: number | null
  duration?: number | null
  fps?: number | null
  frameCount?: number | null
  userRole: string
  userAvatar: string
  userNickname: string
  avatarFrameId: number | null
  referenceImages?: string[] // 参考图URL数组
  createdAt: string
  userId: string
  rejectionReason?: string
  ipAddress?: string
}

export default function GodEyePage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('approved')
  
  // 图片列表相关状态
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [zoomedImage, setZoomedImage] = useState<string | null>(null)
  const [zoomedMediaType, setZoomedMediaType] = useState<'image' | 'video' | null>(null)
  const [clickedPromptId, setClickedPromptId] = useState<string | null>(null)
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null)
  const promptPopoverRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  
  // 参考图预览相关状态
  const [decodedReferenceImages, setDecodedReferenceImages] = useState<{ [key: string]: string }>({})
  const [decodingReferenceImages, setDecodingReferenceImages] = useState<Set<string>>(new Set())
  const [viewedReferenceImages, setViewedReferenceImages] = useState<Set<string>>(new Set()) // 已查看过的参考图
  
  // 未通过审核图片相关状态
  const [rejectedImages, setRejectedImages] = useState<ImageItem[]>([])
  const [rejectedLoading, setRejectedLoading] = useState(false)
  const [rejectedPage, setRejectedPage] = useState(1)
  const [rejectedTotal, setRejectedTotal] = useState(0)
  const [rejectedTotalPages, setRejectedTotalPages] = useState(0)
  const [rejectedRoleFilter, setRejectedRoleFilter] = useState<RoleFilter>('all')
  const [rejectedSearchInput, setRejectedSearchInput] = useState('')
  const [rejectedSearchTerm, setRejectedSearchTerm] = useState('')
  const [rejectedStartDate, setRejectedStartDate] = useState('')
  const [rejectedEndDate, setRejectedEndDate] = useState('')
  const [reasonFilter, setReasonFilter] = useState<'all' | 'image' | 'prompt' | 'both'>('all')
  const [modelFilter, setModelFilter] = useState<string>('all')
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false) // 高级搜索折叠状态
  const [unmaskedImages, setUnmaskedImages] = useState<Set<string>>(new Set()) // 已移除遮罩的图片ID集合
  const [showMask, setShowMask] = useState(true) // 是否显示遮罩（默认显示，仅前端控制）
  const [decodedImages, setDecodedImages] = useState<{ [key: string]: string }>({}) // 未通过审核图片的解码缓存
  const [decodedApprovedImages, setDecodedApprovedImages] = useState<{ [key: string]: string }>({}) // 通过审核图片的解码缓存
  const [decodingApprovedImages, setDecodingApprovedImages] = useState<Set<string>>(new Set()) // 正在解码的通过审核图片

  // 违禁词管理相关状态
  interface ProfanityWord {
    id: number
    word: string
    isEnabled: boolean
    createdAt: string | Date
    updatedAt: string | Date
  }

  const [profanityWords, setProfanityWords] = useState<ProfanityWord[]>([])
  const [profanityLoading, setProfanityLoading] = useState(false)
  const [profanityError, setProfanityError] = useState('')
  const [profanitySuccess, setProfanitySuccess] = useState('')
  const [showProfanityModal, setShowProfanityModal] = useState(false)
  const [editingProfanity, setEditingProfanity] = useState<ProfanityWord | null>(null)
  const [formProfanityWord, setFormProfanityWord] = useState('')
  const [formProfanityEnabled, setFormProfanityEnabled] = useState(true)
  const [savingProfanity, setSavingProfanity] = useState(false)
  const [testPrompt, setTestPrompt] = useState('') // 测试提示词
  const [testResult, setTestResult] = useState('') // 测试结果

  // 隐藏父级 layout 的 Navbar 和 Footer
  useEffect(() => {
    const navbar = document.getElementById('main-nav')
    const footer = document.querySelector('footer')
    const mobileNavbar = document.querySelector('nav')

    if (navbar) navbar.style.display = 'none'
    if (footer) footer.style.display = 'none'
    if (mobileNavbar && mobileNavbar.id !== 'main-nav') {
      const parent = mobileNavbar.closest('.lg\\:hidden') as HTMLElement | null
      if (parent) parent.style.display = 'none'
    }

    return () => {
      if (navbar) navbar.style.display = ''
      if (footer) footer.style.display = ''
      if (mobileNavbar && mobileNavbar.id !== 'main-nav') {
        const parent = mobileNavbar.closest('.lg\\:hidden') as HTMLElement | null
        if (parent) parent.style.display = ''
      }
    }
  }, [])

  // 检查管理员权限
  useEffect(() => {
    const checkAdmin = async () => {
      if (sessionLoading) return

      if (!session?.user) {
        router.push(transferUrl('/', locale))
        return
      }

      try {
        const token = await generateDynamicTokenWithServerTime()
        
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            router.push(transferUrl('/', locale))
            return
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        if (!data.isAdmin) {
          router.push(transferUrl('/', locale))
          return
        }
        setIsAdmin(true)
      } catch (error) {
        console.error('Failed to check admin status:', error)
        router.push(transferUrl('/', locale))
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdmin()
  }, [session, sessionLoading, router, locale])

  // 获取当前用户完整信息
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user) return

      try {
        const response = await fetch(`/api/admin/users?t=${Date.now()}`)
        if (response.ok) {
          const data = await response.json()
          const currentUser = data.users?.find((u: any) => u.id === session.user.id)
          if (currentUser?.avatar) {
            setCurrentUserAvatar(currentUser.avatar)
          }
        }
      } catch (error) {
        console.error('Failed to fetch current user avatar:', error)
      }
    }

    fetchCurrentUser()
  }, [session?.user])

  // 获取违禁词列表（仅在切到对应Tab时加载）
  useEffect(() => {
    const fetchProfanityWords = async () => {
      if (!isAdmin || activeTab !== 'profanity') return

      setProfanityLoading(true)
      setProfanityError('')
      try {
        const response = await fetch(`/api/admin/profanity-words?t=${Date.now()}`)
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || '获取违禁词列表失败')
        }
        const data = await response.json()
        setProfanityWords(data.words || [])
      } catch (error) {
        console.error('Error fetching profanity words:', error)
        setProfanityError(error instanceof Error ? error.message : '获取违禁词列表失败')
      } finally {
        setProfanityLoading(false)
      }
    }

    fetchProfanityWords()
  }, [isAdmin, activeTab])

  // 获取通过审核图片列表
  useEffect(() => {
    if (activeTab !== 'approved' || !isAdmin) return

    const fetchImages = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('limit', '20')
        if (roleFilter !== 'all') {
          params.set('role', roleFilter)
        }
        if (searchTerm.trim()) {
          params.set('search', searchTerm.trim())
        }
        if (startDate) {
          params.set('startDate', startDate)
        }
        if (endDate) {
          params.set('endDate', endDate)
        }

        const response = await fetch(`/api/admin/god-eye/images?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch images')
        }
        const data = await response.json()
        setImages(data.images || [])
        setTotal(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 0)
      } catch (error) {
        console.error('Error fetching images:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchImages()
  }, [activeTab, isAdmin, page, roleFilter, searchTerm, startDate, endDate])

  // 获取未通过审核图片列表
  useEffect(() => {
    if (activeTab !== 'rejected' || !isAdmin) return

    const fetchRejectedImages = async () => {
      setRejectedLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(rejectedPage))
        params.set('limit', '20')
        if (rejectedRoleFilter !== 'all') {
          params.set('role', rejectedRoleFilter)
        }
        if (rejectedSearchTerm.trim()) {
          params.set('search', rejectedSearchTerm.trim())
        }
        if (rejectedStartDate) {
          // datetime-local 输入返回的是本地时间格式（YYYY-MM-DDTHH:mm）
          // 将其转换为 UTC 时间字符串（ISO 格式）
          // new Date() 会将字符串解释为本地时间，然后 toISOString() 会转换为 UTC
          const localDate = new Date(rejectedStartDate)
          params.set('startTime', localDate.toISOString())
        }
        if (rejectedEndDate) {
          // datetime-local 输入返回的是本地时间格式（YYYY-MM-DDTHH:mm）
          // 将其转换为 UTC 时间字符串（ISO 格式）
          const localDate = new Date(rejectedEndDate)
          params.set('endTime', localDate.toISOString())
        }
        if (reasonFilter !== 'all') {
          params.set('reason', reasonFilter)
        }
        if (modelFilter !== 'all') {
          params.set('model', modelFilter)
        }

        const response = await fetch(`/api/admin/god-eye/rejected-images?${params.toString()}`)
        if (!response.ok) {
          throw new Error('Failed to fetch rejected images')
        }
        const data = await response.json()
        setRejectedImages(data.images || [])
        setRejectedTotal(data.pagination?.total || 0)
        setRejectedTotalPages(data.pagination?.totalPages || 0)
      } catch (error) {
        console.error('Error fetching rejected images:', error)
      } finally {
        setRejectedLoading(false)
      }
    }

    fetchRejectedImages()
  }, [activeTab, isAdmin, rejectedPage, rejectedRoleFilter, rejectedSearchTerm, rejectedStartDate, rejectedEndDate, reasonFilter, modelFilter])

  // 当遮罩关闭时，自动将新加载的图片添加到unmaskedImages
  useEffect(() => {
    if (activeTab !== 'rejected' || !isAdmin || showMask || rejectedImages.length === 0) return
    
    // 如果遮罩已关闭，将当前页面的所有图片ID添加到unmaskedImages
    setUnmaskedImages(prev => {
      const newSet = new Set(prev)
      rejectedImages.forEach(img => {
        newSet.add(img.id)
      })
      return newSet
    })
  }, [activeTab, isAdmin, rejectedImages, showMask])

  // 获取可用模型列表
  useEffect(() => {
    if (activeTab !== 'rejected' || !isAdmin) return

    const fetchModels = async () => {
      try {
        const response = await fetch('/api/admin/god-eye/rejected-images/models')
        if (!response.ok) {
          throw new Error('Failed to fetch models')
        }
        const data = await response.json()
        setAvailableModels(data.models || [])
      } catch (error) {
        console.error('Error fetching models:', error)
      }
    }

    fetchModels()
  }, [activeTab, isAdmin])

  // 切换tab时重置页码
  useEffect(() => {
    setPage(1)
    setRejectedPage(1)
  }, [activeTab])

  // 违禁词：打开新增弹窗
  const handleOpenAddProfanityModal = () => {
    setEditingProfanity(null)
    setFormProfanityWord('')
    setFormProfanityEnabled(true)
    setShowProfanityModal(true)
    setProfanityError('')
    setProfanitySuccess('')
  }

  // 违禁词：打开编辑弹窗
  const handleOpenEditProfanityModal = (item: ProfanityWord) => {
    setEditingProfanity(item)
    setFormProfanityWord(item.word)
    setFormProfanityEnabled(item.isEnabled)
    setShowProfanityModal(true)
    setProfanityError('')
    setProfanitySuccess('')
  }

  // 违禁词：关闭弹窗
  const handleCloseProfanityModal = () => {
    setShowProfanityModal(false)
    setEditingProfanity(null)
    setFormProfanityWord('')
    setFormProfanityEnabled(true)
    setProfanityError('')
    setProfanitySuccess('')
  }

  // 违禁词：保存
  const handleSaveProfanity = async () => {
    if (!formProfanityWord.trim()) {
      setProfanityError('请输入违禁词内容')
      return
    }

    setSavingProfanity(true)
    setProfanityError('')
    setProfanitySuccess('')

    try {
      const url = '/api/admin/profanity-words'
      const method = editingProfanity ? 'PATCH' : 'POST'
      const body = editingProfanity
        ? { id: editingProfanity.id, word: formProfanityWord.trim(), isEnabled: formProfanityEnabled }
        : { word: formProfanityWord.trim(), isEnabled: formProfanityEnabled }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '保存失败')
      }

      setProfanitySuccess(editingProfanity ? '更新成功' : '添加成功')
      setTimeout(async () => {
        handleCloseProfanityModal()
        try {
          const listRes = await fetch(`/api/admin/profanity-words?t=${Date.now()}`)
          const listData = await listRes.json()
          if (listRes.ok) {
            setProfanityWords(listData.words || [])
          }
        } catch (e) {
          console.error('刷新违禁词列表失败:', e)
        }
      }, 1000)
    } catch (error) {
      console.error('Error saving profanity word:', error)
      setProfanityError(error instanceof Error ? error.message : '保存失败')
    } finally {
      setSavingProfanity(false)
    }
  }

  // 违禁词：切换启用状态
  const handleToggleProfanityEnabled = async (item: ProfanityWord) => {
    try {
      const response = await fetch('/api/admin/profanity-words', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: item.id,
          isEnabled: !item.isEnabled,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '更新失败')
      }

      setProfanitySuccess('更新成功')
      setTimeout(async () => {
        setProfanitySuccess('')
        try {
          const listRes = await fetch(`/api/admin/profanity-words?t=${Date.now()}`)
          const listData = await listRes.json()
          if (listRes.ok) {
            setProfanityWords(listData.words || [])
          }
        } catch (e) {
          console.error('刷新违禁词列表失败:', e)
        }
      }, 2000)
    } catch (error) {
      console.error('Error toggling profanity enabled:', error)
      setProfanityError(error instanceof Error ? error.message : '更新失败')
      setTimeout(() => setProfanityError(''), 3000)
    }
  }

  // 违禁词：删除
  const handleDeleteProfanity = async (item: ProfanityWord) => {
    if (!confirm(`确定要删除违禁词 "${item.word}" 吗？`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/profanity-words?id=${item.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '删除失败')
      }

      setProfanitySuccess('删除成功')
      setTimeout(async () => {
        setProfanitySuccess('')
        try {
          const listRes = await fetch(`/api/admin/profanity-words?t=${Date.now()}`)
          const listData = await listRes.json()
          if (listRes.ok) {
            setProfanityWords(listData.words || [])
          }
        } catch (e) {
          console.error('刷新违禁词列表失败:', e)
        }
      }, 2000)
    } catch (error) {
      console.error('Error deleting profanity word:', error)
      setProfanityError(error instanceof Error ? error.message : '删除失败')
      setTimeout(() => setProfanityError(''), 3000)
    }
  }

  // 当测试提示词或违禁词列表变化时，自动更新测试结果
  useEffect(() => {
    if (!testPrompt.trim()) {
      setTestResult('')
      return
    }

    // 获取已启用的违禁词列表
    const enabledWords = profanityWords
      .filter(w => w.isEnabled)
      .map(w => w.word)
      .filter(w => w && w.trim().length > 0)

    // 使用与实际场景相同的替换逻辑
    const filtered = filterProfanity(testPrompt, enabledWords)
    setTestResult(filtered)
  }, [testPrompt, profanityWords])

  // 处理未通过审核图片搜索
  const handleRejectedSearch = () => {
    setRejectedSearchTerm(rejectedSearchInput)
    setRejectedPage(1)
  }

  // 解码未通过审核的图片（使用统一的解密函数）
  const decodeRejectedImage = async (imageId: string, imageUrl: string) => {
    try {
      const decodedUrl = await getImageDisplayUrl(imageUrl, decodedImages)
      setDecodedImages((prev) => {
        if (prev[imageId]) return prev
        return { ...prev, [imageId]: decodedUrl }
      })
    } catch (error) {
      console.error('前端解码未通过图片失败:', error)
    }
  }

  // 列表加载后即解码（遮罩不阻塞解码）
  useEffect(() => {
    if (activeTab !== 'rejected' || !isAdmin) return
    if (!rejectedImages.length) return

    const pendingImages = rejectedImages.filter(
      (img) => img.imageUrl && !decodedImages[img.id]
    )
    if (pendingImages.length === 0) return

    let cancelled = false
    const concurrency = 4
    const queue = [...pendingImages]

    const runWorker = async () => {
      while (queue.length && !cancelled) {
        const next = queue.shift()
        if (next) {
          await decodeRejectedImage(next.id, next.imageUrl)
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, runWorker)
    Promise.all(workers).catch((err) => {
      console.error('批量解码未通过图片失败:', err)
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, isAdmin, rejectedImages, decodedImages])

  // 获取拒绝原因标签
  const getRejectionReasonLabel = (reason: string) => {
    switch (reason) {
      case 'image':
        return '图片审核未通过'
      case 'prompt':
        return '提示词审核未通过'
      case 'both':
        return '图片和提示词均未通过'
      default:
        return '审核未通过'
    }
  }

  // 获取拒绝原因样式
  const getRejectionReasonStyle = (reason: string) => {
    switch (reason) {
      case 'image':
        return 'bg-red-100 text-red-800'
      case 'prompt':
        return 'bg-yellow-100 text-yellow-800'
      case 'both':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 处理搜索
  const handleSearch = () => {
    setSearchTerm(searchInput)
    setPage(1)
  }

  // 解码通过审核的图片（批量处理）
  useEffect(() => {
    if (activeTab !== 'approved' || !isAdmin) return
    if (!images.length) return

    const encryptedImages = images.filter(
      img => isEncryptedImage(img.imageUrl) && !decodedApprovedImages[img.imageUrl] && !decodingApprovedImages.has(img.imageUrl)
    )

    if (encryptedImages.length === 0) return

    let cancelled = false
    const concurrency = 4
    const queue = [...encryptedImages]

    const runWorker = async () => {
      while (queue.length && !cancelled) {
        const image = queue.shift()
        if (!image) continue

        setDecodingApprovedImages(prev => new Set(prev).add(image.imageUrl))

        try {
          // 根据媒体类型选择解码函数
          const decodedUrl = image.mediaType === 'video'
            ? await getVideoDisplayUrl(image.imageUrl, decodedApprovedImages)
            : await getImageDisplayUrl(image.imageUrl, decodedApprovedImages)
          
          if (!cancelled) {
            setDecodedApprovedImages(prev => ({
              ...prev,
              [image.imageUrl]: decodedUrl
            }))
          }
        } catch (error) {
          console.error('解码媒体失败:', error)
        } finally {
          setDecodingApprovedImages(prev => {
            const newSet = new Set(prev)
            newSet.delete(image.imageUrl)
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
  }, [activeTab, isAdmin, images, decodedApprovedImages, decodingApprovedImages])

  // 处理参考图点击预览
  const handleReferenceImageClick = async (refUrl: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // 标记为已查看
    setViewedReferenceImages(prev => new Set(prev).add(refUrl))
    
    // 参考图都是图片类型
    setZoomedMediaType('image')
    
    // 如果是加密图片，确保已解码
    if (isEncryptedImage(refUrl)) {
      if (!decodedReferenceImages[refUrl]) {
        if (!decodingReferenceImages.has(refUrl)) {
          setDecodingReferenceImages(prev => new Set(prev).add(refUrl))
          try {
            const decodedUrl = await getImageDisplayUrl(refUrl, decodedReferenceImages)
            setDecodedReferenceImages(prev => ({ ...prev, [refUrl]: decodedUrl }))
            setZoomedImage(decodedUrl)
          } catch (error) {
            console.error('解码参考图失败:', error)
            setZoomedImage(refUrl)
          } finally {
            setDecodingReferenceImages(prev => {
              const newSet = new Set(prev)
              newSet.delete(refUrl)
              return newSet
            })
          }
        }
      } else {
        setZoomedImage(decodedReferenceImages[refUrl])
      }
    } else {
      setZoomedImage(refUrl)
    }
  }

  // 处理图片/视频点击预览
  const handleImageClick = async (imageUrl: string, e: React.MouseEvent, mediaType?: 'image' | 'video') => {
    e.stopPropagation()
    
    // 如果是加密媒体，确保已解码
    if (isEncryptedImage(imageUrl)) {
      if (activeTab === 'approved') {
        if (!decodedApprovedImages[imageUrl]) {
          try {
            const decodedUrl = mediaType === 'video'
              ? await getVideoDisplayUrl(imageUrl, decodedApprovedImages)
              : await getImageDisplayUrl(imageUrl, decodedApprovedImages)
            setDecodedApprovedImages(prev => ({ ...prev, [imageUrl]: decodedUrl }))
            setZoomedImage(decodedUrl)
            setZoomedMediaType(mediaType || 'image')
          } catch (error) {
            console.error('解码媒体失败:', error)
            setZoomedImage(imageUrl)
            setZoomedMediaType(mediaType || 'image')
          }
        } else {
          setZoomedImage(decodedApprovedImages[imageUrl])
          setZoomedMediaType(mediaType || 'image')
        }
      } else {
        // 未通过审核的媒体：传入的 imageUrl 已经是解码后的 URL（从 decodedImages[image.id]）
        // 如果是加密的原始 URL，需要查找对应的 image.id 并解码
        const image = rejectedImages.find(img => img.imageUrl === imageUrl)
        if (image && decodedImages[image.id]) {
          // 传入的是解码后的 URL，直接使用
          setZoomedImage(decodedImages[image.id])
          setZoomedMediaType((image.mediaType as 'image' | 'video') || 'image')
        } else if (image) {
          // 传入的是原始加密 URL，需要解码
          try {
            const decodedUrl = (image.mediaType === 'video')
              ? await getVideoDisplayUrl(imageUrl, {})
              : await getImageDisplayUrl(imageUrl, {})
            setDecodedImages(prev => ({ ...prev, [image.id]: decodedUrl }))
            setZoomedImage(decodedUrl)
            setZoomedMediaType((image.mediaType as 'image' | 'video') || 'image')
          } catch (error) {
            console.error('解码媒体失败:', error)
            setZoomedImage(imageUrl)
            setZoomedMediaType((image.mediaType as 'image' | 'video') || 'image')
          }
        } else {
          // 直接使用传入的 URL（可能是已解码的）
          setZoomedImage(imageUrl)
          setZoomedMediaType(mediaType || 'image')
        }
      }
    } else {
      setZoomedImage(imageUrl)
      setZoomedMediaType(mediaType || 'image')
    }
  }

  // 处理复制提示词
  const handleCopyPrompt = async (prompt: string, imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedPromptId(imageId)
      setTimeout(() => {
        setCopiedPromptId(null)
      }, 2000)
    } catch (error) {
      console.error('复制失败:', error)
    }
  }

  // 处理点击提示词（无论是否截断都可打开）
  const handlePromptClick = (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setClickedPromptId((prev) => (prev === imageId ? null : imageId))
  }

  // 点击外部关闭Popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clickedPromptId) {
        const popoverElement = promptPopoverRefs.current[clickedPromptId]
        const promptElement = (event.target as HTMLElement).closest('.prompt-container')
        
        // 如果点击的不是Popover或提示词容器，则关闭
        if (popoverElement && !popoverElement.contains(event.target as Node) && 
            !promptElement) {
          setClickedPromptId(null)
        }
      }
    }

    if (clickedPromptId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [clickedPromptId])

  // 获取角色标签样式
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
      case 'subscribed':
        return 'bg-green-100 text-green-800'
      case 'premium':
        return 'bg-purple-100 text-purple-800'
      case 'oldUser':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  // 获取角色标签文本
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return '管理员'
      case 'subscribed':
        return '付费用户'
      case 'premium':
        return '优质用户'
      case 'oldUser':
        return '首批用户'
      default:
        return '普通用户'
    }
  }

  if (sessionLoading || checkingAdmin || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  const avatarSrc =
    currentUserAvatar ||
    globalAvatar ||
    (session?.user as ExtendedUser)?.avatar ||
    session?.user?.image ||
    '/images/default-avatar.svg'
  const normalizedAvatarSrc =
    avatarSrc.startsWith('http') || avatarSrc.startsWith('/') ? avatarSrc : `/${avatarSrc}`

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="lg:pl-64 pt-16 lg:pt-0">
        <header className="bg-gradient-to-r from-white to-gray-50 border-b border-orange-200/50 shadow-sm sticky top-0 z-30 lg:static">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-orange-400/10 to-amber-400/10 rounded-lg">
                  <svg
                    className="w-5 h-5 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    上帝之眼
                  </h1>
                  <p className="text-xs text-gray-500 -mt-0.5">图片审核管理</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/80 rounded-lg border border-orange-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                <Image
                  src={normalizedAvatarSrc}
                  alt="Avatar"
                  width={36}
                  height={36}
                  className="rounded-full border-2 border-orange-400/40 shadow-sm object-cover"
                  unoptimized={normalizedAvatarSrc.startsWith('http')}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    if (!target.src.includes('default-avatar.svg')) {
                      target.src = '/images/default-avatar.svg'
                    }
                  }}
                />
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium text-gray-900 leading-tight">
                    {session?.user?.name || session?.user?.email}
                  </span>
                  <span className="text-xs text-orange-600 font-medium">管理员</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tab 切换 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex gap-2 border-b border-gray-200 pb-1 overflow-x-auto">
                {[
                  { id: 'approved', label: '通过审核图片' },
                  { id: 'rejected', label: '未通过审核图片' },
                  { id: 'profanity', label: '违禁词管理' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-orange-500 text-orange-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容区域 */}
            {activeTab === 'approved' ? (
              <div className="space-y-4">
                {/* 筛选区域 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    {/* 用户角色筛选 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 whitespace-nowrap">用户角色：</span>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm min-w-[120px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={roleFilter}
                        onChange={(e) => {
                          setRoleFilter(e.target.value as RoleFilter)
                          setPage(1)
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="subscribed">付费用户</option>
                        <option value="premium">优质用户</option>
                        <option value="oldUser">首批用户</option>
                        <option value="regular">普通用户</option>
                      </select>
                    </div>

                    {/* 搜索 */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <input
                        type="text"
                        placeholder="搜索用户昵称"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearch()
                          }
                        }}
                      />
                      <button
                        onClick={handleSearch}
                        className="px-4 py-1.5 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                      >
                        搜索
                      </button>
                    </div>

                    {/* 日期范围 */}
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value)
                          setPage(1)
                        }}
                      />
                      <span className="text-sm text-gray-500">至</span>
                      <input
                        type="date"
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={endDate}
                        onChange={(e) => {
                          setEndDate(e.target.value)
                          setPage(1)
                        }}
                      />
                      {(startDate || endDate) && (
                        <button
                          onClick={() => {
                            setStartDate('')
                            setEndDate('')
                            setPage(1)
                          }}
                          className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                        >
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 统计信息 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      共找到 <span className="font-semibold text-orange-600">{total}</span> 张图片
                    </span>
                    <span className="text-xs text-gray-500">
                      第 {page} 页 / 共 {totalPages} 页
                    </span>
                  </div>
                </div>

                {/* 图片列表 */}
                {loading ? (
                  <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">加载中...</p>
                  </div>
                ) : images.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <svg
                      className="w-16 h-16 text-gray-400 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-600">暂无图片</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {images.map((image) => {
                        const mediaType = image.mediaType || 'image'
                        const isVideo = mediaType === 'video'
                        const isDecoding = isEncryptedImage(image.imageUrl) && !decodedApprovedImages[image.imageUrl]
                        const thumbnailUrl = isEncryptedImage(image.imageUrl) 
                          ? (decodedApprovedImages[image.imageUrl] || image.imageUrl)
                          : (isVideo ? image.imageUrl : getThumbnailUrl(image.imageUrl, 400, 400, 75))

                        return (
                          <div
                            key={image.id}
                            className="group relative rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-lg transition-all"
                          >
                            <div className="aspect-square relative overflow-hidden bg-gray-100">
                              {isDecoding && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                                </div>
                              )}
                              
                              {/* 参考图预览入口 - 左上角 */}
                              {image.referenceImages && image.referenceImages.length > 0 && (
                                <div className="absolute top-2 left-2 flex gap-1.5 z-20">
                                  {image.referenceImages.map((refUrl, index) => {
                                    const isViewed = viewedReferenceImages.has(refUrl)
                                    const isRefDecoding = isEncryptedImage(refUrl) && !decodedReferenceImages[refUrl] && decodingReferenceImages.has(refUrl)
                                    const refDisplayUrl = isEncryptedImage(refUrl) 
                                      ? (decodedReferenceImages[refUrl] || refUrl)
                                      : refUrl
                                    
                                    return (
                                      <button
                                        key={index}
                                        onClick={(e) => handleReferenceImageClick(refUrl, e)}
                                        className={`relative w-10 h-10 rounded-lg overflow-hidden bg-white/20 backdrop-blur-md border border-white/30 shadow-lg hover:bg-white/30 transition-all hover:scale-110 ${
                                          isViewed ? '' : 'flex items-center justify-center'
                                        }`}
                                        title={`参考图 ${index + 1}`}
                                      >
                                        {isViewed ? (
                                          // 已查看过：显示实际图片
                                          <>
                                            {isRefDecoding ? (
                                              <div className="absolute inset-0 flex items-center justify-center bg-white/20">
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                              </div>
                                            ) : (
                                              <Image
                                                src={refDisplayUrl}
                                                alt={`参考图 ${index + 1}`}
                                                fill
                                                className="object-cover"
                                                unoptimized={isEncryptedImage(refUrl)}
                                                onError={(e) => {
                                                  const target = e.target as HTMLImageElement
                                                  target.style.display = 'none'
                                                }}
                                              />
                                            )}
                                          </>
                                        ) : (
                                          // 未查看：显示图标
                                          <svg
                                            className="w-5 h-5 text-white"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                            />
                                          </svg>
                                        )}
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                              
                              {isVideo ? (
                                <video
                                  src={thumbnailUrl}
                                  className="w-full h-full object-cover cursor-pointer"
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleImageClick(image.imageUrl, e, 'video')
                                  }}
                                />
                              ) : (
                                <Image
                                  src={thumbnailUrl}
                                  alt={image.prompt || '生成的图片'}
                                  fill
                                  className="object-cover cursor-zoom-in"
                                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                                  onClick={(e) => handleImageClick(image.imageUrl, e, 'image')}
                                  unoptimized={isEncryptedImage(image.imageUrl) || image.imageUrl.startsWith('http')}
                                />
                              )}

                            {/* 用户信息覆盖层 */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <AvatarWithFrame
                                  avatar={image.userAvatar}
                                  avatarFrameId={image.avatarFrameId}
                                  size={24}
                                  className="border border-white/30"
                                />
                                <span className="text-white text-xs font-medium truncate flex-1">
                                  {image.userNickname}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeStyle(
                                    image.userRole
                                  )}`}
                                >
                                  {getRoleLabel(image.userRole)}
                                </span>
                              </div>
                              {image.prompt && (
                                <div 
                                  className="relative group/prompt prompt-container"
                                  onClick={(e) => handlePromptClick(image.id, e)}
                                >
                                  <p className="text-white text-xs line-clamp-2 cursor-pointer hover:text-orange-300 transition-colors">
                                    {image.prompt}
                                  </p>
                                  
                                  {/* 点击弹出的提示框 */}
                                  {clickedPromptId === image.id && (
                                    <div
                                      ref={(el) => {
                                        promptPopoverRefs.current[image.id] = el
                                      }}
                                      className="absolute bottom-full left-0 mb-2 p-3 bg-black/95 backdrop-blur-md text-white text-xs rounded-lg shadow-2xl z-30 max-w-sm max-h-48 overflow-y-auto animate-fadeIn"
                                      style={{
                                        minWidth: '200px',
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className="font-semibold text-sm">完整提示词</span>
                                        <button
                                          onClick={(e) => handleCopyPrompt(image.prompt!, image.id, e)}
                                          className="p-1 hover:bg-white/20 rounded transition-colors"
                                          title="复制提示词"
                                        >
                                          {copiedPromptId === image.id ? (
                                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                          )}
                                        </button>
                                      </div>
                                      <p className="text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                                        {image.prompt}
                                      </p>
                                      {copiedPromptId === image.id && (
                                        <div className="mt-2 text-green-400 text-xs flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          已复制到剪贴板
                                        </div>
                                      )}
                                      {/* 箭头 */}
                                      <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/95"></div>
                                    </div>
                                  )}
                                </div>
                              )}
                              {(image.width && image.height) || image.model ? (
                                <div className="flex gap-2 mt-2">
                                  {image.width && image.height && (
                                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs rounded border border-white/30">
                                      {image.width} × {image.height}
                                    </span>
                                  )}
                                  {image.model && (
                                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs rounded border border-white/30">
                                      {image.model}
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        )
                      })}
                    </div>

                    {/* 分页 */}
                    {totalPages > 1 && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <button
                            disabled={page <= 1 || loading}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                              page <= 1 || loading
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            上一页
                          </button>
                          <span className="text-sm text-gray-600">
                            第 {page} 页 / 共 {totalPages} 页
                          </span>
                          <button
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                              page >= totalPages || loading
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : activeTab === 'rejected' ? (
              <div className="space-y-3">
                {/* 控制栏 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                  <div className="flex flex-wrap gap-3 items-center">
                    {/* 遮罩选项 */}
                    <div className="flex items-center gap-2 h-[38px]">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showMask}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setShowMask(checked)
                            if (!checked) {
                              // 取消遮罩：将所有图片ID添加到unmaskedImages
                              setUnmaskedImages(new Set(rejectedImages.map(img => img.id)))
                            } else {
                              // 显示遮罩：清空unmaskedImages
                              setUnmaskedImages(new Set())
                            }
                          }}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700 whitespace-nowrap">遮罩</span>
                      </label>
                    </div>

                    {/* 搜索 */}
                    <div className="flex items-center gap-2 flex-1 min-w-[200px] h-[38px]">
                      <input
                        type="text"
                        placeholder="搜索用户名、昵称或邮箱"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={rejectedSearchInput}
                        onChange={(e) => setRejectedSearchInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRejectedSearch()
                          }
                        }}
                      />
                      <button
                        onClick={handleRejectedSearch}
                        className="px-4 py-1.5 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                      >
                        搜索
                      </button>
                    </div>

                    {/* 高级搜索按钮 */}
                    <button
                      onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                      className="px-4 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <span>高级搜索</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* 高级搜索区域（折叠） */}
                  {showAdvancedSearch && (
                    <div className="mt-2.5 pt-2.5 border-t border-gray-200">
                      <div className="space-y-2.5">
                        {/* 第一行：三个筛选条件 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {/* 用户角色筛选 */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-fit">用户角色</label>
                            <select
                              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-full"
                              value={rejectedRoleFilter}
                              onChange={(e) => {
                                setRejectedRoleFilter(e.target.value as RoleFilter)
                                setRejectedPage(1)
                              }}
                            >
                              <option value="all">全部</option>
                              <option value="subscribed">付费用户</option>
                              <option value="premium">优质用户</option>
                              <option value="oldUser">首批用户</option>
                              <option value="regular">普通用户</option>
                            </select>
                          </div>

                          {/* 拒绝原因筛选 */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-fit">拒绝原因</label>
                            <select
                              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-full"
                              value={reasonFilter}
                              onChange={(e) => {
                                setReasonFilter(e.target.value as 'all' | 'image' | 'prompt' | 'both')
                                setRejectedPage(1)
                              }}
                            >
                              <option value="all">全部</option>
                              <option value="image">图片审核未通过</option>
                              <option value="prompt">提示词审核未通过</option>
                              <option value="both">两者都未通过</option>
                            </select>
                          </div>

                          {/* 所用模型筛选 */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-sm text-gray-700 whitespace-nowrap w-fit">所用模型</label>
                            <select
                              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-full"
                              value={modelFilter}
                              onChange={(e) => {
                                setModelFilter(e.target.value)
                                setRejectedPage(1)
                              }}
                            >
                              <option value="all">全部</option>
                              {availableModels.map((model) => (
                                <option key={model} value={model}>
                                  {model}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* 第二行：时间范围 */}
                        <div className="flex flex-col gap-1.5">
                          <label className="text-sm text-gray-700">时间范围</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                              value={rejectedStartDate}
                              onChange={(e) => {
                                setRejectedStartDate(e.target.value)
                                setRejectedPage(1)
                              }}
                            />
                            <span className="text-sm text-gray-500">至</span>
                            <input
                              type="datetime-local"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                              value={rejectedEndDate}
                              onChange={(e) => {
                                setRejectedEndDate(e.target.value)
                                setRejectedPage(1)
                              }}
                            />
                            {(rejectedStartDate || rejectedEndDate) && (
                              <button
                                onClick={() => {
                                  setRejectedStartDate('')
                                  setRejectedEndDate('')
                                  setRejectedPage(1)
                                }}
                                className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors whitespace-nowrap"
                                title="清除时间"
                              >
                                清除
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 统计信息 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      共找到 <span className="font-semibold text-orange-600">{rejectedTotal}</span> 张未通过审核的图片
                    </span>
                    <span className="text-xs text-gray-500">
                      第 {rejectedPage} 页 / 共 {rejectedTotalPages} 页
                    </span>
                  </div>
                </div>

                {/* 图片列表 */}
                {rejectedLoading ? (
                  <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600">加载中...</p>
                  </div>
                ) : rejectedImages.length === 0 ? (
                  <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <svg
                      className="w-16 h-16 text-gray-400 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-600">暂无未通过审核的图片</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {rejectedImages.map((image) => {
                        const mediaType = image.mediaType || 'image'
                        const isVideo = mediaType === 'video'
                        
                        return (
                        <div
                          key={image.id}
                          className="group relative rounded-xl overflow-hidden bg-white border border-gray-200 hover:shadow-lg transition-all"
                        >
                          <div className="aspect-square relative overflow-hidden bg-gray-100">
                            {/* 模型标签 - 右上角毛玻璃效果 */}
                            {image.model && (
                              <div className="absolute top-2 right-2 px-2.5 py-1 bg-white/20 backdrop-blur-md rounded-lg border border-white/30 z-30">
                                <span className="text-xs font-medium text-gray-800 whitespace-nowrap">
                                  {image.model}
                                </span>
                              </div>
                            )}
                            
                            {/* 参考图预览入口 - 左上角 */}
                            {image.referenceImages && image.referenceImages.length > 0 && (
                              <div className="absolute top-2 left-2 flex gap-1.5 z-20">
                                {image.referenceImages.map((refUrl, index) => {
                                  const isViewed = viewedReferenceImages.has(refUrl)
                                  const isRefDecoding = isEncryptedImage(refUrl) && !decodedReferenceImages[refUrl] && decodingReferenceImages.has(refUrl)
                                  const refDisplayUrl = isEncryptedImage(refUrl) 
                                    ? (decodedReferenceImages[refUrl] || refUrl)
                                    : refUrl
                                  
                                  return (
                                    <button
                                      key={index}
                                      onClick={(e) => handleReferenceImageClick(refUrl, e)}
                                      className={`relative w-10 h-10 rounded-lg overflow-hidden bg-white/20 backdrop-blur-md border border-white/30 shadow-lg hover:bg-white/30 transition-all hover:scale-110 ${
                                        isViewed ? '' : 'flex items-center justify-center'
                                      }`}
                                      title={`参考图 ${index + 1}`}
                                    >
                                      {isViewed ? (
                                        // 已查看过：显示实际图片
                                        <>
                                          {isRefDecoding ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/20">
                                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            </div>
                                          ) : (
                                            <Image
                                              src={refDisplayUrl}
                                              alt={`参考图 ${index + 1}`}
                                              fill
                                              className="object-cover"
                                              unoptimized={isEncryptedImage(refUrl)}
                                              onError={(e) => {
                                                const target = e.target as HTMLImageElement
                                                target.style.display = 'none'
                                              }}
                                            />
                                          )}
                                        </>
                                      ) : (
                                        // 未查看：显示图标
                                        <svg
                                          className="w-5 h-5 text-white"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                          />
                                        </svg>
                                        )}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                            
                            {/* 图片容器 */}
                            <div className="absolute inset-0">
                              {/* 磨砂玻璃层 - 只遮住图片区域，不遮住底部信息 */}
                              {showMask && !unmaskedImages.has(image.id) && (
                                <div className="absolute top-0 left-0 right-0 bottom-16 bg-white/30 backdrop-blur-md z-[5] flex flex-col items-center justify-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setUnmaskedImages(prev => new Set(prev).add(image.id))
                                    }}
                                    className="px-4 py-2 bg-black/60 backdrop-blur-sm text-white rounded-lg hover:bg-black/80 transition-colors"
                                  >
                                    移除遮罩
                                  </button>
                                  {!decodedImages[image.id] && (
                                    <div className="flex items-center gap-2 text-xs text-gray-800 bg-white/70 px-2 py-1 rounded-md">
                                      <div className="h-3 w-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                      <span>正在解码...</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* 图片/视频 */}
                              {decodedImages[image.id] ? (
                                isVideo ? (
                                  <video
                                    src={decodedImages[image.id]}
                                    className={`w-full h-full object-cover cursor-pointer ${!unmaskedImages.has(image.id) ? 'blur-sm' : ''}`}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    onClick={(e) => {
                                      if (unmaskedImages.has(image.id)) {
                                        handleImageClick(decodedImages[image.id], e, 'video')
                                      }
                                    }}
                                  />
                                ) : (
                                  <Image
                                    src={decodedImages[image.id]}
                                    alt={image.prompt || '未通过审核的图片'}
                                    fill
                                    className={`object-cover cursor-zoom-in ${!unmaskedImages.has(image.id) ? 'blur-sm' : ''}`}
                                    onClick={(e) => {
                                      if (unmaskedImages.has(image.id)) {
                                        handleImageClick(decodedImages[image.id], e, 'image')
                                      }
                                    }}
                                    unoptimized
                                  />
                                )
                              ) : (
                                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto mb-2"></div>
                                    <p className="text-xs text-gray-500">解码中...</p>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 用户信息覆盖层 - 确保在遮罩之上 */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-sm z-20">
                              <div className="flex items-center gap-2 mb-2">
                                <AvatarWithFrame
                                  avatar={image.userAvatar}
                                  avatarFrameId={image.avatarFrameId}
                                  size={24}
                                  className="border border-white/30"
                                />
                                <span className="text-white text-xs font-medium truncate flex-1">
                                  {image.userNickname}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeStyle(
                                    image.userRole
                                  )}`}
                                >
                                  {getRoleLabel(image.userRole)}
                                </span>
                              </div>
                              
                              {/* 拒绝原因标签 */}
                              <div className="mb-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getRejectionReasonStyle(
                                    image.rejectionReason || 'image'
                                  )}`}
                                >
                                  {getRejectionReasonLabel(image.rejectionReason || 'image')}
                                </span>
                              </div>

                              {image.prompt && (
                                <div 
                                  className="relative group/prompt prompt-container"
                                  onClick={(e) => handlePromptClick(image.id, e)}
                                >
                                  <p className="text-white text-xs line-clamp-2 cursor-pointer hover:text-orange-300 transition-colors">
                                    {image.prompt}
                                  </p>
                                  
                                  {/* 点击弹出的提示框 */}
                                  {clickedPromptId === image.id && (
                                    <div
                                      ref={(el) => {
                                        promptPopoverRefs.current[image.id] = el
                                      }}
                                      className="absolute bottom-full left-0 mb-2 p-3 bg-black/95 backdrop-blur-md text-white text-xs rounded-lg shadow-2xl z-30 max-w-sm max-h-48 overflow-y-auto animate-fadeIn"
                                      style={{
                                        minWidth: '200px',
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <span className="font-semibold text-sm">完整提示词</span>
                                        <button
                                          onClick={(e) => handleCopyPrompt(image.prompt!, image.id, e)}
                                          className="p-1 hover:bg-white/20 rounded transition-colors"
                                          title="复制提示词"
                                        >
                                          {copiedPromptId === image.id ? (
                                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                          ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                          )}
                                        </button>
                                      </div>
                                      <p className="text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                                        {image.prompt}
                                      </p>
                                      {copiedPromptId === image.id && (
                                        <div className="mt-2 text-green-400 text-xs flex items-center gap-1">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          已复制到剪贴板
                                        </div>
                                      )}
                                      {/* 箭头 */}
                                      <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/95"></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        )
                      })}
                    </div>

                    {/* 分页 */}
                    {rejectedTotalPages > 1 && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                          <button
                            disabled={rejectedPage <= 1 || rejectedLoading}
                            onClick={() => setRejectedPage((p) => Math.max(1, p - 1))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                              rejectedPage <= 1 || rejectedLoading
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            上一页
                          </button>
                          <span className="text-sm text-gray-600">
                            第 {rejectedPage} 页 / 共 {rejectedTotalPages} 页
                          </span>
                          <button
                            disabled={rejectedPage >= rejectedTotalPages || rejectedLoading}
                            onClick={() => setRejectedPage((p) => Math.min(rejectedTotalPages, p + 1))}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                              rejectedPage >= rejectedTotalPages || rejectedLoading
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            下一页
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              // 违禁词管理
              <div className="space-y-4">
                {/* 操作栏 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      共 {profanityWords.length} 个违禁词，其中{' '}
                      {profanityWords.filter((w) => w.isEnabled).length} 个已启用
                    </div>
                    <button
                      onClick={handleOpenAddProfanityModal}
                      className="px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      添加违禁词
                    </button>
                  </div>
                </div>

                {/* 错误/成功提示 */}
                {profanityError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                    {profanityError}
                  </div>
                )}
                {profanitySuccess && (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
                    {profanitySuccess}
                  </div>
                )}

                {/* 测试区域 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">测试违禁词替换</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="test-prompt" className="block text-sm font-medium text-gray-700 mb-2">
                        输入待测试的提示词
                      </label>
                      <textarea
                        id="test-prompt"
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        placeholder="例如：这是一个测试提示词，包含违禁词"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-none"
                        rows={3}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        输入提示词后，系统会自动使用已启用的违禁词进行替换测试
                      </p>
                    </div>
                    {testResult && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          替换后的结果
                        </label>
                        <div className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 whitespace-pre-wrap break-words min-h-[60px]">
                          {testResult}
                        </div>
                        {testPrompt !== testResult && (
                          <p className="mt-1 text-xs text-orange-600">
                            ✓ 已检测到违禁词并已替换为星号
                          </p>
                        )}
                        {testPrompt === testResult && testPrompt.trim() && (
                          <p className="mt-1 text-xs text-gray-500">
                            ℹ 未检测到违禁词
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 列表 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {profanityLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                      <p className="text-gray-600">加载中...</p>
                    </div>
                  ) : profanityWords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      暂无违禁词，点击「添加违禁词」按钮添加
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              违禁词
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              状态
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              创建时间
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              更新时间
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {profanityWords.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{item.word}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {item.isEnabled ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    已启用
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                    已禁用
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.createdAt ? new Date(item.createdAt).toLocaleString('zh-CN') : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleProfanityEnabled(item)}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                      item.isEnabled
                                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                                    }`}
                                  >
                                    {item.isEnabled ? '禁用' : '启用'}
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditProfanityModal(item)}
                                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                                  >
                                    编辑
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProfanity(item)}
                                    className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors"
                                  >
                                    删除
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 图片/视频预览模态框 */}
            {zoomedImage && (
              <div
                className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4"
                onClick={() => {
                  setZoomedImage(null)
                  setZoomedMediaType(null)
                }}
              >
                <div className="relative max-w-7xl max-h-full">
                  {zoomedMediaType === 'video' ? (
                    <video
                      src={zoomedImage}
                      controls
                      className="max-w-full max-h-[90vh] object-contain rounded-lg"
                      autoPlay
                      loop
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Image
                      src={zoomedImage}
                      alt="预览图片"
                      width={1200}
                      height={1200}
                      className="max-w-full max-h-[90vh] object-contain rounded-lg"
                      unoptimized
                    />
                  )}
                  <button
                    onClick={() => {
                      setZoomedImage(null)
                      setZoomedMediaType(null)
                    }}
                    className="absolute top-4 right-4 p-2 bg-white/20 backdrop-blur-md rounded-lg hover:bg-white/30 transition-colors"
                  >
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* 违禁词添加/编辑模态框 */}
            {showProfanityModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {editingProfanity ? '编辑违禁词' : '添加违禁词'}
                    </h2>
                    <button
                      onClick={handleCloseProfanityModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {profanityError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                      {profanityError}
                    </div>
                  )}
                  {profanitySuccess && (
                    <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                      {profanitySuccess}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="profanity-word" className="block text-sm font-medium text-gray-700 mb-2">
                        违禁词内容
                      </label>
                      <input
                        id="profanity-word"
                        type="text"
                        value={formProfanityWord}
                        onChange={(e) => setFormProfanityWord(e.target.value)}
                        placeholder="例如：敏感词"
                        disabled={savingProfanity}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                      <p className="mt-1 text-xs text-gray-500">支持中英文词语，图生图提示词中会自动替换为星号。</p>
                    </div>
                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formProfanityEnabled}
                          onChange={(e) => setFormProfanityEnabled(e.target.checked)}
                          disabled={savingProfanity}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                        />
                        <span className="text-sm text-gray-700">启用此违禁词</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-6 pt-4 border-top border-gray-200">
                    <button
                      onClick={handleCloseProfanityModal}
                      disabled={savingProfanity}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveProfanity}
                      disabled={savingProfanity}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingProfanity ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>保存中...</span>
                        </>
                      ) : (
                        '保存'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

