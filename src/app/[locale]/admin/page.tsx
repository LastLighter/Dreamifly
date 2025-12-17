'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import AdminSidebar from '@/components/AdminSidebar'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import AvatarWithFrame from '@/components/AvatarWithFrame'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

interface User {
  id: string
  email: string
  name: string | null
  nickname: string | null
  avatar: string
  uid: number | null
  emailVerified: boolean
  isActive: boolean
  isAdmin: boolean
  isPremium: boolean
  isOldUser: boolean
  isSubscribed: boolean
  subscriptionExpiresAt: Date | string | null
  dailyRequestCount: number
  createdAt: Date | string
  updatedAt: Date | string
  lastLoginAt: Date | string | null
  avatarFrameId: number | null
}

interface UserListResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function AdminPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'

  // 获取当前用户完整信息（包括头像）
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user) return
      
      try {
        // 添加时间戳避免缓存
        const response = await fetch(`/api/admin/users?t=${Date.now()}`)
        if (response.ok) {
          const data = await response.json()
          const currentUser = data.users?.find((u: User) => u.id === session.user.id)
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
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('') // 输入框的值
  const [searchTerm, setSearchTerm] = useState('') // 实际用于查询的值
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState('') // 页码输入框的值
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  })
  
  // 排序和筛选状态
  const [sortBy, setSortBy] = useState<'uid' | 'lastLoginAt' | 'dailyRequestCount' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState<string>('') // '', 'true', 'false'
  const [emailTypeFilter, setEmailTypeFilter] = useState<string>('all') // all, gmail, outlook, qq, 163, other
  const [roleFilter, setRoleFilter] = useState<string>('all') // all, admin, subscribed, premium, oldUser, regular
  const [statusFilter, setStatusFilter] = useState<string>('active') // active, banned, all
  const [isAdvancedSearchExpanded, setIsAdvancedSearchExpanded] = useState(false) // 高级搜索折叠状态，默认折叠

  // 用户限额配置状态（仅用于显示）
  const [limitConfig, setLimitConfig] = useState({
    regularUserDailyLimit: 100,
    premiumUserDailyLimit: 300,
    newUserDailyLimit: 50,
    usingEnvRegular: false,
    usingEnvPremium: false,
    usingEnvNew: false,
    envRegularLimit: 100,
    envPremiumLimit: 300,
    envNewLimit: 50,
  })

  // 对话框状态
  const [dialogState, setDialogState] = useState<{
    show: boolean
    type: 'confirm' | 'success' | 'error' | 'info'
    title: string
    message: string
    onConfirm?: () => void
    onCancel?: () => void
  }>({
    show: false,
    type: 'info',
    title: '',
    message: '',
  })

  // 用户操作模态框状态
  const [showUserActionModal, setShowUserActionModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [avatarFrames, setAvatarFrames] = useState<Array<{ id: number; category: string; imageUrl: string | null }>>([])
  const [avatarFrameCategories, setAvatarFrameCategories] = useState<string[]>([])
  const [selectedIsPremium, setSelectedIsPremium] = useState<boolean>(false) // 是否优质用户
  const [selectedIsOldUser, setSelectedIsOldUser] = useState<boolean>(false) // 是否首批用户
  const [selectedIsActive, setSelectedIsActive] = useState<boolean>(true) // 用户是否封禁
  const [selectedAvatarFrameId, setSelectedAvatarFrameId] = useState<number | null>(null)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all')
  const [directFrameIdInput, setDirectFrameIdInput] = useState<string>('')
  const [updatingUser, setUpdatingUser] = useState(false)
  const [isAvatarFrameExpanded, setIsAvatarFrameExpanded] = useState(false) // 头像框模块默认折叠
  const [subscriptionPlans, setSubscriptionPlans] = useState<Array<{ id: number; name: string; type: string; bonusPoints: number }>>([])
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null)
  const [compensating, setCompensating] = useState(false)
  
  // 邮箱白名单状态
  const [emailDomains, setEmailDomains] = useState<Array<{ id: number; domain: string; isEnabled: boolean }>>([])
  
  // 邮箱类型下拉框状态
  const [isEmailTypeDropdownOpen, setIsEmailTypeDropdownOpen] = useState(false)
  const emailTypeDropdownRef = useRef<HTMLDivElement>(null)

  // 隐藏父级 layout 的 Navbar 和 Footer
  useEffect(() => {
    // 隐藏 Navbar 和 Footer
    const navbar = document.getElementById('main-nav')
    const footer = document.querySelector('footer')
    const mobileNavbar = document.querySelector('nav')
    
    if (navbar) navbar.style.display = 'none'
    if (footer) footer.style.display = 'none'
    if (mobileNavbar && mobileNavbar.id !== 'main-nav') {
      const parent = mobileNavbar.closest('.lg\\:hidden') as HTMLElement | null
      if (parent) parent.style.display = 'none'
    }

    // 清理函数：当组件卸载时恢复显示（虽然通常不会卸载）
    return () => {
      if (navbar) navbar.style.display = ''
      if (footer) footer.style.display = ''
      if (mobileNavbar && mobileNavbar.id !== 'main-nav') {
        const parent = mobileNavbar.closest('.lg\\:hidden') as HTMLElement | null
        if (parent) parent.style.display = ''
      }
    }
  }, [])

  // 处理邮箱类型下拉框点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emailTypeDropdownRef.current && !emailTypeDropdownRef.current.contains(event.target as Node)) {
        setIsEmailTypeDropdownOpen(false)
      }
    }

    if (isEmailTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isEmailTypeDropdownOpen])

  // 检查管理员权限
  useEffect(() => {
    const checkAdmin = async () => {
      if (sessionLoading) return

      if (!session?.user) {
        router.push(transferUrl('/', locale))
        return
      }

      try {
        // 获取动态token
        const token = await generateDynamicTokenWithServerTime()
        
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        // 检查响应状态
        if (!response.ok) {
          // 如果是401或403，说明权限不足，重定向
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

  // 获取用户列表
  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...(emailVerifiedFilter && { emailVerified: emailVerifiedFilter }),
        emailType: emailTypeFilter,
        role: roleFilter,
        status: statusFilter,
        t: Date.now().toString(), // 添加时间戳避免缓存
      })

      const response = await fetch(`/api/admin/users?${params}`)
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('获取用户列表失败')
      }

      const data: UserListResponse = await response.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (err) {
      console.error('Error fetching users:', err)
      setError(err instanceof Error ? err.message : '获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 防抖定时器引用
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 输入防抖自动搜索
  useEffect(() => {
    if (!isAdmin || checkingAdmin) return

    // 清除之前的定时器
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }

    // 如果输入框为空，立即清除搜索并重置
    if (!searchInput.trim()) {
      setSearchTerm('')
      setCurrentPage(1)
      return
    }

    // 设置防抖：停顿 500ms 后自动搜索
    searchDebounceRef.current = setTimeout(() => {
      setSearchTerm(searchInput.trim())
      setCurrentPage(1)
    }, 500)

    // 清理函数
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [searchInput, isAdmin, checkingAdmin])

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchUsers()
      fetchLimitConfig()
      fetchAvatarFrames()
      fetchEmailDomains()
      fetchSubscriptionPlans()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, checkingAdmin, currentPage, searchTerm, sortBy, sortOrder, emailVerifiedFilter, emailTypeFilter, roleFilter, statusFilter])

  // 获取头像框列表
  const fetchAvatarFrames = async () => {
    try {
      const [framesResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/admin/avatar-frames?t=${Date.now()}`),
        fetch(`/api/admin/avatar-frames/categories?t=${Date.now()}`)
      ])
      if (framesResponse.ok) {
        const framesData = await framesResponse.json()
        setAvatarFrames(framesData.frames || [])
      }
      if (categoriesResponse.ok) {
        const categoriesData = await categoriesResponse.json()
        setAvatarFrameCategories(categoriesData.categories || [])
      }
    } catch (error) {
      console.error('Failed to fetch avatar frames:', error)
    }
  }

  const fetchSubscriptionPlans = async () => {
    try {
      const response = await fetch(`/api/subscription/plans?t=${Date.now()}`, { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        const plans = (data?.plans || []).map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          type: plan.type,
          bonusPoints: plan.bonusPoints ?? 0,
        }))
        setSubscriptionPlans(plans)
        if (plans.length > 0) {
          setSelectedPlanId(plans[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch subscription plans:', error)
    }
  }

  // 获取邮箱白名单列表
  const fetchEmailDomains = async () => {
    try {
      const response = await fetch(`/api/admin/allowed-email-domains?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        setEmailDomains(data.domains || [])
      }
    } catch (error) {
      console.error('Failed to fetch email domains:', error)
    }
  }

  // 处理搜索（保留手动搜索功能，用于回车键提交）
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // 清除防抖定时器，立即搜索
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    // 立即执行搜索
    if (searchInput.trim()) {
      setSearchTerm(searchInput.trim())
    } else {
      setSearchTerm('')
    }
    setCurrentPage(1)
  }

  // 截断文本并添加省略号
  const truncateText = (text: string | null, maxLength: number = 20): string => {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // 格式化日期（固定按东八区展示，但不额外显示时区后缀）
  // 检查用户订阅是否有效
  const isSubscriptionActive = (user: User): boolean => {
    if (!user.isSubscribed) return false
    if (!user.subscriptionExpiresAt) return false
    return new Date(user.subscriptionExpiresAt) > new Date()
  }

  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    const formatInShanghai = (d: Date) => {
      if (isNaN(d.getTime())) return '-'
      const parts = new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(d)
      const get = (type: string) => parts.find(p => p.type === type)?.value || ''
      const year = get('year')
      const month = get('month')
      const day = get('day')
      const hour = get('hour')
      const minute = get('minute')
      const second = get('second')
      return `${year}/${month}/${day}, ${hour}:${minute}:${second}`
    }
    
    // 如果是 Date 对象，按上海时区格式化
    if (date instanceof Date) {
      return formatInShanghai(date)
    }
    
    // 处理字符串格式
    const dateStr = date.toString().trim()
    // 是否包含显式时区（Z、+HH、+HHMM、+HH:MM 等）
    const hasExplicitTimezone = /([zZ]|[+-]\d{2}(:?\d{2})?)$/.test(dateStr)
    if (hasExplicitTimezone) {
      return formatInShanghai(new Date(dateStr))
    }
    
    // 检查是否是无时区的UTC时间字符串（如：2025-11-06 16:23:30.720884）
    // 格式：YYYY-MM-DD HH:MM:SS 或 YYYY-MM-DD HH:MM:SS.mmm
    const localTimeMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
    
    if (localTimeMatch) {
      // 将无时区字符串按 UTC 解释，再以上海时区显示
      const [, y, m, d, hh, mm, ss] = localTimeMatch
      const utcDate = new Date(Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(hh, 10),
        parseInt(mm, 10),
        parseInt(ss, 10)
      ))
      return formatInShanghai(utcDate)
    }
    
    // 其他可解析字符串：按上海时区格式化
    return formatInShanghai(new Date(dateStr))
  }

  const renderPlanType = (type: string) => {
    if (type === 'monthly') return '月度'
    if (type === 'quarterly') return '季度'
    if (type === 'yearly') return '年度'
    return type
  }

  // 获取用户限额配置（仅用于显示）
  const fetchLimitConfig = async () => {
    try {
      const response = await fetch(`/api/admin/user-limits?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setLimitConfig(data)
      }
    } catch (error) {
      console.error('Failed to fetch limit config:', error)
    }
  }

  // 显示对话框的辅助函数
  const showDialog = (
    type: 'confirm' | 'success' | 'error' | 'info',
    title: string,
    message: string,
    onConfirm?: () => void,
    onCancel?: () => void
  ) => {
    setDialogState({
      show: true,
      type,
      title,
      message,
      onConfirm,
      onCancel,
    })
  }

  // 关闭对话框
  const closeDialog = () => {
    setDialogState({
      show: false,
      type: 'info',
      title: '',
      message: '',
    })
  }

  // 确认对话框
  const handleDialogConfirm = () => {
    if (dialogState.onConfirm) {
      dialogState.onConfirm()
    }
    closeDialog()
  }

  // 取消对话框
  const handleDialogCancel = () => {
    if (dialogState.onCancel) {
      dialogState.onCancel()
    }
    closeDialog()
  }


  // 打开用户操作模态框
  const handleOpenUserActionModal = (user: User) => {
    setSelectedUser(user)
    setSelectedIsPremium(user.isPremium || false) // 初始化优质用户状态
    setSelectedIsOldUser(user.isOldUser || false) // 初始化首批用户状态
    setSelectedIsActive(user.isActive !== undefined ? user.isActive : true) // 初始化封禁状态
    setSelectedAvatarFrameId(user.avatarFrameId)
    setSelectedCategoryFilter('all')
    setDirectFrameIdInput(user.avatarFrameId?.toString() || '')
    setIsAvatarFrameExpanded(false) // 重置为折叠状态
    setSelectedPlanId(subscriptionPlans[0]?.id ?? null)
    setShowUserActionModal(true)
  }

  // 关闭用户操作模态框
  const handleCloseUserActionModal = () => {
    setShowUserActionModal(false)
    setSelectedUser(null)
    setSelectedIsPremium(false) // 重置为不是优质用户
    setSelectedIsOldUser(false) // 重置为不是首批用户
    setSelectedIsActive(true) // 重置为活跃状态
    setSelectedAvatarFrameId(null)
    setSelectedCategoryFilter('all')
    setDirectFrameIdInput('')
    setUpdatingUser(false)
    setIsAvatarFrameExpanded(false) // 重置为折叠状态
    setSelectedPlanId(subscriptionPlans[0]?.id ?? null)
    setCompensating(false)
  }

  // 处理直接输入头像框ID
  const handleDirectFrameIdChange = (value: string) => {
    setDirectFrameIdInput(value)
    const trimmedValue = value.trim()
    if (trimmedValue === '') {
      setSelectedAvatarFrameId(null)
      return
    }
    const parsed = parseInt(trimmedValue, 10)
    if (!isNaN(parsed) && parsed > 0) {
      // 检查ID是否存在
      const frameExists = avatarFrames.some(f => f.id === parsed)
      if (frameExists) {
        setSelectedAvatarFrameId(parsed)
      } else {
        // ID不存在，但仍然设置（允许设置不存在的ID）
        setSelectedAvatarFrameId(parsed)
      }
    } else {
      setSelectedAvatarFrameId(null)
    }
  }

  // 根据分类筛选头像框
  const filteredAvatarFrames = selectedCategoryFilter === 'all'
    ? avatarFrames
    : avatarFrames.filter(frame => frame.category === selectedCategoryFilter)

  // 保存用户设置
  const handleSaveUserSettings = async () => {
    if (!selectedUser) return

    setUpdatingUser(true)
    try {
      const response = await fetch(`/api/admin/users?t=${Date.now()}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          isPremium: selectedIsPremium,
          isOldUser: selectedIsOldUser,
          isActive: selectedIsActive,
          avatarFrameId: selectedAvatarFrameId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '更新失败')
      }

      // 刷新用户列表
      await fetchUsers()
      handleCloseUserActionModal()
      
      // 构建用户信息显示文本
      const userInfoParts: string[] = []
      if (selectedUser.name) userInfoParts.push(`"${selectedUser.name}"`)
      if (selectedUser.nickname) userInfoParts.push(`"${selectedUser.nickname}"`)
      if (selectedUser.uid) userInfoParts.push(`ID: ${selectedUser.uid}`)
      if (userInfoParts.length === 0) {
        userInfoParts.push(`邮箱: ${selectedUser.email}`)
      }
      const userInfo = userInfoParts.join(' ')
      
      showDialog('success', '操作成功', `用户 ${userInfo} 的设置已更新`)
    } catch (error) {
      console.error('Failed to update user settings:', error)
      showDialog('error', '操作失败', error instanceof Error ? error.message : '更新用户设置失败')
    } finally {
      setUpdatingUser(false)
    }
  }

  const handleCompensateSubscription = async () => {
    if (!selectedUser) return
    if (!selectedPlanId) {
      showDialog('error', '补偿失败', '请选择要补偿的会员套餐')
      return
    }

    const plan = subscriptionPlans.find(p => p.id === selectedPlanId)

    setCompensating(true)
    try {
      const response = await fetch(`/api/admin/users/compensate-subscription?t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          planId: selectedPlanId,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || '补偿失败')
      }

      await fetchUsers()
      setSelectedUser(prev => prev ? {
        ...prev,
        isSubscribed: true,
        subscriptionExpiresAt: data.subscriptionExpiresAt || prev.subscriptionExpiresAt,
      } : prev)

      const expiresText = data.subscriptionExpiresAt ? formatDate(data.subscriptionExpiresAt) : ''
      const planName = plan ? `${plan.name}（${renderPlanType(plan.type)}）` : '会员'

      showDialog('success', '补偿成功', `已为该用户补偿 ${planName}${expiresText ? `，有效期至 ${expiresText}` : ''}`)
    } catch (error) {
      console.error('Failed to compensate subscription:', error)
      showDialog('error', '补偿失败', error instanceof Error ? error.message : '补偿会员失败')
    } finally {
      setCompensating(false)
    }
  }

  // 加载中或权限检查
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 左侧边栏 */}
      <AdminSidebar />

      {/* 主内容区域 */}
      <div className="lg:pl-64 pt-16 lg:pt-0">
        {/* 顶部导航栏 */}
        <header className="bg-gradient-to-r from-white to-gray-50 border-b border-orange-200/50 shadow-sm sticky top-0 z-30 lg:static">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-orange-400/10 to-amber-400/10 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">用户管理</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">管理系统用户</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/80 rounded-lg border border-orange-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                {(() => {
                  const avatarSrc = currentUserAvatar || globalAvatar || (session?.user as ExtendedUser)?.avatar || session?.user?.image || '/images/default-avatar.svg'
                  // 确保路径以 / 开头或 http 开头
                  const normalizedAvatarSrc = avatarSrc.startsWith('http') || avatarSrc.startsWith('/') 
                    ? avatarSrc 
                    : `/${avatarSrc}`
                  
                  return (
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
                  )
                })()}
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

        <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)]">
          <div className="flex-shrink-0 p-4 lg:p-8 pb-2">
            <div className="max-w-7xl mx-auto">
              {/* 搜索栏 - 固定位置 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-sm text-gray-600">
                    当前限额: 优质用户 {limitConfig.usingEnvPremium ? `(环境变量: ${limitConfig.envPremiumLimit})` : limitConfig.premiumUserDailyLimit} 次，
                    首批用户 {limitConfig.usingEnvRegular ? `(环境变量: ${limitConfig.envRegularLimit})` : limitConfig.regularUserDailyLimit} 次，
                    新用户 {limitConfig.usingEnvNew ? `(环境变量: ${limitConfig.envNewLimit})` : limitConfig.newUserDailyLimit} 次
                  </div>
                </div>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch(e as any)
                      }
                    }}
                    placeholder="搜索邮箱、昵称或用户名..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                  />
                  <button
                    type="submit"
                    className="px-6 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
                  >
                    搜索
                  </button>
                  {(searchInput || searchTerm) && (
                    <button
                      type="button"
                      onClick={() => {
                        // 清除防抖定时器
                        if (searchDebounceRef.current) {
                          clearTimeout(searchDebounceRef.current)
                        }
                        // 立即清除搜索
                        setSearchInput('')
                        setSearchTerm('')
                        setCurrentPage(1)
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      清除
                    </button>
                  )}
                </form>
                
                {/* 筛选和排序控件 */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  {/* 高级搜索标题和折叠按钮 */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">高级搜索</h3>
                    <button
                      type="button"
                      onClick={() => setIsAdvancedSearchExpanded(!isAdvancedSearchExpanded)}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <span>{isAdvancedSearchExpanded ? '收起' : '展开'}</span>
                      <svg
                        className={`w-4 h-4 transform transition-transform duration-200 ${isAdvancedSearchExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* 高级搜索内容（可折叠） */}
                  {isAdvancedSearchExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {/* 排序字段 */}
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">排序字段</label>
                      <select
                        value={sortBy}
                        onChange={(e) => {
                          setSortBy(e.target.value as any)
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      >
                        <option value="createdAt">注册时间</option>
                        <option value="uid">UID</option>
                        <option value="lastLoginAt">最后登录</option>
                        <option value="dailyRequestCount">今日使用次数</option>
                      </select>
                    </div>
                    
                    {/* 排序方向 */}
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">排序方向</label>
                      <select
                        value={sortOrder}
                        onChange={(e) => {
                          setSortOrder(e.target.value as any)
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      >
                        <option value="desc">降序</option>
                        <option value="asc">升序</option>
                      </select>
                    </div>
                    
                    {/* 邮箱验证状态筛选 */}
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">邮箱验证</label>
                      <select
                        value={emailVerifiedFilter}
                        onChange={(e) => {
                          setEmailVerifiedFilter(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      >
                        <option value="">全部</option>
                        <option value="true">已验证</option>
                        <option value="false">未验证</option>
                      </select>
                    </div>
                    
                    {/* 邮箱类型筛选 */}
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">邮箱类型</label>
                      <div ref={emailTypeDropdownRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setIsEmailTypeDropdownOpen(!isEmailTypeDropdownOpen)}
                          className="w-full px-3 py-1.5 text-sm text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none bg-white flex items-center justify-between"
                        >
                          <span>
                            {emailTypeFilter === 'all' 
                              ? '全部' 
                              : emailTypeFilter === 'other'
                              ? '其他'
                              : emailDomains.find(d => d.domain === emailTypeFilter)?.domain || emailTypeFilter
                            }
                          </span>
                          <svg
                            className={`w-4 h-4 text-gray-600 transform transition-transform duration-200 ${isEmailTypeDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isEmailTypeDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <div
                              onClick={() => {
                                setEmailTypeFilter('all')
                                setCurrentPage(1)
                                setIsEmailTypeDropdownOpen(false)
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                                emailTypeFilter === 'all' ? 'bg-orange-50 text-orange-600' : 'text-gray-900'
                              }`}
                            >
                              全部
                            </div>
                            {emailDomains.map((domain) => (
                              <div
                                key={domain.id}
                                onClick={() => {
                                  setEmailTypeFilter(domain.domain)
                                  setCurrentPage(1)
                                  setIsEmailTypeDropdownOpen(false)
                                }}
                                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                                  emailTypeFilter === domain.domain ? 'bg-orange-50 text-orange-600' : 'text-gray-900'
                                } ${!domain.isEnabled ? 'line-through opacity-60' : ''}`}
                              >
                                {domain.domain}
                              </div>
                            ))}
                            <div
                              onClick={() => {
                                setEmailTypeFilter('other')
                                setCurrentPage(1)
                                setIsEmailTypeDropdownOpen(false)
                              }}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 ${
                                emailTypeFilter === 'other' ? 'bg-orange-50 text-orange-600' : 'text-gray-900'
                              }`}
                            >
                              其他
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* 角色筛选 */}
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">角色</label>
                      <select
                        value={roleFilter}
                        onChange={(e) => {
                          setRoleFilter(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      >
                        <option value="all">全部</option>
                        <option value="admin">管理员</option>
                        <option value="subscribed">付费用户</option>
                        <option value="premium">优质用户</option>
                        <option value="oldUser">首批用户</option>
                        <option value="regular">普通用户</option>
                      </select>
                    </div>
                    
                    {/* 状态筛选 */}
                    <div className="flex flex-col">
                      <label className="text-xs text-gray-600 mb-1">状态</label>
                      <select
                        value={statusFilter}
                        onChange={(e) => {
                          setStatusFilter(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      >
                        <option value="active">活跃</option>
                        <option value="banned">封禁</option>
                        <option value="all">全部</option>
                      </select>
                    </div>
                    </div>
                  )}
                  
                  {/* 重置筛选按钮 */}
                  {(sortBy !== 'createdAt' || sortOrder !== 'desc' || emailVerifiedFilter || emailTypeFilter !== 'all' || roleFilter !== 'all' || statusFilter !== 'active') && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('createdAt')
                          setSortOrder('desc')
                          setEmailVerifiedFilter('')
                          setEmailTypeFilter('all')
                          setRoleFilter('all')
                          setStatusFilter('active')
                          setCurrentPage(1)
                        }}
                        className="px-4 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        重置筛选
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-2">
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* 用户列表 - 可滚动区域 */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 pt-0">
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-gray-600">加载中...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  {searchTerm ? `未找到匹配的用户：${searchTerm}` : '暂无用户数据'}
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          用户信息
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          邮箱
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          状态
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          角色/次数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          注册时间
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          最后登录
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Image
                                src={user.avatar}
                                alt={user.nickname || user.name || 'User'}
                                width={40}
                                height={40}
                                className="rounded-full border-2 border-gray-200"
                              />
                              <div className="ml-3">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-gray-900" title={user.name || user.nickname || '未设置名称'}>
                                    {truncateText(user.name || user.nickname || '未设置名称', 8)}
                                  </div>
                                  {user.nickname && user.name && user.nickname !== user.name && (
                                    <span className="text-sm text-gray-500" title={user.nickname}>
                                      ({truncateText(user.nickname, 6)})
                                    </span>
                                  )}
                                  {user.isAdmin && (
                                    <span className="px-2 py-0.5 text-xs font-semibold bg-gradient-to-r from-orange-400 to-amber-400 text-white rounded-full">
                                      管理员
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  UID: {user.uid || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 relative group">
                              <span className="cursor-help">{truncateText(user.email, 20)}</span>
                              {user.email && user.email.length > 20 && (
                                <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                    {user.email}
                                    <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {!user.emailVerified && (
                              <div className="text-xs text-orange-600">未验证</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              {user.isActive ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  活跃
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  已禁用
                                </span>
                              )}
                              {user.emailVerified ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  已验证
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  未验证
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-center">
                              <div className="flex flex-wrap gap-1 justify-center">
                                {user.isAdmin && (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-400 to-amber-400 text-white">
                                    管理员
                                  </span>
                                )}
                                {isSubscriptionActive(user) && (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    付费用户
                                  </span>
                                )}
                                {user.isPremium && (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    优质用户
                                  </span>
                                )}
                                {user.isOldUser && (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    首批用户
                                  </span>
                                )}
                                {!user.isAdmin && !isSubscriptionActive(user) && !user.isPremium && !user.isOldUser && (
                                  <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                    新用户
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-600">
                                今日: {user.dailyRequestCount || 0} / {user.isAdmin ? '∞' : user.isPremium ? limitConfig.premiumUserDailyLimit : user.isOldUser ? limitConfig.regularUserDailyLimit : limitConfig.newUserDailyLimit}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(user.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(user.lastLoginAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenUserActionModal(user)}
                              className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1"
                              title="更多操作"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                              </svg>
                              更多
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {pagination.totalPages > 1 && (
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-wrap gap-4">
                    <div className="text-sm text-gray-700">
                      显示第 {(currentPage - 1) * pagination.limit + 1} - {Math.min(currentPage * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        上一页
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-700 flex items-center">
                        第 {currentPage} / {pagination.totalPages} 页
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">跳转到</span>
                        <input
                          type="number"
                          min="1"
                          max={pagination.totalPages}
                          value={pageInput}
                          onChange={(e) => setPageInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const page = parseInt(pageInput, 10)
                              if (!isNaN(page) && page >= 1 && page <= pagination.totalPages) {
                                setCurrentPage(page)
                                setPageInput('')
                              }
                            }
                          }}
                          placeholder={`${currentPage}`}
                          className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                        <span className="text-sm text-gray-700">页</span>
                        <button
                          onClick={() => {
                            const page = parseInt(pageInput, 10)
                            if (!isNaN(page) && page >= 1 && page <= pagination.totalPages) {
                              setCurrentPage(page)
                              setPageInput('')
                            }
                          }}
                          disabled={!pageInput || isNaN(parseInt(pageInput, 10)) || parseInt(pageInput, 10) < 1 || parseInt(pageInput, 10) > pagination.totalPages}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          跳转
                        </button>
                      </div>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                        disabled={currentPage === pagination.totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 用户操作模态框 */}
      {showUserActionModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">用户设置</h2>
              <button
                onClick={handleCloseUserActionModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 用户信息 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <AvatarWithFrame
                    avatar={selectedUser.avatar}
                    avatarFrameId={selectedAvatarFrameId}
                    size={60}
                    className="border-2 border-gray-200"
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900" title={selectedUser.name || selectedUser.nickname || '未设置名称'}>
                    {truncateText(selectedUser.name || selectedUser.nickname || '未设置名称', 12)}
                  </div>
                  <div className="text-sm text-gray-600 relative group">
                    <span className="cursor-help">{truncateText(selectedUser.email, 20)}</span>
                    {selectedUser.email && selectedUser.email.length > 20 && (
                      <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                        <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                          {selectedUser.email}
                          <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">UID: {selectedUser.uid || '-'}</div>
                </div>
              </div>
            </div>

            {/* 设置用户身份（支持同时拥有多个身份） */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                用户身份
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIsPremium}
                    onChange={(e) => setSelectedIsPremium(e.target.checked)}
                    disabled={selectedUser.isAdmin || updatingUser}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                  />
                  <span className="text-sm text-gray-700">优质用户</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIsOldUser}
                    onChange={(e) => setSelectedIsOldUser(e.target.checked)}
                    disabled={selectedUser.isAdmin || updatingUser}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                  />
                  <span className="text-sm text-gray-700">首批用户</span>
                </label>
              </div>
              {selectedUser.isAdmin && (
                <p className="mt-2 text-xs text-gray-500">管理员身份无法修改</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                注意：用户可以同时拥有多个身份（优质用户、首批用户、付费用户等）
              </p>
            </div>

            {/* 补偿会员 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  补偿会员
                </label>
                <div className="text-xs text-gray-500">
                  当前状态：{selectedUser.isSubscribed && selectedUser.subscriptionExpiresAt
                    ? `已开通，过期时间 ${formatDate(selectedUser.subscriptionExpiresAt)}`
                    : '未开通'}
                </div>
              </div>
              {subscriptionPlans.length === 0 ? (
                <div className="text-sm text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2">
                  暂无可用套餐，请先在订阅套餐配置中添加
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedPlanId ?? ''}
                      onChange={(e) => setSelectedPlanId(e.target.value ? parseInt(e.target.value, 10) : null)}
                      disabled={compensating}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                    >
                      {subscriptionPlans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}（{renderPlanType(plan.type)}，赠送积分 {plan.bonusPoints}）
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500">
                      选择套餐后点击补偿，将按套餐时长叠加当前会员有效期，并赠送对应积分（积分有效期一年）。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCompensateSubscription}
                    disabled={compensating}
                    className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {compensating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>补偿中...</span>
                      </>
                    ) : (
                      '补偿会员'
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* 设置用户封禁状态 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                账号状态
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="userActive"
                    value="active"
                    checked={selectedIsActive === true}
                    onChange={() => setSelectedIsActive(true)}
                    disabled={selectedUser.isAdmin || updatingUser}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">活跃</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="userActive"
                    value="banned"
                    checked={selectedIsActive === false}
                    onChange={() => setSelectedIsActive(false)}
                    disabled={selectedUser.isAdmin || updatingUser}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">已封禁</span>
                </label>
              </div>
              {selectedUser.isAdmin && (
                <p className="mt-2 text-xs text-gray-500">管理员账号无法封禁</p>
              )}
              {!selectedIsActive && (
                <p className="mt-2 text-xs text-orange-600">封禁后用户将无法发起生图请求和签到获得积分</p>
              )}
            </div>

            {/* 设置用户头像框 */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <label className="block text-sm font-medium text-gray-700">
                    头像框
                  </label>
                  {selectedUser.avatarFrameId && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      当前ID: {selectedUser.avatarFrameId}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvatarFrameExpanded(!isAvatarFrameExpanded)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <span>{isAvatarFrameExpanded ? '收起' : '展开'}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform duration-200 ${isAvatarFrameExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {isAvatarFrameExpanded && (
                <>
              {/* 直接输入头像框ID */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  直接输入头像框ID
                </label>
                <input
                  type="text"
                  value={directFrameIdInput}
                  onChange={(e) => handleDirectFrameIdChange(e.target.value)}
                  placeholder="输入头像框ID（留空为无头像框）"
                  disabled={updatingUser}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
                {selectedAvatarFrameId && !avatarFrames.some(f => f.id === selectedAvatarFrameId) && (
                  <p className="mt-1 text-xs text-orange-600">
                    注意：ID {selectedAvatarFrameId} 不存在于当前头像框列表中
                  </p>
                )}
              </div>

              {/* 分类筛选 */}
              {avatarFrameCategories.length > 0 && (
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-2">
                    按分类筛选
                  </label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => {
                      setSelectedCategoryFilter(e.target.value)
                      // 如果当前选中的头像框不在筛选后的列表中，清除选择
                      if (e.target.value !== 'all' && selectedAvatarFrameId) {
                        const frame = avatarFrames.find(f => f.id === selectedAvatarFrameId)
                        if (!frame || frame.category !== e.target.value) {
                          setSelectedAvatarFrameId(null)
                          setDirectFrameIdInput('')
                        }
                      }
                    }}
                    disabled={updatingUser}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                  >
                    <option value="all">全部分类 ({avatarFrames.length})</option>
                    {avatarFrameCategories.map(cat => {
                      const count = avatarFrames.filter(f => f.category === cat).length
                      return (
                        <option key={cat} value={cat}>
                          {cat} ({count})
                        </option>
                      )
                    })}
                  </select>
                </div>
              )}

              {/* 头像框选择列表 */}
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-600 mb-2">
                  从列表选择
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  <label className="relative cursor-pointer">
                    <input
                      type="radio"
                      name="avatarFrame"
                      value=""
                      checked={selectedAvatarFrameId === null}
                      onChange={() => {
                        setSelectedAvatarFrameId(null)
                        setDirectFrameIdInput('')
                      }}
                      disabled={updatingUser}
                      className="sr-only"
                    />
                    <div className={`p-2 border-2 rounded-lg transition-all ${
                      selectedAvatarFrameId === null
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <div className="aspect-square bg-gray-100 rounded flex items-center justify-center">
                        <span className="text-xs text-gray-500">无头像框</span>
                      </div>
                    </div>
                  </label>
                  {filteredAvatarFrames.map((frame) => (
                    <label key={frame.id} className="relative cursor-pointer">
                      <input
                        type="radio"
                        name="avatarFrame"
                        value={frame.id}
                        checked={selectedAvatarFrameId === frame.id}
                        onChange={() => {
                          setSelectedAvatarFrameId(frame.id)
                          setDirectFrameIdInput(frame.id.toString())
                        }}
                        disabled={updatingUser}
                        className="sr-only"
                      />
                      <div className={`p-2 border-2 rounded-lg transition-all ${
                        selectedAvatarFrameId === frame.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="aspect-square bg-gray-100 rounded overflow-hidden">
                          {frame.imageUrl ? (
                            <Image
                              src={frame.imageUrl}
                              alt={`Frame ${frame.id}`}
                              width={80}
                              height={80}
                              className="w-full h-full object-contain"
                              unoptimized={frame.imageUrl.startsWith('http')}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-xs text-gray-400">无图片</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-center text-gray-600 truncate">
                          ID: {frame.id}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {filteredAvatarFrames.length === 0 && avatarFrames.length > 0 && (
                <p className="mt-2 text-xs text-gray-500">该分类下暂无头像框</p>
              )}
              {avatarFrames.length === 0 && (
                <p className="mt-2 text-xs text-gray-500">暂无头像框，请先在装饰管理中添加</p>
              )}
                </>
              )}
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={handleCloseUserActionModal}
                disabled={updatingUser}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSaveUserSettings}
                disabled={updatingUser}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {updatingUser ? (
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

      {/* 自定义对话框 */}
      {dialogState.show && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: 'fadeInUp 0.2s ease-out forwards' }}
          onClick={dialogState.type === 'confirm' ? () => {} : closeDialog}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            style={{ animation: 'scaleIn 0.15s ease-out forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 图标 */}
            <div className={`flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full ${
              dialogState.type === 'success' ? 'bg-green-100' :
              dialogState.type === 'error' ? 'bg-red-100' :
              dialogState.type === 'confirm' ? 'bg-blue-100' :
              'bg-gray-100'
            }`}>
              {dialogState.type === 'success' ? (
                <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : dialogState.type === 'error' ? (
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : dialogState.type === 'confirm' ? (
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            
            {/* 标题 */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              {dialogState.title}
            </h3>
            
            {/* 消息 */}
            <p className="text-gray-600 text-center mb-6">
              {dialogState.message}
            </p>
            
            {/* 按钮 */}
            <div className="flex gap-3">
              {dialogState.type === 'confirm' ? (
                <>
                  <button
                    onClick={handleDialogCancel}
                    className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-200"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDialogConfirm}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    确认
                  </button>
                </>
              ) : (
                <button
                  onClick={closeDialog}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  我知道了
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

