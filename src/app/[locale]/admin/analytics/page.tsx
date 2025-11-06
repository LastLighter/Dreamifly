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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

type TimeRange = 'hour' | 'today' | 'week' | 'month' | 'all'

interface ModelStat {
  modelName: string
  totalCalls: number
  authenticatedCalls: number
  unauthenticatedCalls: number
  avgResponseTimeAuthenticated: number | null
  avgResponseTimeUnauthenticated: number | null
}

interface DailyData {
  date: string
  modelName: string
  count: number
}

interface TotalStats {
  totalCalls: number
  authenticatedCalls: number
  unauthenticatedCalls: number
}

interface DailyTrend {
  date: string
  total: number
  authenticated: number
  unauthenticated: number
}

interface StatsResponse {
  timeRange: TimeRange
  modelStats: ModelStat[]
  dailyData: DailyData[]
  totalStats: TotalStats
  dailyTrend: DailyTrend[]
}

// 为不同模型定义清晰的颜色方案（参考网站橙色系主题）
const MODEL_COLORS: { [key: string]: string } = {
  'HiDream-full-fp8': '#f97316',      // 主橙色 (orange-500)
  'Flux-Dev': '#fb923c',               // 亮橙色 (orange-400)
  'Flux-Kontext': '#ea580c',          // 深橙色 (orange-600)
  'Stable-Diffusion-3.5': '#fbbf24',  // 琥珀色 (amber-400)
  'Flux-Krea': '#fdba74',              // 浅橙色 (orange-300)
  'Qwen-Image': '#c2410c',            // 深橙红色 (orange-700)
  'Qwen-Image-Edit': '#f59e0b',       // 暖琥珀色 (amber-500)
  'Wai-SDXL-V150': '#ea580c',          // 橙红色 (orange-600)
}

// 备用颜色列表（暖色系，用于未知模型）
const FALLBACK_COLORS = [
  '#f97316', // orange-500
  '#fb923c', // orange-400
  '#ea580c', // orange-600
  '#fbbf24', // amber-400
  '#fdba74', // orange-300
  '#c2410c', // orange-700
  '#f59e0b', // amber-500
  '#9a3412', // orange-800
]

// 获取模型颜色
const getModelColor = (modelName: string, index: number = 0): string => {
  return MODEL_COLORS[modelName] || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
}

