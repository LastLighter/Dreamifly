'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import Image from 'next/image'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import PointsTotalRanking from '@/components/admin/PointsTotalRanking'
import PointsConsumeRanking from '@/components/admin/PointsConsumeRanking'

type PointsTab = 'consume' | 'total'
type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

export default function PointsAdminPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  const [activeTab, setActiveTab] = useState<PointsTab>('consume')
  const [timeRange, setTimeRange] = useState<TimeRange>('week')

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

  // 获取当前用户完整信息（包括头像）
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
                      d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14m0-6c1.11 0 2.08.402 2.6 1M12 8V6m0 8v2m8-4a8 8 0 11-16 0 8 8 0 0116 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    积分管理
                  </h1>
                  <p className="text-xs text-gray-500 -mt-0.5">积分消耗与总额统计</p>
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

        {/* 内容区域 */}
        <div className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Tab 切换 + 时间范围选择 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
              {/* 主 Tab：消耗 / 总额 */}
              <div className="flex gap-2 border-b border-gray-200 pb-1">
                <button
                  onClick={() => setActiveTab('consume')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'consume'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  积分消耗排名
                </button>
                <button
                  onClick={() => setActiveTab('total')}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === 'total'
                      ? 'border-orange-500 text-orange-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  积分总额排名
                </button>
              </div>

              {/* 时间范围 Tab（参考数据统计页的划分），当前只用于“积分消耗排名” */}
              {activeTab === 'consume' && (
                <div className="flex items-center justify-between gap-4 flex-wrap pt-1">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">时间范围：</span>
                    <div className="flex flex-wrap gap-2">
                      {(['hour', 'today', 'yesterday', 'week', 'month', 'all'] as TimeRange[]).map(
                        (range) => (
                          <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                              timeRange === range
                                ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {range === 'hour'
                              ? '近一小时'
                              : range === 'today'
                              ? '今天'
                              : range === 'yesterday'
                              ? '昨天'
                              : range === 'week'
                              ? '最近一周'
                              : range === 'month'
                              ? '最近一月'
                              : '全部'}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 内容区域 */}
            {activeTab === 'consume' ? <PointsConsumeRanking timeRange={timeRange} /> : <PointsTotalRanking />}
          </div>
        </div>
      </div>
    </div>
  )
}


