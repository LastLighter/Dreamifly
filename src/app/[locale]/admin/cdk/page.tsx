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

interface CDK {
  id: string
  code: string
  packageType: 'points_package' | 'subscription_plan'
  packageId: number
  isRedeemed: boolean
  expiresAt?: string
  createdAt: string
  package?: {
    id: number
    name: string
    points?: number
    type?: string
    price: number
    bonusPoints?: number
  }
}

interface Package {
  id: number
  name: string
  nameTag?: string
  points?: number
  type?: string
  price: number
  bonusPoints?: number
  isPopular?: boolean
}

interface Redemption {
  id: string
  redeemedAt: string
  ipAddress?: string
  packageType: string
  packageName: string
  packageData: any
  cdk: {
    id: string
    code: string
  }
  user: {
    id: string
    name?: string
    email: string
  }
}

type CDKTab = 'list' | 'create' | 'redemptions'

export default function CDKAdminPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string>('')
  const [activeTab, setActiveTab] = useState<CDKTab>('list')

  // CDK列表相关状态
  const [cdks, setCdks] = useState<CDK[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [selectedCdks, setSelectedCdks] = useState<string[]>([])

  // 筛选状态
  const [filters, setFilters] = useState({
    packageType: '',
    isRedeemed: '',
    code: '',
    pageSize: '20'
  })

  // 配置状态
  const [cdkConfig, setCdkConfig] = useState({ userDailyLimit: 5 })
  const [showConfigModal, setShowConfigModal] = useState(false)

  // 创建CDK相关状态
  const [pointsPackages, setPointsPackages] = useState<Package[]>([])
  const [subscriptionPlans, setSubscriptionPlans] = useState<Package[]>([])
  const [createLoading, setCreateLoading] = useState(false)
  const [createForm, setCreateForm] = useState({
    packageType: 'points_package' as 'points_package' | 'subscription_plan',
    packageId: '',
    expiryType: 'week' as '3days' | 'week' | 'month' | 'never' | 'custom',
    customDays: '',
    quantity: '1',
  })

  // 兑换记录相关状态
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [redemptionsLoading, setRedemptionsLoading] = useState(false)
  const [redemptionsPage, setRedemptionsPage] = useState(1)
  const [redemptionsTotalPages, setRedemptionsTotalPages] = useState(1)
  const [redemptionsTotal, setRedemptionsTotal] = useState(0)
  const [redemptionsFilters, setRedemptionsFilters] = useState({
    userId: '',
    cdkId: '',
    startDate: '',
    endDate: '',
    pageSize: '20'
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
      if (!session?.user) return

      try {
        const token = await generateDynamicTokenWithServerTime()
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
      } catch (error) {
        console.error('检查管理员权限失败:', error)
      } finally {
        setCheckingAdmin(false)
      }
    }

    if (!sessionLoading) {
      checkAdmin()
    }
  }, [session, sessionLoading])

  // 设置用户头像
  useEffect(() => {
    if (session?.user?.image) {
      setCurrentUserAvatar(session.user.image)
    } else if (globalAvatar) {
      setCurrentUserAvatar(globalAvatar)
    }
  }, [session, globalAvatar])

  // 加载CDK配置
  const loadConfig = async () => {
    try {
      const token = await generateDynamicTokenWithServerTime()
      const response = await fetch('/api/admin/cdk/config', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setCdkConfig(data.config)
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  // 加载CDK列表
  const loadCdks = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:195',message:'loadCdks called',data:{page,filters},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    setLoading(true)
    try {
      const token = await generateDynamicTokenWithServerTime()
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: filters.pageSize,
        ...(filters.packageType && { packageType: filters.packageType }),
        ...(filters.isRedeemed && { isRedeemed: filters.isRedeemed }),
        ...(filters.code && { code: filters.code }),
      })

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:207',message:'Before fetch CDK list',data:{url:`/api/admin/cdk?${queryParams}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`/api/admin/cdk?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:212',message:'CDK list response received',data:{status:response.status,ok:response.ok},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      if (!response.ok) {
        throw new Error(`Failed to load CDKs: ${response.status}`)
      }
      
      const data = await response.json()
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:218',message:'CDK list data parsed',data:{cdksCount:data.cdks?.length || 0,total:data.total,cdkIds:data.cdks?.map((c:CDK)=>c.id) || []},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setCdks(data.cdks)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:224',message:'loadCdks error',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      console.error('加载CDK失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 加载包列表
  const loadPackages = async () => {
    try {
      const token = await generateDynamicTokenWithServerTime()
      const response = await fetch('/api/admin/cdk/packages', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setPointsPackages(data.packages.points || [])
      setSubscriptionPlans(data.packages.subscription || [])
    } catch (error) {
      console.error('加载包列表失败:', error)
    }
  }

  // 加载兑换记录
  const loadRedemptions = async () => {
    setRedemptionsLoading(true)
    try {
      const token = await generateDynamicTokenWithServerTime()
      const queryParams = new URLSearchParams({
        page: redemptionsPage.toString(),
        pageSize: redemptionsFilters.pageSize,
        ...(redemptionsFilters.userId && { userId: redemptionsFilters.userId }),
        ...(redemptionsFilters.cdkId && { cdkId: redemptionsFilters.cdkId }),
        ...(redemptionsFilters.startDate && { startDate: redemptionsFilters.startDate }),
        ...(redemptionsFilters.endDate && { endDate: redemptionsFilters.endDate }),
      })

      const response = await fetch(`/api/admin/cdk/redemptions?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      setRedemptions(data.redemptions)
      setRedemptionsTotal(data.total)
      setRedemptionsTotalPages(data.totalPages)
    } catch (error) {
      console.error('加载兑换记录失败:', error)
    } finally {
      setRedemptionsLoading(false)
    }
  }

  // 更新配置
  const updateConfig = async (newLimit: number) => {
    try {
      const token = await generateDynamicTokenWithServerTime()
      const response = await fetch('/api/admin/cdk/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userDailyLimit: newLimit }),
      })

      if (response.ok) {
        setCdkConfig({ userDailyLimit: newLimit })
        setShowConfigModal(false)
      }
    } catch (error) {
      console.error('更新配置失败:', error)
    }
  }

  // 创建CDK
  const createCDK = async () => {
    if (!createForm.packageId) {
      alert('请选择包')
      return
    }

    setCreateLoading(true)
    try {
      const token = await generateDynamicTokenWithServerTime()
      const quantity = parseInt(createForm.quantity) || 1

      // 计算过期时间
      const expiryDate = calculateExpiryDate()

      // 批量创建
      const createPromises = Array.from({ length: quantity }, () =>
        fetch('/api/admin/cdk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            packageType: createForm.packageType,
            packageId: parseInt(createForm.packageId),
            expiresAt: expiryDate,
          }),
        })
      )

      const results = await Promise.all(createPromises)
      const codes = []

      for (const response of results) {
        const result = await response.json()
        if (result.code) {
          codes.push(result.code)
        } else if (result.error) {
          alert(result.error)
          return
        }
      }

      // 显示生成的CDK
      const codesText = codes.join('\n')
      alert(`成功生成 ${codes.length} 个CDK:\n\n${codesText}`)

      // 可选：自动复制到剪贴板
      if (codes.length === 1) {
        navigator.clipboard.writeText(codes[0])
      }

      setActiveTab('list')
      loadCdks()
      setCreateForm({ packageType: 'points_package', packageId: '', expiresAt: '', quantity: '1' })
    } catch (error) {
      console.error('创建CDK失败:', error)
      alert('创建失败，请重试')
    } finally {
      setCreateLoading(false)
    }
  }

  // 单个删除
  const handleSingleDelete = async (cdkId: string) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:356',message:'handleSingleDelete called',data:{cdkId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!confirm('确定要删除此CDK吗？')) return

    try {
      const token = await generateDynamicTokenWithServerTime()
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:362',message:'Before single delete API call',data:{cdkId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const response = await fetch(`/api/admin/cdk?id=${cdkId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const responseData = await response.json().catch(() => ({}));
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:371',message:'Single delete API response',data:{cdkId,status:response.status,ok:response.ok,responseData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        throw new Error(responseData.error || `删除失败: ${response.status}`);
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:377',message:'Single delete completed, refreshing list',data:{cdkId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      loadCdks()
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:380',message:'Single delete error caught',data:{cdkId,error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('删除CDK失败:', error)
      alert(error instanceof Error ? error.message : '删除失败，请重试')
    }
  }

  // 批量操作
  const handleBatchDelete = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:357',message:'handleBatchDelete called',data:{selectedCdksCount:selectedCdks.length,selectedCdks:selectedCdks},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (selectedCdks.length === 0) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:360',message:'Early return: selectedCdks empty',data:{selectedCdksCount:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return
    }

    if (!confirm(`确定要删除选中的 ${selectedCdks.length} 个CDK吗？已兑换的CDK无法删除。`)) return

    try {
      const token = await generateDynamicTokenWithServerTime()
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:365',message:'Before delete API calls',data:{idsToDelete:selectedCdks,idsCount:selectedCdks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const deletePromises = selectedCdks.map(id =>
        fetch(`/api/admin/cdk?id=${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }).then(async (response) => {
          const responseData = await response.json().catch(() => ({}));
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:370',message:'Delete API response',data:{id,status:response.status,ok:response.ok,responseData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          if (!response.ok) {
            throw new Error(responseData.error || `Delete failed for ${id}: ${response.status}`);
          }
          return response;
        })
      )

      const results = await Promise.allSettled(deletePromises)
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:380',message:'Some deletes failed',data:{failedCount:failed.length,totalCount:selectedCdks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        throw new Error(`${failed.length} 个CDK删除失败`)
      }
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:378',message:'All deletes completed, refreshing list',data:{deletedCount:selectedCdks.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      setSelectedCdks([])
      loadCdks()
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:382',message:'Delete error caught',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('批量删除失败:', error)
      alert('批量删除失败，请重试')
    }
  }

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedCdks.length === cdks.filter(cdk => !cdk.isRedeemed).length && cdks.length > 0) {
      setSelectedCdks([])
    } else {
      setSelectedCdks(cdks.filter(cdk => !cdk.isRedeemed).map(cdk => cdk.id))
    }
  }

  // 复制CDK到剪贴板
  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
    // 可以添加一个临时提示
  }

  // 获取包选项
  const getPackageOptions = (type: 'points_package' | 'subscription_plan') => {
    const packages = type === 'points_package' ? pointsPackages : subscriptionPlans
    return packages.map(pkg => ({
      value: pkg.id.toString(),
      label: type === 'points_package'
        ? `${pkg.name} (${pkg.points}积分 - ¥${pkg.price})`
        : `${pkg.name} (${pkg.type}) - ¥${pkg.price}`
    }))
  }

  // 计算过期时间（返回UTC时间戳）
  const calculateExpiryDate = () => {
    let days = 0

    switch (createForm.expiryType) {
      case '3days':
        days = 3
        break
      case 'week':
        days = 7
        break
      case 'month':
        days = 30
        break
      case 'never':
        return undefined // 永不过期
      case 'custom':
        days = parseInt(createForm.customDays) || 7
        break
      default:
        days = 7
    }

    // 使用UTC时间计算，确保时间戳是UTC的
    const now = new Date()
    const expiryDate = new Date(now.getTime() + (days * 24 * 60 * 60 * 1000))
    return expiryDate // 返回Date对象，后端会处理UTC转换
  }

  // 获取过期时间描述
  const getExpiryDescription = () => {
    switch (createForm.expiryType) {
      case '3days':
        return '3天后过期'
      case 'week':
        return '一周后过期'
      case 'month':
        return '一个月后过期'
      case 'never':
        return '永不过期'
      case 'custom':
        const days = parseInt(createForm.customDays) || 7
        return `${days}天后过期`
      default:
        return '一周后过期'
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadConfig()
      loadPackages()
      if (activeTab === 'list') {
        loadCdks()
      } else if (activeTab === 'redemptions') {
        loadRedemptions()
      }
    }
  }, [isAdmin, activeTab, page, filters, redemptionsPage, redemptionsFilters])

  // 权限检查
  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">检查权限中...</p>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">访问被拒绝</h1>
          <p className="text-gray-600">您没有权限访问此页面</p>
          <button
            onClick={() => router.push(transferUrl('/', locale))}
            className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />

      {/* 主内容区 */}
      <div className="lg:pl-64 pt-16 lg:pt-0">
        <div className="p-6">
          {/* 页面标题和配置 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                CDK管理
              </h1>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  用户每日最多兑换 {cdkConfig.userDailyLimit} 次
                </div>
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                >
                  修改配置
                </button>
              </div>
            </div>

            {/* Tab 切换 */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'list'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                CDK列表
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'create'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                创建CDK
              </button>
              <button
                onClick={() => setActiveTab('redemptions')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'redemptions'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                兑换记录
              </button>
            </div>
          </div>

          {/* CDK列表页 */}
          {activeTab === 'list' && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* 搜索和筛选 */}
              <div className="p-6 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      包类型
                    </label>
                    <select
                      value={filters.packageType}
                      onChange={(e) => setFilters(prev => ({ ...prev, packageType: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">全部</option>
                      <option value="points_package">积分包</option>
                      <option value="subscription_plan">订阅套餐</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      兑换状态
                    </label>
                    <select
                      value={filters.isRedeemed}
                      onChange={(e) => setFilters(prev => ({ ...prev, isRedeemed: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">全部</option>
                      <option value="false">未兑换</option>
                      <option value="true">已兑换</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CDK代码
                    </label>
                    <input
                      type="text"
                      value={filters.code}
                      onChange={(e) => setFilters(prev => ({ ...prev, code: e.target.value }))}
                      placeholder="输入CDK代码搜索"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      每页显示
                    </label>
                    <select
                      value={filters.pageSize}
                      onChange={(e) => setFilters(prev => ({ ...prev, pageSize: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="10">10条</option>
                      <option value="20">20条</option>
                      <option value="50">50条</option>
                      <option value="100">100条</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 批量操作 */}
              {selectedCdks.length > 0 && (
                <div className="px-6 py-3 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-orange-800">
                      已选择 {selectedCdks.length} 个CDK
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBatchDelete}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                      >
                        批量删除
                      </button>
                      <button
                        onClick={() => setSelectedCdks([])}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                      >
                        取消选择
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 表格 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedCdks.length === cdks.filter(cdk => !cdk.isRedeemed).length && cdks.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CDK代码
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        包类型
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        包名称
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        兑换状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        过期时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        创建时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                            <span className="ml-2 text-gray-600">加载中...</span>
                          </div>
                        </td>
                      </tr>
                    ) : cdks.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                          暂无CDK数据
                        </td>
                      </tr>
                    ) : (
                      cdks.map((cdk) => (
                        <tr key={cdk.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            {!cdk.isRedeemed && (
                              <input
                                type="checkbox"
                                checked={selectedCdks.includes(cdk.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCdks(prev => [...prev, cdk.id])
                                  } else {
                                    setSelectedCdks(prev => prev.filter(id => id !== cdk.id))
                                  }
                                }}
                                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                              />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <span className="font-mono text-sm text-gray-900">{cdk.code}</span>
                              <button
                                onClick={() => copyToClipboard(cdk.code)}
                                className="ml-2 text-gray-400 hover:text-gray-600"
                                title="复制CDK"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {cdk.packageType === 'points_package' ? '积分包' : '订阅套餐'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {cdk.package?.name || '包信息已失效'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              cdk.isRedeemed
                                ? 'bg-red-100 text-red-800'
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {cdk.isRedeemed ? '已兑换' : '未兑换'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {cdk.expiresAt ? new Date(cdk.expiresAt).toLocaleString() : '永久有效'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(cdk.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {!cdk.isRedeemed && (
                              <button
                                onClick={() => {
                                  // #region agent log
                                  fetch('http://127.0.0.1:7243/ingest/c7514175-f2a4-4357-9430-0bf0dc8944bf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'cdk/page.tsx:757',message:'Single delete button clicked',data:{cdkId:cdk.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                                  // #endregion
                                  handleSingleDelete(cdk.id)
                                }}
                                className="text-red-600 hover:text-red-900"
                              >
                                删除
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    显示第 {((page - 1) * parseInt(filters.pageSize)) + 1} 到 {Math.min(page * parseInt(filters.pageSize), total)} 条，共 {total} 条
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(prev => Math.max(1, prev - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      上一页
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 创建CDK页 */}
          {activeTab === 'create' && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-6">创建CDK</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 包类型选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    包类型 *
                  </label>
                  <select
                    value={createForm.packageType}
                    onChange={(e) => setCreateForm(prev => ({
                      ...prev,
                      packageType: e.target.value as 'points_package' | 'subscription_plan',
                      packageId: '' // 重置包选择
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="points_package">积分包</option>
                    <option value="subscription_plan">订阅套餐</option>
                  </select>
                </div>

                {/* 包选择 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择包 *
                  </label>
                  <select
                    value={createForm.packageId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, packageId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">请选择包</option>
                    {getPackageOptions(createForm.packageType).map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 生成数量 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    生成数量
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                {/* 过期时间设置 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    过期时间
                  </label>
                  <select
                    value={createForm.expiryType}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, expiryType: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 mb-3"
                  >
                    <option value="week">一周（默认）</option>
                    <option value="3days">3天</option>
                    <option value="month">一个月</option>
                    <option value="never">永不过期</option>
                    <option value="custom">自定义天数</option>
                  </select>
                  {createForm.expiryType === 'custom' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="365"
                        placeholder="天数"
                        value={createForm.customDays}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, customDays: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                      <span className="text-sm text-gray-600">天</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 预览信息 */}
              {createForm.packageId && (
                <div className="mt-6 p-4 bg-orange-50 rounded-lg">
                  <h3 className="font-medium text-orange-800 mb-2">预览信息</h3>
                  <div className="text-sm text-orange-700">
                    <p>包类型: {createForm.packageType === 'points_package' ? '积分包' : '订阅套餐'}</p>
                    <p>生成数量: {createForm.quantity} 个</p>
                    <p>过期时间: {getExpiryDescription()}</p>
                  </div>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={createCDK}
                  disabled={!createForm.packageId || createLoading}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createLoading ? '生成中...' : `生成 ${createForm.quantity} 个CDK`}
                </button>
              </div>
            </div>
          )}

          {/* 兑换记录页 */}
          {activeTab === 'redemptions' && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {/* 搜索和筛选 */}
              <div className="p-6 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      用户邮箱
                    </label>
                    <input
                      type="text"
                      value={redemptionsFilters.userId}
                      onChange={(e) => setRedemptionsFilters(prev => ({ ...prev, userId: e.target.value }))}
                      placeholder="输入用户邮箱"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      CDK代码
                    </label>
                    <input
                      type="text"
                      value={redemptionsFilters.cdkId}
                      onChange={(e) => setRedemptionsFilters(prev => ({ ...prev, cdkId: e.target.value }))}
                      placeholder="输入CDK代码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      每页显示
                    </label>
                    <select
                      value={redemptionsFilters.pageSize}
                      onChange={(e) => setRedemptionsFilters(prev => ({ ...prev, pageSize: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="10">10条</option>
                      <option value="20">20条</option>
                      <option value="50">50条</option>
                      <option value="100">100条</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      开始日期
                    </label>
                    <input
                      type="date"
                      value={redemptionsFilters.startDate}
                      onChange={(e) => setRedemptionsFilters(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      结束日期
                    </label>
                    <input
                      type="date"
                      value={redemptionsFilters.endDate}
                      onChange={(e) => setRedemptionsFilters(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* 表格 */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CDK代码
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用户信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        兑换内容
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        兑换时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP地址
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {redemptionsLoading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                            <span className="ml-2 text-gray-600">加载中...</span>
                          </div>
                        </td>
                      </tr>
                    ) : redemptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                          暂无兑换记录
                        </td>
                      </tr>
                    ) : (
                      redemptions.map((redemption) => (
                        <tr key={redemption.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm text-gray-900">{redemption.cdk.code}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="text-gray-900">{redemption.user.name || '未设置'}</div>
                              <div className="text-gray-500">{redemption.user.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <div className="text-gray-900">{redemption.packageName}</div>
                              <div className="text-gray-500">
                                {redemption.packageType === 'points_package'
                                  ? `${redemption.packageData.points} 积分`
                                  : `${redemption.packageData.type} 订阅`
                                }
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(redemption.redeemedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {redemption.ipAddress || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 分页 */}
              {redemptionsTotalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    显示第 {((redemptionsPage - 1) * parseInt(redemptionsFilters.pageSize)) + 1} 到 {Math.min(redemptionsPage * parseInt(redemptionsFilters.pageSize), redemptionsTotal)} 条，共 {redemptionsTotal} 条
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRedemptionsPage(prev => Math.max(1, prev - 1))}
                      disabled={redemptionsPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      上一页
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-700">
                      {redemptionsPage} / {redemptionsTotalPages}
                    </span>
                    <button
                      onClick={() => setRedemptionsPage(prev => Math.min(redemptionsTotalPages, prev + 1))}
                      disabled={redemptionsPage === redemptionsTotalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 配置修改弹窗 */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">修改配置</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户每日兑换次数限制
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={cdkConfig.userDailyLimit}
                onChange={(e) => setCdkConfig(prev => ({ ...prev, userDailyLimit: parseInt(e.target.value) || 5 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                取消
              </button>
              <button
                onClick={() => updateConfig(cdkConfig.userDailyLimit)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
