'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import Image from 'next/image'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

interface IPBlacklistRecord {
  id: string
  ipAddress: string
  reason: string | null
  createdAt: Date | string
  updatedAt: Date | string
  createdBy: string | null
}

interface AccountBlacklistRecord {
  id: string
  email: string
  name: string | null
  nickname: string | null
  isAdmin: boolean
  isPremium: boolean
  isOldUser: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export default function BlacklistPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [activeTab, setActiveTab] = useState<'ip' | 'account'>('account')

  // IP黑名单相关状态
  const [ipRecords, setIpRecords] = useState<IPBlacklistRecord[]>([])
  const [ipLoading, setIpLoading] = useState(false)
  const [ipError, setIpError] = useState('')
  const [ipSearchTerm, setIpSearchTerm] = useState('')
  const [ipCurrentPage, setIpCurrentPage] = useState(1)
  const [ipTotalPages, setIpTotalPages] = useState(1)
  const [ipTotal, setIpTotal] = useState(0)
  const [showAddIpModal, setShowAddIpModal] = useState(false)
  const [newIpAddress, setNewIpAddress] = useState('')
  const [newIpReason, setNewIpReason] = useState('')

  // 账户黑名单相关状态
  const [accountRecords, setAccountRecords] = useState<AccountBlacklistRecord[]>([])
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountError, setAccountError] = useState('')
  const [accountSearchTerm, setAccountSearchTerm] = useState('')
  const [accountCurrentPage, setAccountCurrentPage] = useState(1)
  const [accountTotalPages, setAccountTotalPages] = useState(1)
  const [accountTotal, setAccountTotal] = useState(0)
  const [showAddAccountModal, setShowAddAccountModal] = useState(false)
  const [newAccountEmail, setNewAccountEmail] = useState('')

  // 防抖定时器引用
  const accountSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ipSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 确认对话框状态
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean
    title: string
    message: string
    onConfirm?: () => void
    onCancel?: () => void
  }>({
    show: false,
    title: '',
    message: '',
  })

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

  // 获取IP黑名单列表
  const fetchIPBlacklist = useCallback(async (page?: number, search?: string) => {
    setIpLoading(true)
    setIpError('')
    try {
      // 使用传入的参数，如果没有则从状态获取最新值
      const currentPage = page !== undefined ? page : ipCurrentPage
      const currentSearch = search !== undefined ? search : ipSearchTerm
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        _t: Date.now().toString(), // 添加时间戳防止缓存
      })
      if (currentSearch) {
        params.append('search', currentSearch)
      }

      const response = await fetch(`/api/admin/blacklist/ip?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取IP黑名单失败')
      }

      setIpRecords(data.records || [])
      setIpTotalPages(data.pagination?.totalPages || 1)
      setIpTotal(data.pagination?.total || 0)
    } catch (error: any) {
      console.error('Error fetching IP blacklist:', error)
      setIpError(error.message || '获取IP黑名单失败')
    } finally {
      setIpLoading(false)
    }
  }, [ipCurrentPage, ipSearchTerm])

  // IP搜索防抖：输入停止200ms后自动搜索
  useEffect(() => {
    if (!isAdmin || checkingAdmin || activeTab !== 'ip') return

    // 清除之前的定时器
    if (ipSearchDebounceRef.current) {
      clearTimeout(ipSearchDebounceRef.current)
    }

    // 如果搜索框为空，立即清除搜索并重置
    if (!ipSearchTerm.trim()) {
      setIpCurrentPage(1)
      ipSearchDebounceRef.current = setTimeout(() => {
        fetchIPBlacklist(1, '')
      }, 200)
      return
    }

    // 设置防抖：停顿200ms后自动搜索
    ipSearchDebounceRef.current = setTimeout(() => {
      setIpCurrentPage(1)
      fetchIPBlacklist(1, ipSearchTerm.trim())
    }, 200)

    // 清理函数
    return () => {
      if (ipSearchDebounceRef.current) {
        clearTimeout(ipSearchDebounceRef.current)
      }
    }
  }, [ipSearchTerm, isAdmin, checkingAdmin, activeTab])

  // 当标签页切换到IP黑名单或页码改变时，重新获取数据
  useEffect(() => {
    if (activeTab === 'ip' && isAdmin && !checkingAdmin) {
      // 只有在页码改变时才触发，搜索由防抖处理
      fetchIPBlacklist()
    }
  }, [activeTab, ipCurrentPage, isAdmin, checkingAdmin, fetchIPBlacklist])

  // 获取账户黑名单列表
  const fetchAccountBlacklist = useCallback(async (page?: number, search?: string) => {
    setAccountLoading(true)
    setAccountError('')
    try {
      const currentPage = page !== undefined ? page : accountCurrentPage
      const currentSearch = search !== undefined ? search : accountSearchTerm
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        _t: Date.now().toString(),
      })
      if (currentSearch) {
        params.append('search', currentSearch)
      }

      const response = await fetch(`/api/admin/blacklist/account?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取账户黑名单失败')
      }

      setAccountRecords(data.records || [])
      setAccountTotalPages(data.pagination?.totalPages || 1)
      setAccountTotal(data.pagination?.total || 0)
    } catch (error: any) {
      console.error('Error fetching account blacklist:', error)
      setAccountError(error.message || '获取账户黑名单失败')
    } finally {
      setAccountLoading(false)
    }
  }, [accountCurrentPage, accountSearchTerm])

  // 账户搜索防抖：输入停止200ms后自动搜索
  useEffect(() => {
    if (!isAdmin || checkingAdmin || activeTab !== 'account') return

    // 清除之前的定时器
    if (accountSearchDebounceRef.current) {
      clearTimeout(accountSearchDebounceRef.current)
    }

    // 如果搜索框为空，立即清除搜索并重置
    if (!accountSearchTerm.trim()) {
      setAccountCurrentPage(1)
      accountSearchDebounceRef.current = setTimeout(() => {
        fetchAccountBlacklist(1, '')
      }, 200)
      return
    }

    // 设置防抖：停顿200ms后自动搜索
    accountSearchDebounceRef.current = setTimeout(() => {
      setAccountCurrentPage(1)
      fetchAccountBlacklist(1, accountSearchTerm.trim())
    }, 200)

    // 清理函数
    return () => {
      if (accountSearchDebounceRef.current) {
        clearTimeout(accountSearchDebounceRef.current)
      }
    }
  }, [accountSearchTerm, isAdmin, checkingAdmin, activeTab])

  // 当标签页切换到账户黑名单或页码改变时，重新获取数据
  useEffect(() => {
    if (activeTab === 'account' && isAdmin && !checkingAdmin) {
      // 只有在页码改变时才触发，搜索由防抖处理
      fetchAccountBlacklist()
    }
  }, [activeTab, accountCurrentPage, isAdmin, checkingAdmin, fetchAccountBlacklist])

  // 添加账户到黑名单
  const handleAddAccount = async () => {
    if (!newAccountEmail.trim()) {
      setAccountError('请输入邮箱地址')
      return
    }

    try {
      const response = await fetch(`/api/admin/blacklist/account?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newAccountEmail.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '封禁账户失败')
      }

      // 重置表单
      setNewAccountEmail('')
      setShowAddAccountModal(false)
      setAccountError('')
      
      // 重置到第一页并立即刷新列表
      setAccountCurrentPage(1)
      await fetchAccountBlacklist(1, accountSearchTerm)
    } catch (error: any) {
      console.error('Error banning account:', error)
      setAccountError(error.message || '封禁账户失败')
    }
  }

  // 显示确认对话框
  const showConfirmDialog = (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      onConfirm,
      onCancel,
    })
  }

  // 关闭确认对话框
  const closeConfirmDialog = () => {
    setConfirmDialog({
      show: false,
      title: '',
      message: '',
    })
  }

  // 确认对话框确认
  const handleConfirm = () => {
    if (confirmDialog.onConfirm) {
      confirmDialog.onConfirm()
    }
    closeConfirmDialog()
  }

  // 确认对话框取消
  const handleCancel = () => {
    if (confirmDialog.onCancel) {
      confirmDialog.onCancel()
    }
    closeConfirmDialog()
  }

  // 删除账户黑名单记录（解封账户）
  const handleDeleteAccount = (userId: string) => {
    showConfirmDialog(
      '确认解封',
      '确定要解封该账户吗？解封后账户将恢复为活跃状态。',
      async () => {
        try {
          const response = await fetch(`/api/admin/blacklist/account?userId=${userId}&_t=${Date.now()}`, {
            method: 'DELETE',
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || '解封账户失败')
          }

          setAccountError('')
          
          // 立即重新获取列表，保持当前页码和搜索条件
          await fetchAccountBlacklist(accountCurrentPage, accountSearchTerm)
        } catch (error: any) {
          console.error('Error unbanning account:', error)
          setAccountError(error.message || '解封账户失败')
        }
      }
    )
  }

  // 处理账户搜索（保留手动搜索功能，用于回车键提交）
  const handleAccountSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // 清除防抖定时器，立即搜索
    if (accountSearchDebounceRef.current) {
      clearTimeout(accountSearchDebounceRef.current)
    }
    // 立即执行搜索
    setAccountCurrentPage(1)
    fetchAccountBlacklist(1, accountSearchTerm.trim())
  }

  // 添加IP到黑名单
  const handleAddIP = async () => {
    if (!newIpAddress.trim()) {
      setIpError('请输入IP地址')
      return
    }

    try {
      const response = await fetch(`/api/admin/blacklist/ip?_t=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipAddress: newIpAddress.trim(),
          reason: newIpReason.trim() || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '添加IP失败')
      }

      // 重置表单
      setNewIpAddress('')
      setNewIpReason('')
      setShowAddIpModal(false)
      setIpError('')
      
      // 重置到第一页并立即刷新列表
      setIpCurrentPage(1)
      // 直接刷新，传入明确的参数
      await fetchIPBlacklist(1, ipSearchTerm)
    } catch (error: any) {
      console.error('Error adding IP:', error)
      setIpError(error.message || '添加IP失败')
    }
  }

  // 删除IP黑名单记录
  const handleDeleteIP = (id: string) => {
    showConfirmDialog(
      '确认删除',
      '确定要删除这条IP黑名单记录吗？删除后该IP将不再被阻止。',
      async () => {
        try {
          const response = await fetch(`/api/admin/blacklist/ip?id=${id}&_t=${Date.now()}`, {
            method: 'DELETE',
          })

          const data = await response.json()

          if (!response.ok) {
            throw new Error(data.error || '删除IP失败')
          }

          setIpError('')
          
          // 立即重新获取列表，保持当前页码和搜索条件
          await fetchIPBlacklist(ipCurrentPage, ipSearchTerm)
        } catch (error: any) {
          console.error('Error deleting IP:', error)
          setIpError(error.message || '删除IP失败')
        }
      }
    )
  }

  // 处理IP搜索（保留手动搜索功能，用于回车键提交）
  const handleIPSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // 清除防抖定时器，立即搜索
    if (ipSearchDebounceRef.current) {
      clearTimeout(ipSearchDebounceRef.current)
    }
    // 立即执行搜索
    setIpCurrentPage(1)
    fetchIPBlacklist(1, ipSearchTerm.trim())
  }

  if (checkingAdmin || sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const currentUserAvatar = globalAvatar || (session?.user as ExtendedUser)?.avatar || session?.user?.image || '/images/default-avatar.svg'

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">黑名单管理</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">管理IP和账号黑名单</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/80 rounded-lg border border-orange-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                <Image
                  src={currentUserAvatar}
                  alt="Avatar"
                  width={36}
                  height={36}
                  className="rounded-full border-2 border-orange-400/40 shadow-sm object-cover"
                  unoptimized={currentUserAvatar.startsWith('http')}
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

        <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)]">
          <div className="flex-shrink-0 p-4 lg:p-8 pb-2">
            <div className="max-w-7xl mx-auto">
              {/* 标签页切换 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('ip')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeTab === 'ip'
                        ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    IP黑名单
                  </button>
                  <button
                    onClick={() => setActiveTab('account')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeTab === 'account'
                        ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white shadow-md'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    账号黑名单
                  </button>
                </div>
              </div>

              {/* IP黑名单内容 */}
              {activeTab === 'ip' && (
                <>
                  {/* 搜索和添加按钮 */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="flex gap-2 mb-4">
                      <form onSubmit={handleIPSearch} className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={ipSearchTerm}
                          onChange={(e) => setIpSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleIPSearch(e as any)
                            }
                          }}
                          placeholder="搜索IP地址或原因"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                        <button
                          type="submit"
                          className="px-6 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
                        >
                          搜索
                        </button>
                        {ipSearchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              // 清除防抖定时器
                              if (ipSearchDebounceRef.current) {
                                clearTimeout(ipSearchDebounceRef.current)
                              }
                              // 立即清除搜索
                              setIpSearchTerm('')
                              setIpCurrentPage(1)
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            清除
                          </button>
                        )}
                      </form>
                      <button
                        onClick={() => setShowAddIpModal(true)}
                        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-md"
                      >
                        + 添加IP
                      </button>
                    </div>

                    {/* 错误提示 */}
                    {ipError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">
                        {ipError}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 账号黑名单内容 */}
              {activeTab === 'account' && (
                <>
                  {/* 搜索和添加按钮 */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                    <div className="flex gap-2 mb-4">
                      <form onSubmit={handleAccountSearch} className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={accountSearchTerm}
                          onChange={(e) => setAccountSearchTerm(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAccountSearch(e as any)
                            }
                          }}
                          placeholder="搜索邮箱、用户名或昵称"
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        />
                        <button
                          type="submit"
                          className="px-6 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
                        >
                          搜索
                        </button>
                        {accountSearchTerm && (
                          <button
                            type="button"
                            onClick={() => {
                              // 清除防抖定时器
                              if (accountSearchDebounceRef.current) {
                                clearTimeout(accountSearchDebounceRef.current)
                              }
                              // 立即清除搜索
                              setAccountSearchTerm('')
                              setAccountCurrentPage(1)
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                          >
                            清除
                          </button>
                        )}
                      </form>
                      <button
                        onClick={() => setShowAddAccountModal(true)}
                        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-md"
                      >
                        + 添加账户
                      </button>
                    </div>

                    {/* 错误提示 */}
                    {accountError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg">
                        {accountError}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 账户黑名单列表 - 可滚动区域 */}
          {activeTab === 'account' && (
            <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 pt-0">
              <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {accountLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                      <p className="text-gray-600">加载中...</p>
                    </div>
                  ) : accountRecords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {accountSearchTerm ? `未找到匹配的账户：${accountSearchTerm}` : '暂无被封禁的账户'}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                邮箱
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                用户名
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                身份标识
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                封禁时间
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                操作
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {accountRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{record.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">
                                    {record.name || record.nickname || '-'}
                                  </div>
                                  {record.nickname && record.name && record.nickname !== record.name && (
                                    <div className="text-xs text-gray-500">({record.nickname})</div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {record.isAdmin ? (
                                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-400 to-amber-400 text-white">
                                        管理员
                                      </span>
                                    ) : record.isPremium ? (
                                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        优质用户
                                      </span>
                                    ) : record.isOldUser ? (
                                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                        首批用户
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                        新用户
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">
                                    {new Date(record.updatedAt).toLocaleString('zh-CN')}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleDeleteAccount(record.id)}
                                    className="text-green-600 hover:text-green-900 transition-colors"
                                  >
                                    解封
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* 分页 */}
                      {accountTotalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                          <div className="text-sm text-gray-700">
                            共 {accountTotal} 条记录，第 {accountCurrentPage} / {accountTotalPages} 页
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setAccountCurrentPage(p => Math.max(1, p - 1))}
                              disabled={accountCurrentPage === 1}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              上一页
                            </button>
                            <button
                              onClick={() => setAccountCurrentPage(p => Math.min(accountTotalPages, p + 1))}
                              disabled={accountCurrentPage === accountTotalPages}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}

          {/* IP黑名单列表 - 可滚动区域 */}
          {activeTab === 'ip' && (
            <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 pt-0">
              <div className="max-w-7xl mx-auto">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {ipLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                      <p className="text-gray-600">加载中...</p>
                    </div>
                  ) : ipRecords.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {ipSearchTerm ? `未找到匹配的IP：${ipSearchTerm}` : '暂无IP黑名单记录'}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                IP地址
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                拉黑原因
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                创建时间
                              </th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                操作
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {ipRecords.map((record) => (
                              <tr key={record.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{record.ipAddress}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="text-sm text-gray-500">{record.reason || '-'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-500">
                                    {new Date(record.createdAt).toLocaleString('zh-CN')}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => handleDeleteIP(record.id)}
                                    className="text-red-600 hover:text-red-900 transition-colors"
                                  >
                                    删除
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* 分页 */}
                      {ipTotalPages > 1 && (
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                          <div className="text-sm text-gray-700">
                            共 {ipTotal} 条记录，第 {ipCurrentPage} / {ipTotalPages} 页
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setIpCurrentPage(p => Math.max(1, p - 1))}
                              disabled={ipCurrentPage === 1}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              上一页
                            </button>
                            <button
                              onClick={() => setIpCurrentPage(p => Math.min(ipTotalPages, p + 1))}
                              disabled={ipCurrentPage === ipTotalPages}
                              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
          )}
        </div>
      </div>

      {/* 添加账户模态框 */}
      {showAddAccountModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">添加账户到黑名单</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={newAccountEmail}
                  onChange={(e) => setNewAccountEmail(e.target.value)}
                  placeholder="例如: user@example.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">输入要封禁的账户邮箱地址</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddAccountModal(false)
                  setNewAccountEmail('')
                  setAccountError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddAccount}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
              >
                确认封禁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加IP模态框 */}
      {showAddIpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">添加IP到黑名单</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IP地址 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newIpAddress}
                  onChange={(e) => setNewIpAddress(e.target.value)}
                  placeholder="例如: 192.168.1.1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  拉黑原因（可选）
                </label>
                <textarea
                  value={newIpReason}
                  onChange={(e) => setNewIpReason(e.target.value)}
                  placeholder="请输入拉黑原因..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddIpModal(false)
                  setNewIpAddress('')
                  setNewIpReason('')
                  setIpError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddIP}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmDialog.show && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          style={{ animation: 'fadeInUp 0.2s ease-out forwards' }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            style={{ animation: 'scaleIn 0.15s ease-out forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 图标 */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100">
              <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            {/* 标题 */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              {confirmDialog.title}
            </h3>
            
            {/* 消息 */}
            <p className="text-gray-600 text-center mb-6">
              {confirmDialog.message}
            </p>
            
            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-200"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