export default function AnalyticsPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('week')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [statsCache, setStatsCache] = useState<Record<TimeRange, StatsResponse | null>>({
    hour: null,
    today: null,
    week: null,
    month: null,
    all: null,
  })
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')

  // 获取当前用户完整信息（包括头像）
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!session?.user) return
      
      try {
        const response = await fetch('/api/admin/users')
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

  // 获取单个时间范围的统计数据
  const fetchStatsForRange = async (range: TimeRange): Promise<StatsResponse | null> => {
    try {
      const response = await fetch(`/api/admin/model-stats?timeRange=${range}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      })
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      const data: StatsResponse = await response.json()
      return data
    } catch (error) {
      console.error(`Error fetching stats for ${range}:`, error)
      return null
    }
  }

  // 获取所有时间范围的数据（初始加载和手动同步）
  const fetchAllStats = useCallback(async (isSync = false) => {
    if (!isAdmin || checkingAdmin) return

    try {
      if (isSync) {
        setSyncing(true)
      } else {
        setLoading(true)
      }

      // 并行获取所有时间范围的数据
      const [hourData, todayData, weekData, monthData, allData] = await Promise.all([
        fetchStatsForRange('hour'),
        fetchStatsForRange('today'),
        fetchStatsForRange('week'),
        fetchStatsForRange('month'),
        fetchStatsForRange('all'),
      ])

      // 更新缓存
      const newCache = {
        hour: hourData,
        today: todayData,
        week: weekData,
        month: monthData,
        all: allData,
      }
      setStatsCache(newCache)

      // 设置当前选择的时间范围的数据
      setStats(newCache[timeRange])
    } catch (error) {
      console.error('Error fetching all stats:', error)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [isAdmin, checkingAdmin, timeRange])

  // 初始加载时获取所有数据
  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchAllStats(false)
    }
  }, [isAdmin, checkingAdmin, fetchAllStats])

  // 切换时间范围时使用缓存数据
  useEffect(() => {
    if (statsCache[timeRange]) {
      setStats(statsCache[timeRange])
    }
  }, [timeRange, statsCache])

  // 格式化每日数据用于图表
  const formatDailyData = () => {
    if (!stats?.dailyData) return []

    // 按日期和模型分组
    const dateMap = new Map<string, { [key: string]: number }>()

    stats.dailyData.forEach((item) => {
      // 对于hour范围，保留完整时间戳（包括分钟）；today范围保留小时信息；其他范围只取日期部分
      const date = timeRange === 'hour' 
        ? item.date // 保留完整时间戳
        : timeRange === 'today'
        ? item.date // 保留完整时间戳（包括小时）
        : item.date.split('T')[0] // 只取日期部分
      if (!dateMap.has(date)) {
        dateMap.set(date, {})
      }
      dateMap.get(date)![item.modelName] = item.count
    })

    // 转换为数组格式
    const result: Array<{ date: string; [key: string]: number | string }> = []
    dateMap.forEach((models, date) => {
      const entry: { date: string; [key: string]: number | string } = { date }
      Object.keys(models).forEach((model) => {
        entry[model] = models[model]
      })
      result.push(entry)
    })

    return result.sort((a, b) => a.date.localeCompare(b.date))
  }

  // 准备饼图数据
  const pieChartData = stats?.modelStats.map((stat, index) => ({
    name: stat.modelName,
    value: stat.totalCalls,
    color: getModelColor(stat.modelName, index),
  })) || []

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">数据统计</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">系统数据分析</p>
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
                    {(['hour', 'today', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          timeRange === range
                            ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {range === 'hour' ? '近一小时' : range === 'today' ? '今天' : range === 'week' ? '最近一周' : range === 'month' ? '最近一月' : '全部'}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => fetchAllStats(true)}
                  disabled={syncing}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    syncing
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-400 to-amber-400 text-white hover:from-orange-500 hover:to-amber-500'
                  }`}
                >
                  {syncing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>同步中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>实时同步</span>
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
            ) : !stats || stats.modelStats.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <div className="text-center text-gray-500">
                  <p className="text-lg font-medium">暂无数据</p>
                  <p className="mt-2 text-sm">选择的时间范围内没有统计数据</p>
                </div>
              </div>
            ) : (
              <>
                {/* 总计模块 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {timeRange === 'hour' ? '近一小时总计' : timeRange === 'today' ? '今日总计' : timeRange === 'week' ? '最近一周总计' : timeRange === 'month' ? '最近一月总计' : '全部总计'}
                  </h2>
                  
                  {/* 总计卡片 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-6 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">总调用次数</p>
                          <p className="text-3xl font-bold text-orange-600">
                            {stats.totalStats.totalCalls.toLocaleString()}
                          </p>
                        </div>
                        <div className="p-3 bg-orange-100 rounded-lg">
                          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-600 mb-1">登录用户调用</p>
                          <p className="text-3xl font-bold text-blue-600 mb-2">
                            {stats.totalStats.authenticatedCalls.toLocaleString()}
                          </p>
                          {stats.totalStats.totalCalls > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-blue-100 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full transition-all"
                                  style={{ 
                                    width: `${(stats.totalStats.authenticatedCalls / stats.totalStats.totalCalls) * 100}%` 
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-blue-700">
                                {((stats.totalStats.authenticatedCalls / stats.totalStats.totalCalls) * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-blue-100 rounded-lg ml-4">
                          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg p-6 border border-gray-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-600 mb-1">未登录用户调用</p>
                          <p className="text-3xl font-bold text-gray-600 mb-2">
                            {stats.totalStats.unauthenticatedCalls.toLocaleString()}
                          </p>
                          {stats.totalStats.totalCalls > 0 && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="bg-gray-600 h-2 rounded-full transition-all"
                                  style={{ 
                                    width: `${(stats.totalStats.unauthenticatedCalls / stats.totalStats.totalCalls) * 100}%` 
                                  }}
                                />
                              </div>
                              <span className="text-xs font-semibold text-gray-700">
                                {((stats.totalStats.unauthenticatedCalls / stats.totalStats.totalCalls) * 100).toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-gray-100 rounded-lg ml-4">
                          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 占比饼图 */}
                  {stats.totalStats.totalCalls > 0 && (
                    <div className="bg-gray-50 rounded-lg p-6 mb-6">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">调用占比分布</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <div className="flex justify-center">
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: '登录用户', value: stats.totalStats.authenticatedCalls },
                                  { name: '未登录用户', value: stats.totalStats.unauthenticatedCalls },
                                ]}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry: any) => {
                                  const { name, percent } = entry
                                  return `${name}: ${(percent * 100).toFixed(1)}%`
                                }}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                stroke="#fff"
                                strokeWidth={2}
                              >
                                <Cell fill="#3b82f6" />
                                <Cell fill="#6b7280" />
                              </Pie>
                              <Tooltip 
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                  padding: '8px 12px'
                                }}
                                formatter={(value: number) => [
                                  `${value.toLocaleString()} 次`,
                                  '调用次数'
                                ]}
                              />
                              <Legend 
                                wrapperStyle={{ paddingTop: '20px' }}
                                iconType="circle"
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                              <span className="text-sm font-medium text-gray-900">登录用户</span>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-600">
                                {stats.totalStats.authenticatedCalls.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {((stats.totalStats.authenticatedCalls / stats.totalStats.totalCalls) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div className="w-4 h-4 rounded-full bg-gray-600"></div>
                              <span className="text-sm font-medium text-gray-900">未登录用户</span>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-600">
                                {stats.totalStats.unauthenticatedCalls.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {((stats.totalStats.unauthenticatedCalls / stats.totalStats.totalCalls) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 趋势折线图（hour按分钟显示，today按小时显示，week和month按天显示） */}
                  {(timeRange === 'hour' || timeRange === 'today' || timeRange === 'week' || timeRange === 'month') && stats.dailyTrend && stats.dailyTrend.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-md font-semibold text-gray-900 mb-4">调用趋势</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={stats.dailyTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="date" 
                            stroke="#6b7280"
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickFormatter={(value) => {
                              const date = new Date(value)
                              if (timeRange === 'hour') {
                                // 按分钟显示：HH:mm
                                return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                              } else if (timeRange === 'today') {
                                // 按小时显示：HH:00
                                return `${date.getHours().toString().padStart(2, '0')}:00`
                              } else {
                                // 按天显示：M/D
                                return `${date.getMonth() + 1}/${date.getDate()}`
                              }
                            }}
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
                            labelStyle={{ color: '#111827', fontWeight: 600 }}
                            itemStyle={{ color: '#374151' }}
                            labelFormatter={(value) => {
                              const date = new Date(value)
                              if (timeRange === 'hour') {
                                // 按分钟显示：完整日期时间
                                return date.toLocaleString('zh-CN', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              } else if (timeRange === 'today') {
                                // 按小时显示：完整日期和小时
                                return date.toLocaleString('zh-CN', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit'
                                })
                              } else {
                                // 按天显示：完整日期
                                return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                              }
                            }}
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="line"
                          />
                          <Line
                            type="monotone"
                            dataKey="total"
                            stroke="#f97316"
                            strokeWidth={2.5}
                            name="总调用次数"
                            dot={{ fill: '#f97316', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="authenticated"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            name="登录用户调用"
                            dot={{ fill: '#3b82f6', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="unauthenticated"
                            stroke="#6b7280"
                            strokeWidth={2.5}
                            name="未登录用户调用"
                            dot={{ fill: '#6b7280', r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* 模型调用次数柱状图 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">模型调用次数统计</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={stats.modelStats} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="modelName" 
                        stroke="#6b7280"
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
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
                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                        itemStyle={{ color: '#374151' }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="rect"
                      />
                      <Bar dataKey="authenticatedCalls" stackId="a" fill="#f97316" name="已登录用户" />
                      <Bar dataKey="unauthenticatedCalls" stackId="a" fill="#fb923c" name="未登录用户" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 模型调用趋势折线图 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">模型调用趋势</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={formatDailyData()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6b7280"
                        tick={{ fill: '#6b7280', fontSize: 12 }}
                        tickFormatter={(value) => {
                          if (timeRange === 'hour') {
                            // 按分钟显示：HH:mm
                            const date = new Date(value)
                            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
                          } else if (timeRange === 'today') {
                            // 按小时显示：HH:00
                            const date = new Date(value)
                            return `${date.getHours().toString().padStart(2, '0')}:00`
                          } else {
                            // 按天显示：M/D
                            const date = new Date(value)
                            return `${date.getMonth() + 1}/${date.getDate()}`
                          }
                        }}
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
                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                        itemStyle={{ color: '#374151' }}
                        labelFormatter={(value) => {
                          if (timeRange === 'hour') {
                            // 按分钟显示：完整日期时间
                            const date = new Date(value)
                            return date.toLocaleString('zh-CN', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          } else if (timeRange === 'today') {
                            // 按小时显示：完整日期和小时
                            const date = new Date(value)
                            return date.toLocaleString('zh-CN', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric',
                              hour: '2-digit'
                            })
                          } else {
                            // 按天显示：完整日期
                            const date = new Date(value)
                            return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
                          }
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="line"
                        formatter={(value: string) => (
                          <span style={{ color: '#374151', fontSize: '13px' }}>{value}</span>
                        )}
                      />
                      {stats.modelStats.map((stat, index) => {
                        const color = getModelColor(stat.modelName, index)
                        return (
                          <Line
                            key={stat.modelName}
                            type="monotone"
                            dataKey={stat.modelName}
                            stroke={color}
                            strokeWidth={2.5}
                            name={stat.modelName}
                            dot={{ fill: color, r: 4 }}
                            activeDot={{ r: 6, fill: color }}
                          />
                        )
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 模型分布饼图 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">模型调用分布</h2>
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart style={{ outline: 'none' }}>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => {
                          const { name, percent } = entry
                          if (percent < 0.05) return '' // 小于5%的不显示标签，避免拥挤
                          return `${name}: ${(percent * 100).toFixed(1)}%`
                        }}
                        outerRadius={120}
                        fill="#8884d8"
                        dataKey="value"
                        stroke="#fff"
                        strokeWidth={2}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                          padding: '8px 12px'
                        }}
                        labelStyle={{ color: '#111827', fontWeight: 600 }}
                        itemStyle={{ color: '#374151' }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="circle"
                        formatter={(value: string) => {
                          const entry = pieChartData.find(d => d.name === value)
                          return (
                            <span style={{ color: entry?.color || '#374151', fontSize: '13px', fontWeight: 500 }}>
                              {value}
                            </span>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* 模型颜色说明 */}
                {stats.modelStats.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">模型颜色说明</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {stats.modelStats.map((stat, index) => {
                        const color = getModelColor(stat.modelName, index)
                        return (
                          <div key={stat.modelName} className="flex items-center gap-2">
                            <div 
                              className="w-4 h-4 rounded-sm flex-shrink-0" 
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-sm text-gray-700 truncate" title={stat.modelName}>
                              {stat.modelName}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 平均响应时间统计表 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">模型平均响应时间（秒）</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模型名称</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">已登录用户平均响应时间</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">未登录用户平均响应时间</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总调用次数</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stats.modelStats.map((stat) => (
                          <tr key={stat.modelName} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {stat.modelName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stat.avgResponseTimeAuthenticated !== null
                                ? `${stat.avgResponseTimeAuthenticated.toFixed(2)} 秒`
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stat.avgResponseTimeUnauthenticated !== null
                                ? `${stat.avgResponseTimeUnauthenticated.toFixed(2)} 秒`
                                : '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {stat.totalCalls}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
