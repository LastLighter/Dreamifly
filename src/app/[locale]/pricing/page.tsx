'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSession } from '@/lib/auth-client'

interface SubscriptionPlan {
  id: number
  name: string
  type: string
  price: number
  originalPrice: number | null
  bonusPoints: number
  dailyPointsMultiplier: number
  description: string | null
  features: string[]
  isPopular: boolean
  isActive: boolean
}

interface PointsPackage {
  id: number
  name: string
  nameTag: string | null
  points: number
  price: number
  originalPrice: number | null
  isPopular: boolean
  isActive: boolean
}

export default function PricingPage() {
  const t = useTranslations('pricing')
  const { data: session } = useSession()

  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [pointsPackages, setPointsPackages] = useState<PointsPackage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'subscription' | 'points'>('subscription')
  const [, setSelectedPlan] = useState<number | null>(null)
  const [, setSelectedPackage] = useState<number | null>(null)
  const [payingPlanId, setPayingPlanId] = useState<number | null>(null)
  const [payingPackageId, setPayingPackageId] = useState<number | null>(null)
  const comparisonRef = useRef<HTMLDivElement | null>(null)
  const tabsRef = useRef<HTMLDivElement | null>(null)
  const pollingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCreatingOrder = payingPlanId !== null || payingPackageId !== null

  const highlightPills = [
    {
      title: t('highlights.instant'),
      desc: t('highlights.instantDesc'),
      accent: 'from-orange-400/90 to-amber-400/90',
    },
    {
      title: t('highlights.flexible'),
      desc: t('highlights.flexibleDesc'),
      accent: 'from-amber-400/90 to-yellow-400/90',
    },
    {
      title: t('highlights.aesthetic'),
      desc: t('highlights.aestheticDesc'),
      accent: 'from-orange-500/80 to-pink-500/80',
    },
    {
      title: t('highlights.commercialSafe'),
      desc: t('highlights.commercialSafeDesc'),
      accent: 'from-emerald-400/80 to-teal-400/80',
    },
  ]

  const statBlocks = [
    { value: t('stats.value1.value'), label: t('stats.value1.label') },
    { value: t('stats.value2.value'), label: t('stats.value2.label') },
    { value: t('stats.value3.value'), label: t('stats.value3.label') },
  ]

  const comparisonFeatures = [
    {
      key: 'bonusPoints',
      name: t('comparison.features.bonusPoints.name'),
      member: t('comparison.features.bonusPoints.member'),
      registered: t('comparison.features.bonusPoints.registered'),
      guest: t('comparison.features.bonusPoints.guest'),
    },
    {
      key: 'dailyPoints',
      name: t('comparison.features.dailyPoints.name'),
      member: t('comparison.features.dailyPoints.member'),
      registered: t('comparison.features.dailyPoints.registered'),
      guest: t('comparison.features.dailyPoints.guest'),
    },
    {
      key: 'watermark',
      name: t('comparison.features.watermark.name'),
      member: t('comparison.features.watermark.member'),
      registered: t('comparison.features.watermark.registered'),
      guest: t('comparison.features.watermark.guest'),
    },
    {
      key: 'adFree',
      name: t('comparison.features.adFree.name'),
      member: t('comparison.features.adFree.member'),
      registered: t('comparison.features.adFree.registered'),
      guest: t('comparison.features.adFree.guest'),
    },
    {
      key: 'speed',
      name: t('comparison.features.speed.name'),
      member: t('comparison.features.speed.member'),
      registered: t('comparison.features.speed.registered'),
      guest: t('comparison.features.speed.guest'),
    },
    {
      key: 'privacy',
      name: t('comparison.features.privacy.name'),
      member: t('comparison.features.privacy.member'),
      registered: t('comparison.features.privacy.registered'),
      guest: t('comparison.features.privacy.guest'),
    },
  ]

  // 获取套餐数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [plansRes, packagesRes] = await Promise.all([
          fetch('/api/subscription/plans'),
          fetch('/api/points/packages'),
        ])

        if (plansRes.ok) {
          const plansData = await plansRes.json()
          setSubscriptionPlans(plansData.plans || [])
        }

        if (packagesRes.ok) {
          const packagesData = await packagesRes.json()
          setPointsPackages(packagesData.packages || [])
        }
      } catch (error) {
        console.error('Failed to fetch pricing data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  useEffect(() => {
    return () => {
      if (pollingTimer.current) {
        clearTimeout(pollingTimer.current)
      }
    }
  }, [])

  const clearPolling = () => {
    if (pollingTimer.current) {
      clearTimeout(pollingTimer.current)
      pollingTimer.current = null
    }
  }

  const pollOrderStatus = async (orderId: string, attempt = 0) => {
    const pollingInterval = 6000
    const maxAttempts = Math.ceil((30 * 60 * 1000) / pollingInterval) // 支付宝订单30分钟关闭，轮询覆盖整个支付窗口
    if (attempt >= maxAttempts) {
      clearPolling()
      setPayingPlanId(null)
      setPayingPackageId(null)
      console.warn('支付结果正在确认，请稍后在订单记录或个人中心查看。')
      return
    }

    try {
      const res = await fetch(`/api/alipay/query?orderId=${orderId}`, {
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('查询支付状态失败')
      }

      const data = await res.json()
      const status = data?.order?.status
      const alipayStatus = data?.order?.alipayStatus

      if (status === 'paid') {
        clearPolling()
        setPayingPlanId(null)
        setPayingPackageId(null)
        console.info('支付成功，感谢您的购买！')
        return
      }

      if (status === 'failed') {
        clearPolling()
        setPayingPlanId(null)
        setPayingPackageId(null)
        console.warn('支付失败，请稍后重试。')
        return
      }

      // processing 或支付宝已返回成功但本地仍待处理，继续轮询
      if (
        status === 'processing' ||
        alipayStatus === 'TRADE_SUCCESS' ||
        alipayStatus === 'TRADE_FINISHED'
      ) {
        pollingTimer.current = setTimeout(() => pollOrderStatus(orderId, attempt + 1), pollingInterval)
        return
      }

      pollingTimer.current = setTimeout(() => pollOrderStatus(orderId, attempt + 1), pollingInterval)
    } catch (error) {
      console.error('查询支付状态失败:', error)
      pollingTimer.current = setTimeout(() => pollOrderStatus(orderId, attempt + 1), 4000)
    }
  }

  const startPayment = async (options: { orderType: 'subscription' | 'points'; productId: number }) => {
    clearPolling()
    if (options.orderType === 'subscription') {
      setPayingPlanId(options.productId)
      setPayingPackageId(null)
    } else {
      setPayingPackageId(options.productId)
      setPayingPlanId(null)
    }

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderType: options.orderType,
          productId: options.productId,
          paymentMethod: 'alipay',
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || '创建订单失败，请稍后重试。')
      }

      if (!data?.paymentUrl || !data?.orderId) {
        throw new Error('未获取到支付链接，请稍后重试。')
      }

      console.info('正在跳转支付宝，请在新页面完成支付。')
      const opened = window.open(data.paymentUrl, '_blank')
      if (!opened) {
        window.location.href = data.paymentUrl
      }

      pollOrderStatus(data.orderId)
    } catch (error) {
      console.error('创建订单失败:', error)
      setPayingPlanId(null)
      setPayingPackageId(null)
    } finally {
      // 创建订单期间展示加载提示，完成后恢复按钮
      setPayingPlanId((prev) => (options.orderType === 'subscription' && prev === options.productId ? null : prev))
      setPayingPackageId((prev) => (options.orderType === 'points' && prev === options.productId ? null : prev))
    }
  }

  const scrollToTabs = (tab: 'subscription' | 'points') => {
    setActiveTab(tab)
    requestAnimationFrame(() => {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const scrollToComparison = () => {
    scrollToTabs('subscription')
  }

  const getBillingLabel = (planType: string) => {
    if (planType === 'monthly') return t('perMonth')
    if (planType === 'yearly') return t('perYear')
    if (planType === 'quarterly') return t('perQuarter')
    return ''
  }

  const handleSubscribe = async (planId: number) => {
    if (!session?.user) {
      // 提示登录
      console.warn(t('loginRequired'))
      return
    }

    setSelectedPlan(planId)
    await startPayment({ orderType: 'subscription', productId: planId })
  }

  const handleBuyPoints = async (packageId: number) => {
    if (!session?.user) {
      console.warn(t('loginRequired'))
      return
    }

    setSelectedPackage(packageId)
    await startPayment({ orderType: 'points', productId: packageId })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#fff7ed] via-white to-orange-50/60">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-32 -top-10 h-80 w-80 rounded-full bg-orange-200/30 blur-3xl" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-amber-100/50 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,183,94,0.15),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(253,164,175,0.12),transparent_30%)]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 lg:px-8 py-12 lg:py-16 space-y-12">
        <section className="relative overflow-hidden rounded-[32px] border border-orange-100/80 bg-white/80 shadow-[0_30px_80px_-40px_rgba(255,115,29,0.35)] backdrop-blur-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/70" />
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-orange-300/30 to-amber-200/30 blur-3xl" />
          <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-orange-400/15 blur-3xl" />

          <div className="relative grid gap-10 items-center p-8 lg:p-12 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/90 px-4 py-2 text-sm font-medium text-orange-700 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                {t('heroLabel')}
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900 tracking-tight">
                  {t('heroTitle')}
                </h1>
                <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
                  {t('heroSubtitle')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={scrollToComparison}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 via-orange-400 to-amber-400 px-6 py-3 text-white font-semibold shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:shadow-xl"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2.003 5.884 10 1l7.997 4.884v8.232L10 19l-7.997-4.884V5.884z" />
                  </svg>
                  {t('heroCtaSubscribe')}
                </button>
                <button
                  onClick={() => scrollToTabs('points')}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white/80 px-6 py-3 text-orange-700 font-semibold shadow-sm backdrop-blur transition hover:border-orange-300 hover:-translate-y-0.5"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 4a.75.75 0 10-1.5 0v2.25H7a.75.75 0 100 1.5h2.25V12a.75.75 0 101.5 0V9.75H13a.75.75 0 100-1.5h-2.25V6z" />
                  </svg>
                  {t('heroCtaPoints')}
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {highlightPills.map((item) => (
                  <div
                    key={item.title}
                    className="group relative overflow-hidden rounded-2xl border border-orange-100/70 bg-white/80 p-4 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${item.accent} opacity-10`} />
                    <div className="relative space-y-2">
                      <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                        <span className="h-2 w-2 rounded-full bg-orange-400" />
                        {item.title}
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-100/60 via-white to-amber-100/50 blur-xl" />
              <div className="relative space-y-5 rounded-3xl border border-orange-100/80 bg-white/80 p-6 shadow-lg backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-orange-600 uppercase tracking-wide">{t('title')}</span>
                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                    <span className="h-2 w-2 rounded-full bg-orange-400" />
                    {t('viewBenefits')}
                  </div>
                </div>

                <div className="space-y-3">
                  {statBlocks.map((stat) => (
                    <div
                      key={stat.label}
                      className="flex items-center justify-between rounded-2xl border border-orange-100/80 bg-white/70 px-4 py-3 shadow-sm"
                    >
                      <div className="text-sm text-gray-500">{stat.label}</div>
                      <div className="text-xl font-bold text-gray-900">{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50/80 via-white to-amber-50/80 p-4 shadow-inner space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-white flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884 10 1l7.997 4.884v8.232L10 19l-7.997-4.884V5.884z" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{t('heroCtaSubscribe')}</p>
                      <p className="text-xs text-gray-500">{t('subtitle')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                    {highlightPills.map((pill) => (
                      <div key={pill.title} className="flex items-center gap-1 rounded-lg bg-white/70 px-2 py-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                        <span className="truncate">{pill.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div ref={tabsRef} className="flex justify-center">
          <div className="inline-flex rounded-full border border-orange-100 bg-white/90 p-1 shadow-sm backdrop-blur">
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition ${
                activeTab === 'subscription'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md'
                  : 'text-gray-700 hover:text-orange-600'
              }`}
            >
              {t('subscriptionTab')}
            </button>
            <button
              onClick={() => setActiveTab('points')}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition ${
                activeTab === 'points'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-md'
                  : 'text-gray-700 hover:text-orange-600'
              }`}
            >
              {t('pointsTab')}
            </button>
          </div>
        </div>

        {activeTab === 'subscription' && (
          <div className="space-y-10" id="subscription">
            <div className="grid gap-6 sm:grid-cols-2">
              {subscriptionPlans.length === 0 && (
                <div className="sm:col-span-2 rounded-2xl border border-dashed border-gray-200 bg-white/80 p-10 text-center shadow-sm">
                  <p className="text-lg font-semibold text-gray-900">{t('subscriptionEmptyTitle')}</p>
                  <p className="mt-2 text-sm text-gray-500">{t('subscriptionEmptyDesc')}</p>
                </div>
              )}

              {subscriptionPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`relative overflow-hidden rounded-2xl border transition-all shadow-md hover:-translate-y-1 hover:shadow-2xl ${
                    plan.type === 'yearly'
                      ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {plan.type === 'yearly' && (
                    <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-orange-700 shadow">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      {t('recommended')}
                    </div>
                  )}

                  <div className="p-6 space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-sm text-gray-500">{plan.description}</p>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900">¥{plan.price}</span>
                      {plan.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">¥{plan.originalPrice}</span>
                      )}
                      <span className="text-sm text-gray-500">{getBillingLabel(plan.type)}</span>
                    </div>

                    <div className="rounded-xl bg-white/85 p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-inner">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          {(() => {
                            // 计算30天签到积分：基础积分20 * 倍数 * 30天
                            const baseDailyPoints = 20; // 基础每日积分
                            const dailyCheckinPoints = Math.round(baseDailyPoints * plan.dailyPointsMultiplier * 30);
                            const totalPoints = plan.bonusPoints + dailyCheckinPoints;
                            
                            // 获取倍数文本
                            let multiplierText = '';
                            if (plan.dailyPointsMultiplier === 5) {
                              multiplierText = t('multiplierFive');
                            } else if (plan.dailyPointsMultiplier === 2) {
                              multiplierText = t('multiplierDouble');
                            } else {
                              multiplierText = t('multiplierN', { n: plan.dailyPointsMultiplier });
                            }
                            
                            return (
                              <>
                                <p className="font-semibold text-orange-700">
                                  {t('bonusPoints', { points: plan.bonusPoints })}
                                  {t('totalPoints', { total: totalPoints })}
                                </p>
                                <p className="text-sm text-orange-600">
                                  {t('dailyMultiplier', { multiplier: multiplierText })}
                                </p>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-3">
                      {(plan.features && plan.features.length > 0
                        ? plan.features
                        : plan.type === 'monthly' || plan.type === 'quarterly'
                          ? ['无生成水印', '极速生成']
                          : []
                      ).map((feature, index) => (
                        <li key={index} className="flex items-center gap-3 text-sm text-gray-700">
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={isCreatingOrder}
                      aria-busy={payingPlanId === plan.id}
                      className={`w-full rounded-xl py-3 text-sm font-semibold transition ${
                        plan.type === 'yearly'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg hover:shadow-xl'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } ${isCreatingOrder ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      {payingPlanId === plan.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          请稍后…
                        </span>
                      ) : (
                        t('subscribe')
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              ref={comparisonRef}
              id="membership-comparison"
              className="space-y-5 rounded-3xl border border-orange-100/80 bg-white/80 p-6 shadow-lg backdrop-blur"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-bold text-gray-900">{t('comparison.title')}</p>
                  <p className="text-sm text-gray-600">{t('comparison.subtitle')}</p>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-50 to-amber-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  <span className="h-2 w-2 rounded-full bg-orange-400" />
                  {t('heroCtaSubscribe')}
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white/80 shadow-inner">
                <div className="grid grid-cols-4 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-orange-700">
                  <div>{t('comparison.feature')}</div>
                  <div className="text-center">{t('comparison.member')}</div>
                  <div className="text-center">{t('comparison.registered')}</div>
                  <div className="text-center">{t('comparison.guest')}</div>
                </div>

                <div className="divide-y divide-orange-50">
                  {comparisonFeatures.map((feature) => (
                    <div key={feature.key} className="grid grid-cols-4 items-center px-4 py-3 text-sm text-gray-700">
                      <div className="font-semibold text-gray-900">{feature.name}</div>
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-orange-50/60 px-3 py-2 text-orange-700">
                        <span className="h-2 w-2 rounded-full bg-orange-400" />
                        <span className="text-center">{feature.member}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-gray-700">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        <span className="text-center">{feature.registered}</span>
                      </div>
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-gray-500">
                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                        <span className="text-center">{feature.guest}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'points' && (
          <div className="space-y-8">
            <div className="overflow-hidden rounded-2xl border border-orange-100/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-lg">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">{t('pointsTab')}</p>
                  <p className="text-lg text-gray-800">
                    {t('pointsExchange')} <span className="font-bold text-orange-600">100 {t('points')} = ¥1</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 rounded-full bg-white/85 px-4 py-2 text-sm text-gray-700 shadow-sm">
                  <svg className="h-4 w-4 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7.414A2 2 0 0016.586 6L13 2.414A2 2 0 0011.586 2H5zm5 4a1 1 0 00-1 1v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8a1 1 0 00-1-1z" />
                  </svg>
                  <span className="font-semibold text-orange-700">{t('heroCtaPoints')}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {pointsPackages.length === 0 && (
                <div className="sm:col-span-3 rounded-2xl border border-dashed border-gray-200 bg-white/80 p-10 text-center shadow-sm">
                  <p className="text-lg font-semibold text-gray-900">{t('pointsEmptyTitle')}</p>
                  <p className="mt-2 text-sm text-gray-500">{t('pointsEmptyDesc')}</p>
                </div>
              )}

              {pointsPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`relative overflow-hidden rounded-2xl border transition-all shadow-md hover:-translate-y-1 hover:shadow-2xl ${
                    pkg.isPopular
                      ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {pkg.isPopular && (
                    <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-orange-700 shadow">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      {t('popular')}
                    </div>
                  )}

                  <div className="p-6 space-y-5">
                    <div className="space-y-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {pkg.name}
                        {pkg.nameTag && <span className="ml-2 text-lg font-bold text-gray-900">{pkg.nameTag}</span>}
                      </h3>
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span className="text-2xl font-bold text-orange-600">{pkg.points}</span>
                        <span className="text-sm text-gray-500">{t('points')}</span>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-gray-900">¥{pkg.price}</span>
                      {pkg.originalPrice && (
                        <span className="text-sm text-gray-400 line-through">¥{pkg.originalPrice}</span>
                      )}
                    </div>

                    <button
                      onClick={() => handleBuyPoints(pkg.id)}
                      disabled={isCreatingOrder}
                      aria-busy={payingPackageId === pkg.id}
                      className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${
                        pkg.isPopular
                          ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-lg hover:shadow-xl'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      } ${isCreatingOrder ? 'cursor-not-allowed opacity-80' : ''}`}
                    >
                      {payingPackageId === pkg.id ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          请稍后…
                        </span>
                      ) : (
                        t('buy')
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 text-center text-sm text-gray-500">
          {t('notice')}
        </div>
      </div>
    </div>
  )
}

