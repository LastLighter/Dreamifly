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
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type SubscriptionTab = 'overview' | 'users' | 'plans' | 'orders' | 'statistics'
type TimeRange = 'today' | 'yesterday' | 'week' | 'month' | 'all'
type OrderTypeFilter = 'all' | 'subscription' | 'points'
type OrderStatusFilter = 'all' | 'pending' | 'paid' | 'failed' | 'refunded'

interface SubscriptionStats {
  totalActiveSubscriptions: number
  todayNewSubscriptions: number
  yesterdayNewSubscriptions: number
  monthNewSubscriptions: number
  revenue: {
    total: number
    subscription: {
      total: number
      today: number
      yesterday: number
      week: number
      month: number
    }
    points: {
      total: number
      today: number
      yesterday: number
      week: number
      month: number
    }
    // 兼容旧字段
    today: number
    yesterday: number
    week: number
    month: number
  }
  revenueRatio: {
    subscription: number
    points: number
  }
  planDistribution: Array<{ planType: string; count: number }>
  statusDistribution: Array<{ status: string; count: number }>
  expiringSoon: number
  subscriptionTrend: Array<{ date: string; count: number }>
  revenueTrend: Array<{ 
    date: string
    subscription: number
    points: number
    total: number
    subscriptionCount: number
    pointsCount: number
  }>
}

interface AdminOrder {
  id: string
  orderType: 'subscription' | 'points'
  productId: string
  amount: number
  pointsAmount: number | null
  status: 'pending' | 'paid' | 'failed' | 'refunded'
  paymentMethod: string | null
  paymentId: string | null
  createdAt: string
  paidAt: string | null
  userEmail: string | null
  userName: string | null
}

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5']
const PLAN_TYPE_NAMES: Record<string, string> = {
  monthly: '月度',
  quarterly: '季度',
  yearly: '年度'
}
const STATUS_NAMES: Record<string, string> = {
  active: '活跃',
  expired: '已过期',
  cancelled: '已取消'
}

