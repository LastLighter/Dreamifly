'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

type OrderStatus = 'idle' | 'processing' | 'paid' | 'failed' | 'error'

function PaymentProcessingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')

  const [, setStatus] = useState<OrderStatus>('idle')
  const [message, setMessage] = useState<string>('正在查询支付状态，请稍候...')

  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const pollingInterval = 5000
    const maxAttempts = Math.ceil((30 * 60 * 1000) / pollingInterval) // 支付宝订单30分钟关闭，轮询覆盖支付窗口

    const poll = async (attempt = 0) => {
      if (stopped) return
      if (!orderId) {
        setStatus('error')
        setMessage('缺少订单号，请返回重试。')
        return
      }

      if (attempt >= maxAttempts) {
        setStatus('processing')
        setMessage('支付结果确认中，请稍后在订单记录或个人中心查看。')
        return
      }

      try {
        const res = await fetch(`/api/alipay/query?orderId=${orderId}`, {
          credentials: 'include',
        })

        if (!res.ok) {
          throw new Error('查询失败')
        }

        const data = await res.json()
        const oStatus = data?.order?.status
        const alipayStatus = data?.order?.alipayStatus

        if (oStatus === 'paid') {
          router.replace(`/payment/success?orderId=${orderId}`)
          return
        }

        if (oStatus === 'failed') {
          router.replace(`/payment/failed?orderId=${orderId}`)
          return
        }

        if (
          oStatus === 'processing' ||
          alipayStatus === 'TRADE_SUCCESS' ||
          alipayStatus === 'TRADE_FINISHED'
        ) {
          setStatus('processing')
          setMessage('支付已提交，正在确认结果...')
        } else {
          setStatus('processing')
          setMessage('等待支付，请在支付宝完成付款。')
        }

        timer = setTimeout(() => poll(attempt + 1), pollingInterval)
      } catch (error) {
        console.error('查询支付状态失败:', error)
        setStatus('processing')
        setMessage('网络波动，正在重试查询...')
        timer = setTimeout(() => poll(attempt + 1), 3000)
      }
    }

    poll(0)

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [orderId, router])

  if (!orderId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
        <div className="text-2xl font-semibold text-gray-900 mb-2">缺少订单号</div>
        <p className="text-gray-600 mb-6">请返回重新发起支付。</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition"
        >
          返回首页
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 via-white to-amber-50 px-4 text-center">
      <div className="mb-4">
        <div className="h-12 w-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">订单处理中</h1>
      <p className="text-gray-600 max-w-md mb-4">{message}</p>
      <p className="text-sm text-gray-500">订单号：{orderId}</p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={() => router.refresh()}
          className="px-4 py-2 rounded-lg bg-white border border-orange-200 text-orange-700 font-semibold shadow-sm hover:bg-orange-50 transition"
        >
          刷新状态
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition"
        >
          返回首页
        </button>
      </div>
    </div>
  )
}

function ProcessingFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <div className="h-12 w-12 border-4 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      <div className="mt-4 text-gray-700 font-medium">正在加载订单信息...</div>
    </div>
  )
}

export default function PaymentProcessingPage() {
  return (
    <Suspense fallback={<ProcessingFallback />}>
      <PaymentProcessingContent />
    </Suspense>
  )
}

