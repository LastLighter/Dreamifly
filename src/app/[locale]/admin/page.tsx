'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import AdminSidebar from '@/components/AdminSidebar'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'

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
  dailyRequestCount: number
  createdAt: Date | string
  updatedAt: Date | string
  lastLoginAt: Date | string | null
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
  const [roleFilter, setRoleFilter] = useState<string>('all') // all, admin, premium, regular

  // 用户限额配置状态（仅用于显示）
  const [limitConfig, setLimitConfig] = useState({
    regularUserDailyLimit: 200,
    premiumUserDailyLimit: 500,
    usingEnvRegular: false,
    usingEnvPremium: false,
    envRegularLimit: 200,
    envPremiumLimit: 500,
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

  // 检查管理员权限
  useEffect(() => {
    const checkAdmin = async () => {
      if (sessionLoading) return

      if (!session?.user) {
        router.push(transferUrl('/', locale))
        return
      }

      try {
        const response = await fetch('/api/admin/check')
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, checkingAdmin, currentPage, searchTerm, sortBy, sortOrder, emailVerifiedFilter, emailTypeFilter, roleFilter])

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

  // 格式化日期（固定按东八区展示，但不额外显示时区后缀）
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

  // 获取用户限额配置（仅用于显示）
  const fetchLimitConfig = async () => {
    try {
      const response = await fetch('/api/admin/user-limits')
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


  // 切换用户角色（普通/优质）
  const handleTogglePremium = (user: User, isPremium: boolean) => {
    // 构建用户信息显示文本
    const userInfoParts: string[] = []
    if (user.name) userInfoParts.push(`"${user.name}"`)
    if (user.nickname) userInfoParts.push(`"${user.nickname}"`)
    if (user.uid) userInfoParts.push(`ID: ${user.uid}`)
    if (userInfoParts.length === 0) {
      userInfoParts.push(`邮箱: ${user.email}`)
    }
    const userInfo = userInfoParts.join(' ')
    
    const actionText = isPremium ? '设为优质用户' : '设为普通用户'
    const message = `确定要将用户 ${userInfo} ${actionText}吗？`
    
    showDialog(
      'confirm',
      '确认操作',
      message,
      async () => {
    try {
      // 添加时间戳避免缓存
      const response = await fetch(`/api/admin/users?t=${Date.now()}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
              userId: user.id,
          isPremium,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '更新失败')
      }

      // 刷新用户列表
      fetchUsers()
          showDialog('success', '操作成功', `用户 ${userInfo} 的角色已更新`)
    } catch (error) {
      console.error('Failed to update user role:', error)
          showDialog('error', '操作失败', error instanceof Error ? error.message : '更新用户角色失败')
    }
      }
    )
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
                    当前限额: 普通用户 {limitConfig.usingEnvRegular ? `(环境变量: ${limitConfig.envRegularLimit})` : limitConfig.regularUserDailyLimit} 次，
                    优质用户 {limitConfig.usingEnvPremium ? `(环境变量: ${limitConfig.envPremiumLimit})` : limitConfig.premiumUserDailyLimit} 次
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
                    placeholder="搜索邮箱、昵称或姓名..."
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
                      <select
                        value={emailTypeFilter}
                        onChange={(e) => {
                          setEmailTypeFilter(e.target.value)
                          setCurrentPage(1)
                        }}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      >
                        <option value="all">全部</option>
                        <option value="gmail">Gmail</option>
                        <option value="outlook">Outlook/Hotmail</option>
                        <option value="qq">QQ邮箱</option>
                        <option value="163">163/126邮箱</option>
                        <option value="other">其他</option>
                      </select>
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
                        <option value="premium">优质用户</option>
                        <option value="regular">普通用户</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* 重置筛选按钮 */}
                  {(sortBy !== 'createdAt' || sortOrder !== 'desc' || emailVerifiedFilter || emailTypeFilter !== 'all' || roleFilter !== 'all') && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSortBy('createdAt')
                          setSortOrder('desc')
                          setEmailVerifiedFilter('')
                          setEmailTypeFilter('all')
                          setRoleFilter('all')
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
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.name || user.nickname || '未设置名称'}
                                  </div>
                                  {user.nickname && user.name && user.nickname !== user.name && (
                                    <span className="text-sm text-gray-500">
                                      ({user.nickname})
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
                            <div className="text-sm text-gray-900">{user.email}</div>
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
                            <div className="flex flex-col gap-1">
                              {user.isAdmin ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-400 to-amber-400 text-white">
                                  管理员
                                </span>
                              ) : user.isPremium ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  优质用户
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                  普通用户
                                </span>
                              )}
                              <span className="text-xs text-gray-600">
                                今日: {user.dailyRequestCount || 0} / {user.isAdmin ? '∞' : user.isPremium ? limitConfig.premiumUserDailyLimit : limitConfig.regularUserDailyLimit}
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
                            {!user.isAdmin && (
                              <button
                                onClick={() => handleTogglePremium(user, !user.isPremium)}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                  user.isPremium
                                    ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                              >
                                {user.isPremium ? '设为普通' : '设为优质'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 分页 */}
                {pagination.totalPages > 1 && (
                  <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      显示第 {(currentPage - 1) * pagination.limit + 1} - {Math.min(currentPage * pagination.limit, pagination.total)} 条，共 {pagination.total} 条
                    </div>
                    <div className="flex gap-2">
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