const formatDateTimeShanghai = (value?: string | null) => {
  if (!value) return '-'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export default function SubscriptionsAdminPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  const [activeTab, setActiveTab] = useState<SubscriptionTab>('overview')
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SubscriptionStats | null>(null)

  // 订单管理相关状态
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersTotalAmount, setOrdersTotalAmount] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersPageSize] = useState(20)
  const [ordersTypeFilter, setOrdersTypeFilter] = useState<OrderTypeFilter>('all')
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<OrderStatusFilter>('all')
  const [ordersSearch, setOrdersSearch] = useState('')
  const [ordersSearchInput, setOrdersSearchInput] = useState('')
  const [ordersLoading, setOrdersLoading] = useState(false)

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

  // 获取统计数据
  useEffect(() => {
    const fetchStats = async () => {
      if (activeTab !== 'overview') return
      
      setLoading(true)
      try {
        const response = await fetch(`/api/admin/subscriptions/stats?timeRange=${timeRange}`)
        if (!response.ok) {
          throw new Error('Failed to fetch stats')
        }
        const data = await response.json()
        setStats(data)
      } catch (error) {
        console.error('Error fetching subscription stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [activeTab, timeRange])

  // 获取订单列表
  useEffect(() => {
    const fetchOrders = async () => {
      if (activeTab !== 'orders') return

      setOrdersLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(ordersPage))
        params.set('limit', String(ordersPageSize))
        params.set('type', ordersTypeFilter)
        params.set('status', ordersStatusFilter)
        if (ordersSearch) {
          params.set('search', ordersSearch)
        }

        const res = await fetch(`/api/admin/orders?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Failed to fetch orders')
        }
        const data = await res.json()
        setOrders(data.orders || [])
        setOrdersTotal(data.total || 0)
        setOrdersTotalAmount(data.totalAmount || 0)
      } catch (error) {
        console.error('Error fetching admin orders:', error)
      } finally {
        setOrdersLoading(false)
      }
    }

    fetchOrders()
  }, [activeTab, ordersPage, ordersPageSize, ordersTypeFilter, ordersStatusFilter, ordersSearch])

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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    订阅数据
                  </h1>
                  <p className="text-xs text-gray-500 -mt-0.5">订阅用户与收入统计</p>
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
                  { id: 'overview', label: '数据概览' },
                  { id: 'users', label: '订阅用户' },
                  { id: 'plans', label: '套餐管理' },
                  { id: 'orders', label: '订单管理' },
                  { id: 'statistics', label: '数据统计' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as SubscriptionTab)}
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

            {/* 数据概览内容 */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* 时间范围选择 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">时间范围：</span>
                    <div className="flex flex-wrap gap-2">
                      {(['today', 'yesterday', 'week', 'month', 'all'] as TimeRange[]).map((range) => (
                        <button
                          key={range}
                          onClick={() => setTimeRange(range)}
                          className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                            timeRange === range
                              ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {range === 'today'
                            ? '今天'
                            : range === 'yesterday'
                            ? '昨天'
                            : range === 'week'
                            ? '最近一周'
                            : range === 'month'
                            ? '最近一月'
                            : '全部'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </div>
                ) : stats ? (
                  <>
                    {/* 统计卡片 - 根据时间范围动态调整 */}
                    {timeRange === 'today' || timeRange === 'yesterday' ? (
                      // 今天/昨天：突出当日指标
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">
                              {timeRange === 'yesterday' ? '昨日' : '今日'}订阅用户
                            </span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="text-3xl font-bold">
                            {timeRange === 'yesterday' ? stats.yesterdayNewSubscriptions : stats.todayNewSubscriptions}
                          </div>
                          <div className="text-xs opacity-80 mt-1">
                            {timeRange === 'yesterday' ? '昨日新增订阅' : '今日新增订阅'}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">
                              {timeRange === 'yesterday' ? '昨日' : '今日'}总收入
                            </span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-3xl font-bold">
                            ¥{(timeRange === 'yesterday' ? stats.revenue.yesterday : stats.revenue.today).toFixed(2)}
                          </div>
                          <div className="text-xs opacity-80 mt-1">
                            {timeRange === 'yesterday' ? '昨日总收入' : '今日总收入'}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">订阅收入</span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div className="text-2xl font-bold">
                            ¥{(timeRange === 'yesterday' ? stats.revenue.subscription.yesterday : stats.revenue.subscription.today).toFixed(2)}
                          </div>
                          <div className="text-xs opacity-80 mt-1">
                            {timeRange === 'yesterday' ? '昨日订阅收入' : '今日订阅收入'}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-green-400 to-emerald-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">积分收入</span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14m0-6c1.11 0 2.08.402 2.6 1M12 8V6m0 8v2m8-4a8 8 0 11-16 0 8 8 0 0116 0z" />
                            </svg>
                          </div>
                          <div className="text-2xl font-bold">
                            ¥{(timeRange === 'yesterday' ? stats.revenue.points.yesterday : stats.revenue.points.today).toFixed(2)}
                          </div>
                          <div className="text-xs opacity-80 mt-1">
                            {timeRange === 'yesterday' ? '昨日积分收入' : '今日积分收入'}
                          </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                          <div className="text-sm text-gray-600 mb-2">收入占比</div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-400 to-amber-400"
                                style={{ width: `${stats.revenueRatio.subscription}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              {stats.revenueRatio.subscription.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            订阅: {stats.revenueRatio.subscription.toFixed(1)}% | 
                            积分: {stats.revenueRatio.points.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ) : (
                      // 其他时间范围：显示累计数据
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">总订阅用户</span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <div className="text-3xl font-bold">{stats.totalActiveSubscriptions}</div>
                          <div className="text-xs opacity-80 mt-1">当前有效订阅</div>
                        </div>

                        <div className="bg-gradient-to-br from-blue-400 to-cyan-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">
                              {timeRange === 'week' ? '本周' : timeRange === 'month' ? '本月' : '累计'}新增
                            </span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <div className="text-3xl font-bold">{stats.monthNewSubscriptions}</div>
                          <div className="text-xs opacity-80 mt-1">
                            {timeRange === 'week' ? '本周新增订阅' : timeRange === 'month' ? '本月新增订阅' : '累计新增订阅'}
                          </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-400 to-pink-400 rounded-xl p-6 text-white shadow-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium opacity-90">
                              {timeRange === 'week' ? '本周' : timeRange === 'month' ? '本月' : '累计'}总收入
                            </span>
                            <svg className="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="text-3xl font-bold">¥{stats.revenue.total.toFixed(2)}</div>
                          <div className="text-xs opacity-80 mt-1">
                            {timeRange === 'week' ? '本周总收入' : timeRange === 'month' ? '本月总收入' : '累计总收入'}
                          </div>
                        </div>

                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                          <div className="text-sm text-gray-600 mb-2">收入占比</div>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-orange-400 to-amber-400"
                                style={{ width: `${stats.revenueRatio.subscription}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-gray-700">
                              {stats.revenueRatio.subscription.toFixed(1)}%
                            </span>
                          </div>
                          <div className="text-xs text-gray-500">
                            订阅: {stats.revenueRatio.subscription.toFixed(1)}% | 
                            积分: {stats.revenueRatio.points.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 收入分类统计卡片 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">订阅收入</div>
                        <div className="text-2xl font-bold text-orange-600">
                          ¥{stats.revenue.subscription.total.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {timeRange === 'today' ? '今日' : timeRange === 'yesterday' ? '昨日' : timeRange === 'week' ? '本周' : timeRange === 'month' ? '本月' : '累计'}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">积分收入</div>
                        <div className="text-2xl font-bold text-emerald-600">
                          ¥{stats.revenue.points.total.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {timeRange === 'today' ? '今日' : timeRange === 'yesterday' ? '昨日' : timeRange === 'week' ? '本周' : timeRange === 'month' ? '本月' : '累计'}
                        </div>
                      </div>
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">本周收入</div>
                        <div className="text-2xl font-bold text-gray-900">¥{stats.revenue.week.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 mt-1">订阅: ¥{stats.revenue.subscription.week.toFixed(2)} | 积分: ¥{stats.revenue.points.week.toFixed(2)}</div>
                      </div>
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <div className="text-sm text-gray-600 mb-1">本月收入</div>
                        <div className="text-2xl font-bold text-gray-900">¥{stats.revenue.month.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 mt-1">订阅: ¥{stats.revenue.subscription.month.toFixed(2)} | 积分: ¥{stats.revenue.points.month.toFixed(2)}</div>
                      </div>
                    </div>

                    {/* 图表区域 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 订阅趋势 */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">订阅趋势</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={stats.subscriptionTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} name="订阅数" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* 收入趋势 - 双线图 */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">收入趋势</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={stats.revenueTrend}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line 
                              type="monotone" 
                              dataKey="subscription" 
                              stroke="#f97316" 
                              strokeWidth={2} 
                              name="订阅收入(¥)" 
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="points" 
                              stroke="#10b981" 
                              strokeWidth={2} 
                              name="积分收入(¥)" 
                              dot={{ r: 4 }}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="total" 
                              stroke="#6366f1" 
                              strokeWidth={2} 
                              strokeDasharray="5 5"
                              name="总收入(¥)" 
                              dot={{ r: 3 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* 套餐分布 */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">套餐分布</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={stats.planDistribution.map(p => ({
                                name: PLAN_TYPE_NAMES[p.planType] || p.planType,
                                value: p.count
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {stats.planDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* 状态分布 */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">状态分布</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={stats.statusDistribution.map(s => ({
                                name: STATUS_NAMES[s.status] || s.status,
                                value: s.count
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {stats.statusDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* 收入占比饼图 */}
                      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">收入占比</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={[
                                { name: '订阅收入', value: stats.revenue.subscription.total },
                                { name: '积分收入', value: stats.revenue.points.total }
                              ]}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent, value }) => {
                                const p = percent || 0
                                return `${name}\n${(p * 100).toFixed(1)}%\n¥${value.toFixed(2)}`
                              }}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              <Cell fill="#f97316" />
                              <Cell fill="#10b981" />
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* 其他信息 */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">即将过期订阅</h3>
                          <p className="text-sm text-gray-600 mt-1">7天内即将过期的订阅数</p>
                        </div>
                        <div className="text-3xl font-bold text-orange-600">{stats.expiringSoon}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                    <p className="text-gray-500">暂无数据</p>
                  </div>
                )}
              </div>
            )}

            {/* 订单管理 */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {/* 筛选 & 搜索 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 whitespace-nowrap">订单类型</span>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm min-w-[110px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={ordersTypeFilter}
                        onChange={(e) => {
                          setOrdersTypeFilter(e.target.value as OrderTypeFilter)
                          setOrdersPage(1)
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="subscription">订阅订单</option>
                        <option value="points">积分订单</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 whitespace-nowrap">状态</span>
                      <select
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm min-w-[110px] focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={ordersStatusFilter}
                        onChange={(e) => {
                          setOrdersStatusFilter(e.target.value as OrderStatusFilter)
                          setOrdersPage(1)
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="pending">待支付</option>
                        <option value="paid">已支付</option>
                        <option value="failed">失败</option>
                        <option value="refunded">已退款</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="搜索订单号 / 用户邮箱 / 用户名"
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      value={ordersSearchInput}
                      onChange={(e) => setOrdersSearchInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setOrdersSearch(ordersSearchInput.trim())
                          setOrdersPage(1)
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        setOrdersSearch(ordersSearchInput.trim())
                        setOrdersPage(1)
                      }}
                      className="px-3 py-1.5 rounded-lg text-sm bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                    >
                      搜索
                    </button>
                  </div>
                </div>

                {/* 列表 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* 当前筛选总金额 */}
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      当前筛选订单总金额：
                      <span className="font-semibold text-orange-600">
                        ¥{ordersTotalAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      包含当前筛选条件下的所有订单（不区分分页）
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订单号</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">金额 / 积分</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">支付方式</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">支付时间</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ordersLoading ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                              <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-orange-500" />
                                <span className="text-sm">加载订单中...</span>
                              </div>
                            </td>
                          </tr>
                        ) : orders.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                              暂无订单数据
                            </td>
                          </tr>
                        ) : (
                          orders.map((order) => (
                            <tr key={order.id} className="hover:bg-gray-50/60">
                              <td className="px-4 py-2 font-mono text-xs text-gray-800 break-all">
                                {order.id}
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex flex-col">
                                  <span className="text-sm text-gray-900">
                                    {order.userName || '未知用户'}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {order.userEmail || '-'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    order.orderType === 'subscription'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {order.orderType === 'subscription' ? '订阅' : '积分'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                {order.orderType === 'subscription' ? (
                                  <span className="text-sm text-gray-900">
                                    ¥{order.amount.toFixed(2)}
                                  </span>
                                ) : (
                                  <div className="flex flex-col">
                                    <span className="text-sm text-gray-900">
                                      ¥{order.amount.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {order.pointsAmount ?? 0} 积分
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    order.status === 'paid'
                                      ? 'bg-green-100 text-green-700'
                                      : order.status === 'pending'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : order.status === 'refunded'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {order.status === 'pending'
                                    ? '待支付'
                                    : order.status === 'paid'
                                    ? '已支付'
                                    : order.status === 'refunded'
                                    ? '已退款'
                                    : '失败'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700">
                                {order.paymentMethod === 'alipay'
                                  ? '支付宝'
                                  : order.paymentMethod === 'wechat'
                                  ? '微信'
                                  : order.paymentMethod || '-'}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-600">
                                {formatDateTimeShanghai(order.createdAt)}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-600">
                                {formatDateTimeShanghai(order.paidAt)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                    <div className="text-xs text-gray-500">
                      共 {ordersTotal} 条记录，第 {ordersPage} 页 /
                      共 {Math.max(1, Math.ceil(ordersTotal / ordersPageSize))} 页
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={ordersPage <= 1 || ordersLoading}
                        onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          ordersPage <= 1 || ordersLoading
                            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        上一页
                      </button>
                      <button
                        disabled={
                          ordersLoading ||
                          ordersPage >= Math.ceil(ordersTotal / ordersPageSize)
                        }
                        onClick={() =>
                          setOrdersPage((p) =>
                            Math.min(Math.ceil(ordersTotal / ordersPageSize) || 1, p + 1),
                          )
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                          ordersLoading ||
                          ordersPage >= Math.ceil(ordersTotal / ordersPageSize)
                            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 其他 Tab 的占位内容 */}
            {activeTab !== 'overview' && activeTab !== 'orders' && (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                <p className="text-gray-500">功能开发中...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

