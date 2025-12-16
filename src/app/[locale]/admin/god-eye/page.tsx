'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import Image from 'next/image'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

type TabType = 'approved' | 'rejected'

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
            <div className="bg-white rounded-xl p-12 text-center border border-gray-200 shadow-sm">
              <div className="flex flex-col items-center justify-center">
                <svg
                  className="w-16 h-16 text-gray-400 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <p className="text-lg font-medium text-gray-700 mb-2">功能正在开发中</p>
                <p className="text-sm text-gray-500">
                  {activeTab === 'approved' ? '通过审核图片' : '未通过审核图片'}功能即将上线
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

