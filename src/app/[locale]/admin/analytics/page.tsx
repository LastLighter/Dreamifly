'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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

type TimeRange = 'today' | 'week' | 'month' | 'all'

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

interface StatsResponse {
  timeRange: TimeRange
  modelStats: ModelStat[]
  dailyData: DailyData[]
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
  const [stats, setStats] = useState<StatsResponse | null>(null)
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

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      if (!isAdmin || checkingAdmin) return

      try {
        setLoading(true)
        // 禁用缓存，确保每次都获取最新数据
        const response = await fetch(`/api/admin/model-stats?timeRange=${timeRange}`, {
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
        setStats(data)
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [isAdmin, checkingAdmin, timeRange])

  // 格式化每日数据用于图表
  const formatDailyData = () => {
    if (!stats?.dailyData) return []

    // 按日期和模型分组
    const dateMap = new Map<string, { [key: string]: number }>()

    stats.dailyData.forEach((item) => {
      const date = item.date.split('T')[0] // 只取日期部分
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
      <div className="lg:pl-64">
        {/* 顶部导航栏 */}
        <header className="bg-gradient-to-r from-white to-gray-50 border-b border-orange-200/50 shadow-sm sticky top-0 z-30">
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
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">时间范围：</span>
                <div className="flex gap-2">
                  {(['today', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        timeRange === range
                          ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {range === 'today' ? '今天' : range === 'week' ? '最近一周' : range === 'month' ? '最近一月' : '全部'}
                    </button>
                  ))}
                </div>
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
