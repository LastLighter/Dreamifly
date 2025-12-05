'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import Image from 'next/image'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts'

type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

interface UserCallRanking {
  userId: string
  userName: string | null
  userEmail: string
  userNickname: string | null
  isAdmin: boolean
  isPremium: boolean
  isOldUser: boolean
  isActive: boolean
  dailyRequestCount: number
  maxDailyLimit: number | null
  callCount: number
}

interface IPRanking {
  ipAddress: string | null
  callCount: number
  authenticatedCount?: number
  unauthenticatedCount?: number
  userCount?: number
  maxHourlyCallCount?: number
}

interface CrawlerAnalysisData {
  timeRange: TimeRange
  userCallRanking: UserCallRanking[]
  allIPRanking: IPRanking[]
  authenticatedIPRanking: IPRanking[]
  unauthenticatedIPRanking: IPRanking[]
}

export default function CrawlerAnalysisPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('today')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CrawlerAnalysisData | null>(null)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'users' | 'all-ip' | 'auth-ip' | 'unauth-ip'>('users')
  
  // 详情模态框状态
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [detailType, setDetailType] = useState<'user' | 'ip'>('user')
  const [detailTitle, setDetailTitle] = useState<string>('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailData, setDetailData] = useState<{
    timeDistribution: Array<{ date: string; hour: number; count: number }>
    modelDistribution: Array<{ modelName: string; count: number }>
    ipUsers?: Array<{ userId: string; userName: string | null; userEmail: string; userNickname: string | null; isActive: boolean; isAdmin: boolean; callCount: number }>
    dailyDistribution?: Array<{ date: string; total: number; authenticated: number; unauthenticated: number }>
    dailyHourlyDistribution?: Array<{ date: string; hour: number; total: number; authenticated?: number; unauthenticated?: number }>
  } | null>(null)
  const [detailActiveTab, setDetailActiveTab] = useState<'users' | 'all-ip' | 'auth-ip' | 'unauth-ip'>('users')
  
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

  // 获取当前用户完整信息（包括头像）
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user) return
      
      try {
        const response = await fetch('/api/admin/users')
        if (response.ok) {
          const userData = await response.json()
          const currentUser = userData.users?.find((u: any) => u.id === session.user.id)
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
        const response = await fetch('/api/admin/check')
        const adminData = await response.json()
        if (!adminData.isAdmin) {
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

  // 获取爬虫分析数据
  const fetchData = async () => {
    if (!isAdmin || checkingAdmin) return

    try {
      setLoading(true)
      const response = await fetch(`/api/admin/crawler-analysis?timeRange=${timeRange}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch crawler analysis data')
      }
      
      const analysisData: CrawlerAnalysisData = await response.json()
      setData(analysisData)
    } catch (error) {
      console.error('Error fetching crawler analysis:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, checkingAdmin, timeRange])

  // 打开详情模态框
  const openDetailModal = useCallback(async (type: 'user' | 'ip', identifier: string, title: string) => {
    setDetailType(type)
    setDetailTitle(title)
    setDetailModalOpen(true)
    setDetailLoading(true)
    setDetailData(null)
    setDetailActiveTab(activeTab) // 保存当前激活的tab

    try {
      const response = await fetch(
        `/api/admin/crawler-analysis/detail?type=${type}&identifier=${encodeURIComponent(identifier)}&timeRange=${timeRange}`,
        {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
          },
        }
      )

      if (!response.ok) {
        throw new Error('Failed to fetch detail')
      }

      const detailResponse = await response.json()
      setDetailData({
        timeDistribution: detailResponse.timeDistribution || [],
        modelDistribution: detailResponse.modelDistribution || [],
        ipUsers: detailResponse.ipUsers || [],
        dailyDistribution: detailResponse.dailyDistribution || [],
        dailyHourlyDistribution: detailResponse.dailyHourlyDistribution || [],
      })
    } catch (error) {
      console.error('Error fetching detail:', error)
    } finally {
      setDetailLoading(false)
    }
  }, [timeRange, activeTab])

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

  // 封禁/解封用户
  const handleToggleUserActive = (userId: string, currentIsActive: boolean, isAdmin: boolean) => {
    if (isAdmin) {
      showConfirmDialog(
        '无法操作',
        '无法封禁管理员账号',
        () => {}
      )
      return
    }

    const action = currentIsActive ? '封禁' : '解封'
    showConfirmDialog(
      `确认${action}`,
      `确定要${action}该用户吗？${currentIsActive ? '封禁后用户将无法发起生图请求和签到获得积分。' : '解封后用户将恢复为活跃状态。'}`,
      async () => {
        try {
          const response = await fetch(`/api/admin/users?_t=${Date.now()}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
              userId,
              isActive: !currentIsActive,
            }),
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || `${action}失败`)
          }

          // 刷新详情数据
          if (detailType === 'ip' && detailTitle) {
            const identifier = detailTitle.replace(' - 详情', '')
            await openDetailModal('ip', identifier, detailTitle)
          }
        } catch (error: any) {
          console.error(`Error ${action} user:`, error)
          showConfirmDialog(
            '操作失败',
            error.message || `${action}用户失败`,
            () => {}
          )
        }
      }
    )
  }

  // 格式化时间分布数据用于图表
  // 对于hour范围，按分钟显示；其他范围按小时汇总显示
  const formatTimeDistribution = () => {
    if (!detailData?.timeDistribution) return []

    if (timeRange === 'hour') {
      // 按分钟显示：直接使用数据，格式化为 HH:mm
      return detailData.timeDistribution.map((item) => {
        const date = new Date(item.date)
        const hour = date.getHours()
        const minute = item.hour // 在hour范围下，hour字段存储的是分钟数
        return {
          hour: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
          count: item.count,
        }
      }).sort((a, b) => a.hour.localeCompare(b.hour))
    } else {
      // 按小时汇总所有日期的数据
      const hourMap = new Map<number, number>()
      
      detailData.timeDistribution.forEach((item) => {
        const currentCount = hourMap.get(item.hour) || 0
        hourMap.set(item.hour, currentCount + item.count)
      })

      // 转换为数组格式，按小时排序
      const result: Array<{ hour: string; count: number }> = []
      for (let hour = 0; hour < 24; hour++) {
        result.push({
          hour: `${hour}时`,
          count: hourMap.get(hour) || 0,
        })
      }

      return result
    }
  }

  // 模型颜色配置
  const MODEL_COLORS = [
    '#f97316', '#fb923c', '#ea580c', '#fbbf24', '#fdba74',
    '#c2410c', '#f59e0b', '#9a3412', '#f97316', '#fb923c',
  ]

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">爬虫分析</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">用户与IP调用分析</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-white/80 rounded-lg border border-orange-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                {(() => {
                  const avatarSrc = currentUserAvatar || globalAvatar || (session?.user as ExtendedUser)?.avatar || session?.user?.image || '/images/default-avatar.svg'
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

        <div className="p-4 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* 时间范围选择 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">时间范围：</span>
                  <div className="flex gap-2">
                    {(['hour', 'today', 'yesterday', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          timeRange === range
                            ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {range === 'hour' ? '近一小时' : range === 'today' ? '今天' : range === 'yesterday' ? '昨天' : range === 'week' ? '最近一周' : range === 'month' ? '最近一月' : '全部'}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    loading
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-400 to-amber-400 text-white hover:from-orange-500 hover:to-amber-500'
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>加载中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>刷新</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                  <p className="text-gray-600">加载中...</p>
                </div>
              </div>
            ) : !data ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
                <div className="text-center text-gray-500">
                  <p className="text-lg font-medium">暂无数据</p>
                  <p className="mt-2 text-sm">选择的时间范围内没有统计数据</p>
                </div>
              </div>
            ) : (
              <>
                {/* 标签页切换 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex gap-2 border-b border-gray-200">
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'users'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      登录用户排名 ({data.userCallRanking.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('all-ip')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'all-ip'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      全部IP排名 ({data.allIPRanking.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('auth-ip')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'auth-ip'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      登录用户IP排名 ({data.authenticatedIPRanking.length})
                    </button>
                    <button
                      onClick={() => setActiveTab('unauth-ip')}
                      className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === 'unauth-ip'
                          ? 'border-orange-500 text-orange-600'
                          : 'border-transparent text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      未登录用户IP排名 ({data.unauthenticatedIPRanking.length})
                    </button>
                  </div>
                </div>

                {/* 登录用户调用次数排名 */}
                {activeTab === 'users' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">登录用户调用次数排名</h2>
                      <p className="text-sm text-gray-500 mt-1">显示登录用户的API调用次数排名（前100名）</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户信息</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">身份标识</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">今日额度</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">调用次数</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.userCallRanking.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                                暂无数据
                              </td>
                            </tr>
                          ) : (
                            data.userCallRanking.map((user, index) => (
                              <tr key={user.userId} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                    index === 1 ? 'bg-gray-100 text-gray-800' :
                                    index === 2 ? 'bg-orange-100 text-orange-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.userName || user.userNickname || '未设置名称'}
                                  </div>
                                  {user.userNickname && user.userName && user.userNickname !== user.userName && (
                                    <div className="text-sm text-gray-500">
                                      ({user.userNickname})
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {user.userEmail}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {user.isAdmin ? (
                                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-400 to-amber-400 text-white">
                                        管理员
                                      </span>
                                    ) : user.isPremium ? (
                                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                        优质用户
                                      </span>
                                    ) : user.isOldUser ? (
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
                                  <div className="flex items-center gap-2">
                                    {user.isActive ? (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        活跃
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                        已封禁
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-blue-600">
                                    {user.dailyRequestCount.toLocaleString()} / {user.maxDailyLimit === null ? '∞' : user.maxDailyLimit.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-orange-600">
                                    {user.callCount.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => openDetailModal('user', user.userId, `${user.userName || user.userNickname || user.userEmail} - 详情`)}
                                    className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    查看详情
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 全部IP调用次数排名 */}
                {activeTab === 'all-ip' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">全部IP调用次数排名</h2>
                      <p className="text-sm text-gray-500 mt-1">显示所有IP地址的API调用次数排名（前100名）</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总调用次数</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">登录用户调用</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">未登录用户调用</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">登录用户数量</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.allIPRanking.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                                暂无数据
                              </td>
                            </tr>
                          ) : (
                            data.allIPRanking.map((ip, index) => (
                              <tr key={ip.ipAddress} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                    index === 1 ? 'bg-gray-100 text-gray-800' :
                                    index === 2 ? 'bg-orange-100 text-orange-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-gray-900">
                                      {ip.ipAddress || '未知'}
                                    </span>
                                    {(ip.ipAddress === '127.0.0.1' || ip.ipAddress === '::1') && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                        本地
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-orange-600">
                                    {ip.callCount.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {ip.authenticatedCount?.toLocaleString() || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {ip.unauthenticatedCount?.toLocaleString() || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-blue-600">
                                    {ip.userCount?.toLocaleString() || 0}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => openDetailModal('ip', ip.ipAddress || '', `${ip.ipAddress || '未知IP'} - 详情`)}
                                    className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    查看详情
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 登录用户IP调用次数排名 */}
                {activeTab === 'auth-ip' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">登录用户IP调用次数排名</h2>
                      <p className="text-sm text-gray-500 mt-1">仅显示登录用户的IP地址调用次数排名（前100名）</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">调用次数</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">登录用户数量</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.authenticatedIPRanking.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                暂无数据
                              </td>
                            </tr>
                          ) : (
                            data.authenticatedIPRanking.map((ip, index) => (
                              <tr key={ip.ipAddress} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                    index === 1 ? 'bg-gray-100 text-gray-800' :
                                    index === 2 ? 'bg-orange-100 text-orange-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-gray-900">
                                      {ip.ipAddress || '未知'}
                                    </span>
                                    {(ip.ipAddress === '127.0.0.1' || ip.ipAddress === '::1') && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                        本地
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-orange-600">
                                    {ip.callCount.toLocaleString()}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-blue-600">
                                    {ip.userCount?.toLocaleString() || 0}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => openDetailModal('ip', ip.ipAddress || '', `${ip.ipAddress || '未知IP'} - 详情`)}
                                    className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    查看详情
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 未登录用户IP调用次数排名 */}
                {activeTab === 'unauth-ip' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-semibold text-gray-900">未登录用户IP调用次数排名</h2>
                      <p className="text-sm text-gray-500 mt-1">仅显示未登录用户的IP地址调用次数排名（前100名）</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">调用次数</th>
                            {data.timeRange === 'today' && (
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">单小时最高调用次数</th>
                            )}
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.unauthenticatedIPRanking.length === 0 ? (
                            <tr>
                              <td colSpan={data.timeRange === 'today' ? 5 : 4} className="px-6 py-8 text-center text-gray-500">
                                暂无数据
                              </td>
                            </tr>
                          ) : (
                            data.unauthenticatedIPRanking.map((ip, index) => (
                              <tr key={ip.ipAddress} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-800' :
                                    index === 1 ? 'bg-gray-100 text-gray-800' :
                                    index === 2 ? 'bg-orange-100 text-orange-800' :
                                    'bg-blue-100 text-blue-800'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-gray-900">
                                      {ip.ipAddress || '未知'}
                                    </span>
                                    {(ip.ipAddress === '127.0.0.1' || ip.ipAddress === '::1') && (
                                      <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                                        本地
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="text-sm font-semibold text-orange-600">
                                    {ip.callCount.toLocaleString()}
                                  </span>
                                </td>
                                {data.timeRange === 'today' && (
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="text-sm font-semibold text-red-600">
                                      {ip.maxHourlyCallCount?.toLocaleString() || 0}
                                    </span>
                                  </td>
                                )}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <button
                                    onClick={() => openDetailModal('ip', ip.ipAddress || '', `${ip.ipAddress || '未知IP'} - 详情`)}
                                    className="px-3 py-1.5 text-xs font-medium text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    查看详情
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 详情模态框 */}
      {detailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 模态框头部 */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{detailTitle}</h2>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 模态框内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                    <p className="text-gray-600">加载中...</p>
                  </div>
                </div>
              ) : !detailData ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-gray-500">暂无数据</p>
                </div>
              ) : (
                <>
                  {/* 最近一周每日调用趋势（折线图） */}
                  {timeRange === 'week' && detailData.dailyDistribution && detailData.dailyDistribution.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">最近七天每日调用趋势</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={detailData.dailyDistribution.map(item => ({
                          date: new Date(item.date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
                          total: item.total,
                          authenticated: item.authenticated,
                          unauthenticated: item.unauthenticated,
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#6b7280"
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                          />
                          <YAxis 
                            stroke="#6b7280"
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              padding: '8px 12px'
                            }}
                          />
                          <Legend />
                          {detailType === 'ip' && detailActiveTab === 'all-ip' ? (
                            <>
                              <Line 
                                type="monotone" 
                                dataKey="total" 
                                stroke="#f97316" 
                                strokeWidth={2}
                                name="总请求"
                                dot={{ fill: '#f97316', r: 4 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="authenticated" 
                                stroke="#10b981" 
                                strokeWidth={2}
                                name="登录用户请求"
                                dot={{ fill: '#10b981', r: 4 }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="unauthenticated" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                name="未登录用户请求"
                                dot={{ fill: '#3b82f6', r: 4 }}
                              />
                            </>
                          ) : (
                            <Line 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#f97316" 
                              strokeWidth={2}
                              name="调用次数"
                              dot={{ fill: '#f97316', r: 4 }}
                            />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* 近七天每日按小时折线图 */}
                  {timeRange === 'week' && detailData.dailyHourlyDistribution && detailData.dailyHourlyDistribution.length > 0 && (() => {
                    // 按日期分组数据
                    const dateMap = new Map<string, Array<{ hour: number; total: number; authenticated: number; unauthenticated: number }>>()
                    
                    detailData.dailyHourlyDistribution.forEach((item) => {
                      if (!dateMap.has(item.date)) {
                        dateMap.set(item.date, [])
                      }
                      dateMap.get(item.date)!.push({
                        hour: item.hour,
                        total: item.total,
                        authenticated: item.authenticated || 0,
                        unauthenticated: item.unauthenticated || 0,
                      })
                    })

                    // 获取所有日期并排序
                    const dates = Array.from(dateMap.keys()).sort()
                    
                    // 为每一天生成完整24小时的数据
                    const dateDataMap = new Map<string, Array<{ hour: number; total: number; authenticated: number; unauthenticated: number }>>()
                    
                    dates.forEach((date) => {
                      const hourlyData = new Map<number, { total: number; authenticated: number; unauthenticated: number }>()
                      dateMap.get(date)!.forEach((item) => {
                        hourlyData.set(item.hour, {
                          total: item.total,
                          authenticated: item.authenticated,
                          unauthenticated: item.unauthenticated,
                        })
                      })
                      
                      // 生成24小时的完整数据
                      const fullDayData = Array.from({ length: 24 }, (_, hour) => ({
                        hour,
                        total: hourlyData.get(hour)?.total || 0,
                        authenticated: hourlyData.get(hour)?.authenticated || 0,
                        unauthenticated: hourlyData.get(hour)?.unauthenticated || 0,
                      }))
                      
                      dateDataMap.set(date, fullDayData)
                    })

                    // 定义7种颜色用于区分不同的日期
                    const dateColors = [
                      '#f97316', // 橙色
                      '#3b82f6', // 蓝色
                      '#10b981', // 绿色
                      '#f59e0b', // 黄色
                      '#8b5cf6', // 紫色
                      '#ef4444', // 红色
                      '#06b6d4', // 青色
                    ]

                    return (
                      <div className="bg-gray-50 rounded-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">近七天每日按小时调用趋势</h3>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="hour" 
                              stroke="#6b7280"
                              tick={{ fill: '#6b7280', fontSize: 11 }}
                              label={{ value: '小时', position: 'insideBottom', offset: -5, style: { fill: '#6b7280' } }}
                              type="number"
                              domain={[0, 23]}
                              ticks={[0, 4, 8, 12, 16, 20, 23]}
                            />
                            <YAxis 
                              stroke="#6b7280"
                              tick={{ fill: '#6b7280', fontSize: 12 }}
                              label={{ value: '调用次数', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                padding: '8px 12px'
                              }}
                              formatter={(value: any) => value.toLocaleString()}
                            />
                            <Legend />
                            {/* 每天显示一条线（总请求） */}
                            {dates.map((date, dateIndex) => {
                              const dateStr = new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
                              const dayData = dateDataMap.get(date)!
                              const color = dateColors[dateIndex % dateColors.length]
                              
                              return (
                                <Line 
                                  key={date}
                                  type="monotone" 
                                  dataKey="total" 
                                  stroke={color}
                                  strokeWidth={2}
                                  name={dateStr}
                                  dot={{ fill: color, r: 3 }}
                                  data={dayData}
                                />
                              )
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          显示近七天每天在不同小时的调用次数，每天一条线（总请求）
                        </p>
                      </div>
                    )
                  })()}

                  {/* 调用时间分布 */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {timeRange === 'hour' ? '调用时间分布（按分钟）' : '调用时间分布（按小时）'}
                    </h3>
                    {detailData.timeDistribution.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">暂无时间分布数据</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={formatTimeDistribution()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="hour" 
                            stroke="#6b7280"
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                          />
                          <YAxis 
                            stroke="#6b7280"
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                          />
                          <Tooltip 
                            contentStyle={{
                              backgroundColor: 'white',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                              padding: '8px 12px'
                            }}
                          />
                          <Bar 
                            dataKey="count" 
                            fill="#f97316"
                            name="调用次数"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* IP对应的用户信息（仅IP详情显示） */}
                  {detailType === 'ip' && detailData.ipUsers && detailData.ipUsers.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">使用该IP的登录用户</h3>
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户信息</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">调用次数</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">占比</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {detailData.ipUsers.map((ipUser) => {
                                const totalCalls = detailData.ipUsers!.reduce((sum, user) => sum + user.callCount, 0)
                                const percentage = totalCalls > 0 ? (ipUser.callCount / totalCalls) * 100 : 0
                                
                                return (
                                  <tr key={ipUser.userId} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">
                                        {ipUser.userName || ipUser.userNickname || '未设置名称'}
                                      </div>
                                      {ipUser.userNickname && ipUser.userName && ipUser.userNickname !== ipUser.userName && (
                                        <div className="text-sm text-gray-500">
                                          ({ipUser.userNickname})
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                      {ipUser.userEmail}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className="text-sm font-semibold text-orange-600">
                                        {ipUser.callCount.toLocaleString()}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden max-w-[100px]">
                                          <div 
                                            className="bg-orange-600 h-2 rounded-full transition-all"
                                            style={{ width: `${percentage}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-semibold text-gray-700 min-w-[45px]">
                                          {percentage.toFixed(1)}%
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center gap-2">
                                        {ipUser.isActive ? (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            活跃
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            已封禁
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                      {!ipUser.isAdmin && (
                                        <button
                                          onClick={() => handleToggleUserActive(ipUser.userId, ipUser.isActive, ipUser.isAdmin)}
                                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                            ipUser.isActive
                                              ? 'text-red-600 bg-red-50 hover:bg-red-100'
                                              : 'text-green-600 bg-green-50 hover:bg-green-100'
                                          }`}
                                        >
                                          {ipUser.isActive ? '封禁' : '解封'}
                                        </button>
                                      )}
                                      {ipUser.isAdmin && (
                                        <span className="text-xs text-gray-400">管理员</span>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 调用模型分布 */}
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">调用模型分布</h3>
                    {detailData.modelDistribution.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">暂无模型分布数据</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* 饼图 */}
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={detailData.modelDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={(entry: any) => {
                                const { name, percent } = entry
                                if (percent < 0.05) return ''
                                return `${name}: ${(percent * 100).toFixed(1)}%`
                              }}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="count"
                              stroke="#fff"
                              strokeWidth={2}
                            >
                              {detailData.modelDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={MODEL_COLORS[index % MODEL_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* 列表 */}
                        <div className="space-y-2">
                          {detailData.modelDistribution.map((model, index) => (
                            <div key={model.modelName} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-4 h-4 rounded-sm flex-shrink-0" 
                                  style={{ backgroundColor: MODEL_COLORS[index % MODEL_COLORS.length] }}
                                />
                                <span className="text-sm font-medium text-gray-900">{model.modelName}</span>
                              </div>
                              <span className="text-sm font-semibold text-orange-600">
                                {model.count.toLocaleString()} 次
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 确认对话框 */}
      {confirmDialog.show && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
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

