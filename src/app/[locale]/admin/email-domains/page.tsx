'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import AvatarWithFrame from '@/components/AvatarWithFrame'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

interface EmailDomain {
  id: number
  domain: string
  isEnabled: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export default function EmailDomainsPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar, avatarFrameId } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  
  const [domains, setDomains] = useState<EmailDomain[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // 添加/编辑模态框状态
  const [showModal, setShowModal] = useState(false)
  const [editingDomain, setEditingDomain] = useState<EmailDomain | null>(null)
  const [formDomain, setFormDomain] = useState('')
  const [formIsEnabled, setFormIsEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  // 获取当前用户完整信息（包括头像）
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  
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

  // 获取邮箱域名列表
  const fetchDomains = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/allowed-email-domains?t=${Date.now()}`)
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          router.push('/')
          return
        }
        throw new Error('获取邮箱域名列表失败')
      }

      const data = await response.json()
      setDomains(data.domains || [])
    } catch (err) {
      console.error('Error fetching email domains:', err)
      setError(err instanceof Error ? err.message : '获取邮箱域名列表失败')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchDomains()
    }
  }, [isAdmin, checkingAdmin, fetchDomains])

  // 打开添加模态框
  const handleOpenAddModal = () => {
    setEditingDomain(null)
    setFormDomain('')
    setFormIsEnabled(true)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  // 打开编辑模态框
  const handleOpenEditModal = (domain: EmailDomain) => {
    setEditingDomain(domain)
    setFormDomain(domain.domain)
    setFormIsEnabled(domain.isEnabled)
    setShowModal(true)
    setError('')
    setSuccess('')
  }

  // 关闭模态框
  const handleCloseModal = () => {
    setShowModal(false)
    setEditingDomain(null)
    setFormDomain('')
    setFormIsEnabled(true)
    setError('')
    setSuccess('')
  }

  // 保存域名
  const handleSaveDomain = async () => {
    if (!formDomain.trim()) {
      setError('请输入邮箱域名')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const url = '/api/admin/allowed-email-domains'
      const method = editingDomain ? 'PATCH' : 'POST'
      const body = editingDomain
        ? { id: editingDomain.id, domain: formDomain.trim(), isEnabled: formIsEnabled }
        : { domain: formDomain.trim(), isEnabled: formIsEnabled }

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

      setSuccess(editingDomain ? '更新成功' : '添加成功')
      setTimeout(() => {
        handleCloseModal()
        fetchDomains()
      }, 1000)
    } catch (err) {
      console.error('Error saving email domain:', err)
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 切换启用状态
  const handleToggleEnabled = async (domain: EmailDomain) => {
    try {
      const response = await fetch('/api/admin/allowed-email-domains', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: domain.id,
          isEnabled: !domain.isEnabled,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '更新失败')
      }

      setSuccess('更新成功')
      setTimeout(() => {
        setSuccess('')
        fetchDomains()
      }, 2000)
    } catch (err) {
      console.error('Error toggling domain enabled:', err)
      setError(err instanceof Error ? err.message : '更新失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  // 删除域名
  const handleDeleteDomain = async (domain: EmailDomain) => {
    if (!confirm(`确定要删除邮箱域名 "${domain.domain}" 吗？`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/allowed-email-domains?id=${domain.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '删除失败')
      }

      setSuccess('删除成功')
      setTimeout(() => {
        setSuccess('')
        fetchDomains()
      }, 2000)
    } catch (err) {
      console.error('Error deleting domain:', err)
      setError(err instanceof Error ? err.message : '删除失败')
      setTimeout(() => setError(''), 3000)
    }
  }

  // 格式化日期
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-'
    const d = new Date(date)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">邮箱域名管理</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">管理允许注册的邮箱域名</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/80 rounded-lg border border-orange-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                {(() => {
                  const avatarSrc = currentUserAvatar || globalAvatar || (session?.user as ExtendedUser)?.avatar || session?.user?.image || '/images/default-avatar.svg'
                  const normalizedAvatarSrc = avatarSrc.startsWith('http') || avatarSrc.startsWith('/') 
                    ? avatarSrc 
                    : `/${avatarSrc}`
                  
                  return (
                    <AvatarWithFrame
                      avatar={normalizedAvatarSrc}
                      avatarFrameId={avatarFrameId}
                      size={36}
                      className="border-2 border-orange-400/40 shadow-sm"
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
              {/* 操作栏 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    共 {domains.length} 个邮箱域名，其中 {domains.filter(d => d.isEnabled).length} 个已启用
                  </div>
                  <button
                    onClick={handleOpenAddModal}
                    className="px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    添加域名
                  </button>
                </div>
              </div>

              {/* 错误/成功提示 */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                  {success}
                </div>
              )}
            </div>
          </div>

          {/* 域名列表 - 可滚动区域 */}
          <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-4 pt-0">
            <div className="max-w-7xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                    <p className="text-gray-600">加载中...</p>
                  </div>
                ) : domains.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    暂无邮箱域名，点击&nbsp;&quot;添加域名&quot;&nbsp;按钮添加
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            域名
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
                        {domains.map((domain) => (
                          <tr key={domain.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{domain.domain}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {domain.isEnabled ? (
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
                              {formatDate(domain.createdAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(domain.updatedAt)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleEnabled(domain)}
                                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    domain.isEnabled
                                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                                  }`}
                                >
                                  {domain.isEnabled ? '禁用' : '启用'}
                                </button>
                                <button
                                  onClick={() => handleOpenEditModal(domain)}
                                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                                >
                                  编辑
                                </button>
                                <button
                                  onClick={() => handleDeleteDomain(domain)}
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
          </div>
        </div>
      </div>

      {/* 添加/编辑模态框 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingDomain ? '编辑邮箱域名' : '添加邮箱域名'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                {success}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="domain" className="block text-sm font-medium text-gray-700 mb-2">
                  邮箱域名
                </label>
                <input
                  id="domain"
                  type="text"
                  value={formDomain}
                  onChange={(e) => setFormDomain(e.target.value)}
                  placeholder="例如: example.com"
                  disabled={saving}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">请输入邮箱域名，例如: gmail.com</p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsEnabled}
                    onChange={(e) => setFormIsEnabled(e.target.checked)}
                    disabled={saving}
                    className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                  />
                  <span className="text-sm text-gray-700">启用此域名</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                disabled={saving}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button
                onClick={handleSaveDomain}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
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
  )
}

