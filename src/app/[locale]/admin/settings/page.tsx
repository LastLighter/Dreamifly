'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import AdminSidebar from '@/components/AdminSidebar'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'

export default function SettingsPage() {
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

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

  // 用户限额配置状态
  const [limitConfig, setLimitConfig] = useState({
    regularUserDailyLimit: 100,
    premiumUserDailyLimit: 300,
    newUserDailyLimit: 50,
    usingEnvRegular: false,
    usingEnvPremium: false,
    usingEnvNew: false,
    envRegularLimit: 100,
    envPremiumLimit: 300,
    envNewLimit: 50,
  })
  const [limitInputs, setLimitInputs] = useState({
    regular: '',
    premium: '',
    newer: '',
    useEnvRegular: false,
    useEnvPremium: false,
    useEnvNew: false,
  })

  // 积分配置状态
  const [pointsConfig, setPointsConfig] = useState({
    regularUserDailyPoints: 10,
    premiumUserDailyPoints: 20,
    pointsExpiryDays: 7,
    repairWorkflowCost: 1,
    usingEnvRegular: false,
    usingEnvPremium: false,
    usingEnvExpiry: false,
    usingEnvRepair: false,
    envRegularPoints: 10,
    envPremiumPoints: 20,
    envExpiryDays: 7,
    envRepairCost: 1,
  })
  const [pointsInputs, setPointsInputs] = useState({
    regular: '',
    premium: '',
    expiry: '',
    repair: '',
    useEnvRegular: false,
    useEnvPremium: false,
    useEnvExpiry: false,
    useEnvRepair: false,
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

  // 获取用户限额配置
  const fetchLimitConfig = async () => {
    try {
      const response = await fetch(`/api/admin/user-limits?t=${Date.now()}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setLimitConfig(data)
        setLimitInputs({
          regular: data.usingEnvRegular ? '' : data.regularUserDailyLimit.toString(),
          premium: data.usingEnvPremium ? '' : data.premiumUserDailyLimit.toString(),
          newer: data.usingEnvNew ? '' : data.newUserDailyLimit.toString(),
          useEnvRegular: data.usingEnvRegular,
          useEnvPremium: data.usingEnvPremium,
          useEnvNew: data.usingEnvNew,
        })
      }
    } catch (error) {
      console.error('Failed to fetch limit config:', error)
    }
  }

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      fetchLimitConfig()
      fetchPointsConfig()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, checkingAdmin])

  // 获取积分配置
  const fetchPointsConfig = async () => {
    try {
      const response = await fetch('/api/admin/points-config')
      if (response.ok) {
        const data = await response.json()
        setPointsConfig(data)
        setPointsInputs({
          regular: data.usingEnvRegular ? '' : data.regularUserDailyPoints.toString(),
          premium: data.usingEnvPremium ? '' : data.premiumUserDailyPoints.toString(),
          expiry: data.usingEnvExpiry ? '' : data.pointsExpiryDays.toString(),
          repair: data.usingEnvRepair ? '' : data.repairWorkflowCost.toString(),
          useEnvRegular: data.usingEnvRegular,
          useEnvPremium: data.usingEnvPremium,
          useEnvExpiry: data.usingEnvExpiry,
          useEnvRepair: data.usingEnvRepair,
        })
      }
    } catch (error) {
      console.error('Failed to fetch points config:', error)
    }
  }

  // 更新积分配置
  const handleUpdatePointsConfig = async () => {
    try {
      const body: any = {}
      
      if (pointsInputs.useEnvRegular) {
        body.useEnvForRegular = true
      } else {
        const regularValue = parseInt(pointsInputs.regular, 10)
        if (isNaN(regularValue) || regularValue < 0) {
          showDialog('error', '验证失败', '普通用户每日积分必须是大于等于0的数字')
          return
        }
        body.regularUserDailyPoints = regularValue
      }

      if (pointsInputs.useEnvPremium) {
        body.useEnvForPremium = true
      } else {
        const premiumValue = parseInt(pointsInputs.premium, 10)
        if (isNaN(premiumValue) || premiumValue < 0) {
          showDialog('error', '验证失败', '优质用户每日积分必须是大于等于0的数字')
          return
        }
        body.premiumUserDailyPoints = premiumValue
      }

      if (pointsInputs.useEnvExpiry) {
        body.useEnvForExpiry = true
      } else {
        const expiryValue = parseInt(pointsInputs.expiry, 10)
        if (isNaN(expiryValue) || expiryValue < 1) {
          showDialog('error', '验证失败', '积分过期天数必须是大于等于1的数字')
          return
        }
        body.pointsExpiryDays = expiryValue
      }

      if (pointsInputs.useEnvRepair) {
        body.useEnvForRepair = true
      } else {
        const repairValue = parseInt(pointsInputs.repair, 10)
        if (isNaN(repairValue) || repairValue < 0) {
          showDialog('error', '验证失败', '工作流修复消耗积分必须是大于等于0的数字')
          return
        }
        body.repairWorkflowCost = repairValue
      }

      const response = await fetch('/api/admin/points-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        showDialog('success', '成功', '积分配置已更新')
        fetchPointsConfig()
      } else {
        const data = await response.json()
        showDialog('error', '更新失败', data.error || '更新积分配置失败')
      }
    } catch (error) {
      console.error('Failed to update points config:', error)
      showDialog('error', '更新失败', '更新积分配置时发生错误')
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

  // 更新用户限额配置
  const handleUpdateLimitConfig = async () => {
    try {
      const body: any = {}
      
      if (limitInputs.useEnvRegular) {
        body.useEnvForRegular = true
      } else {
        const regularValue = parseInt(limitInputs.regular, 10)
        if (isNaN(regularValue) || regularValue < 0) {
          showDialog('error', '验证失败', '普通用户限额必须是大于等于0的数字')
          return
        }
        body.regularUserDailyLimit = regularValue
      }

      if (limitInputs.useEnvPremium) {
        body.useEnvForPremium = true
      } else {
        const premiumValue = parseInt(limitInputs.premium, 10)
        if (isNaN(premiumValue) || premiumValue < 0) {
          showDialog('error', '验证失败', '优质用户限额必须是大于等于0的数字')
          return
        }
        body.premiumUserDailyLimit = premiumValue
      }

      if (limitInputs.useEnvNew) {
        body.useEnvForNew = true
      } else {
        const newValue = parseInt(limitInputs.newer, 10)
        if (isNaN(newValue) || newValue < 0) {
          showDialog('error', '验证失败', '新用户限额必须是大于等于0的数字')
          return
        }
        body.newUserDailyLimit = newValue
      }

      const response = await fetch('/api/admin/user-limits', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '更新失败')
      }

      // 刷新配置
      await fetchLimitConfig()
      showDialog('success', '操作成功', '限额配置已更新')
    } catch (error) {
      console.error('Failed to update limit config:', error)
      showDialog('error', '操作失败', error instanceof Error ? error.message : '更新限额配置失败')
    }
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">设置</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">系统配置管理</p>
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

        <div className="p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            {/* 用户限额设置卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">用户限额设置</h2>
                  <p className="text-sm text-gray-500 mt-1">配置普通用户和优质用户的每日请求限额</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* 首批用户（老用户）限额 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    首批用户每日限额
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={limitInputs.useEnvRegular}
                        onChange={(e) => {
                          setLimitInputs({
                            ...limitInputs,
                            useEnvRegular: e.target.checked,
                            regular: e.target.checked ? '' : limitConfig.regularUserDailyLimit.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({limitConfig.envRegularLimit})</span>
                    </label>
                    {!limitInputs.useEnvRegular && (
                      <input
                        type="number"
                        value={limitInputs.regular}
                        onChange={(e) => setLimitInputs({ ...limitInputs, regular: e.target.value })}
                        placeholder="输入限额"
                        min="0"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {limitConfig.usingEnvRegular ? `环境变量 (${limitConfig.envRegularLimit})` : limitConfig.regularUserDailyLimit}
                  </p>
                </div>

                {/* 优质用户限额 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    优质用户每日限额
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={limitInputs.useEnvPremium}
                        onChange={(e) => {
                          setLimitInputs({
                            ...limitInputs,
                            useEnvPremium: e.target.checked,
                            premium: e.target.checked ? '' : limitConfig.premiumUserDailyLimit.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({limitConfig.envPremiumLimit})</span>
                    </label>
                    {!limitInputs.useEnvPremium && (
                      <input
                        type="number"
                        value={limitInputs.premium}
                        onChange={(e) => setLimitInputs({ ...limitInputs, premium: e.target.value })}
                        placeholder="输入限额"
                        min="0"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {limitConfig.usingEnvPremium ? `环境变量 (${limitConfig.envPremiumLimit})` : limitConfig.premiumUserDailyLimit}
                  </p>
                </div>

                {/* 新用户限额 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新用户每日限额
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={limitInputs.useEnvNew}
                        onChange={(e) => {
                          setLimitInputs({
                            ...limitInputs,
                            useEnvNew: e.target.checked,
                            newer: e.target.checked ? '' : limitConfig.newUserDailyLimit.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({limitConfig.envNewLimit})</span>
                    </label>
                    {!limitInputs.useEnvNew && (
                      <input
                        type="number"
                        value={limitInputs.newer}
                        onChange={(e) => setLimitInputs({ ...limitInputs, newer: e.target.value })}
                        placeholder="输入限额"
                        min="0"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {limitConfig.usingEnvNew ? `环境变量 (${limitConfig.envNewLimit})` : limitConfig.newUserDailyLimit}
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleUpdateLimitConfig}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all shadow-sm hover:shadow-md"
                  >
                    保存设置
                  </button>
                  <button
                    onClick={() => {
                      fetchLimitConfig() // 重置输入
                    }}
                    className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    重置
                  </button>
                </div>
              </div>
            </div>

            {/* 积分配置卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">积分配置</h2>
                  <p className="text-sm text-gray-500 mt-1">配置用户积分发放规则和消费规则</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* 普通用户每日积分 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    普通用户每日积分
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pointsInputs.useEnvRegular}
                        onChange={(e) => {
                          setPointsInputs({
                            ...pointsInputs,
                            useEnvRegular: e.target.checked,
                            regular: e.target.checked ? '' : pointsConfig.regularUserDailyPoints.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({pointsConfig.envRegularPoints})</span>
                    </label>
                    {!pointsInputs.useEnvRegular && (
                      <input
                        type="number"
                        value={pointsInputs.regular}
                        onChange={(e) => setPointsInputs({ ...pointsInputs, regular: e.target.value })}
                        placeholder="输入积分"
                        min="0"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {pointsConfig.usingEnvRegular ? `环境变量 (${pointsConfig.envRegularPoints})` : pointsConfig.regularUserDailyPoints}
                  </p>
                </div>

                {/* 优质用户每日积分 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    优质用户每日积分
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pointsInputs.useEnvPremium}
                        onChange={(e) => {
                          setPointsInputs({
                            ...pointsInputs,
                            useEnvPremium: e.target.checked,
                            premium: e.target.checked ? '' : pointsConfig.premiumUserDailyPoints.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({pointsConfig.envPremiumPoints})</span>
                    </label>
                    {!pointsInputs.useEnvPremium && (
                      <input
                        type="number"
                        value={pointsInputs.premium}
                        onChange={(e) => setPointsInputs({ ...pointsInputs, premium: e.target.value })}
                        placeholder="输入积分"
                        min="0"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {pointsConfig.usingEnvPremium ? `环境变量 (${pointsConfig.envPremiumPoints})` : pointsConfig.premiumUserDailyPoints}
                  </p>
                </div>

                {/* 积分过期天数 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    积分过期天数
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pointsInputs.useEnvExpiry}
                        onChange={(e) => {
                          setPointsInputs({
                            ...pointsInputs,
                            useEnvExpiry: e.target.checked,
                            expiry: e.target.checked ? '' : pointsConfig.pointsExpiryDays.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({pointsConfig.envExpiryDays})</span>
                    </label>
                    {!pointsInputs.useEnvExpiry && (
                      <input
                        type="number"
                        value={pointsInputs.expiry}
                        onChange={(e) => setPointsInputs({ ...pointsInputs, expiry: e.target.value })}
                        placeholder="输入天数"
                        min="1"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {pointsConfig.usingEnvExpiry ? `环境变量 (${pointsConfig.envExpiryDays})` : pointsConfig.pointsExpiryDays} 天
                  </p>
                </div>

                {/* 工作流修复消耗积分 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    工作流修复消耗积分
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={pointsInputs.useEnvRepair}
                        onChange={(e) => {
                          setPointsInputs({
                            ...pointsInputs,
                            useEnvRepair: e.target.checked,
                            repair: e.target.checked ? '' : pointsConfig.repairWorkflowCost.toString(),
                          })
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-600">使用环境变量 ({pointsConfig.envRepairCost})</span>
                    </label>
                    {!pointsInputs.useEnvRepair && (
                      <input
                        type="number"
                        value={pointsInputs.repair}
                        onChange={(e) => setPointsInputs({ ...pointsInputs, repair: e.target.value })}
                        placeholder="输入积分"
                        min="0"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                      />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    当前值: {pointsConfig.usingEnvRepair ? `环境变量 (${pointsConfig.envRepairCost})` : pointsConfig.repairWorkflowCost} 积分/次
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleUpdatePointsConfig}
                    className="px-6 py-2.5 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all shadow-sm hover:shadow-md"
                  >
                    保存设置
                  </button>
                  <button
                    onClick={() => {
                      fetchPointsConfig() // 重置输入
                    }}
                    className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    重置
                  </button>
                </div>
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


