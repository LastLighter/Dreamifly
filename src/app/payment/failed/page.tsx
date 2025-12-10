'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function PaymentFailedContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const orderId = searchParams.get('orderId')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-red-50 via-white to-rose-50 px-4 text-center">
      <div className="mb-4">
        <div className="h-14 w-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.536-11.536a1 1 0 00-1.414-1.414L10 7.172 7.879 5.05a1 1 0 10-1.414 1.414L8.586 8.586l-2.121 2.121a1 1 0 101.414 1.414L10 10l2.121 2.121a1 1 0 101.414-1.414L11.414 8.586l2.122-2.122z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">支付失败</h1>
      <p className="text-gray-600 max-w-md mb-4">支付未成功，请稍后重试或更换支付方式。</p>
      {orderId && <p className="text-sm text-gray-500 mb-6">订单号：{orderId}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition"
        >
          返回首页
        </button>
        <button
          onClick={() => router.push('/[locale]/pricing')}
          className="px-4 py-2 rounded-lg bg-white border border-orange-200 text-orange-700 font-semibold shadow-sm hover:bg-orange-50 transition"
        >
          重新购买
        </button>
      </div>
    </div>
  )
}

function PaymentFailedFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 via-white to-rose-50 px-4 text-center">
      <div className="h-12 w-12 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
      <div className="mt-4 text-gray-700 font-medium">正在加载订单信息...</div>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<PaymentFailedFallback />}>
      <PaymentFailedContent />
    </Suspense>
  )
}

