'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'

function PaymentSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const locale = useLocale()
  const orderId = searchParams.get('orderId')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 via-white to-emerald-50 px-4 text-center">
      <div className="mb-4">
        <div className="h-14 w-14 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8.25 8.25a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414l2.293 2.293 7.543-7.543a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">支付成功</h1>
      <p className="text-gray-600 max-w-md mb-4">感谢您的购买，订单已支付成功！</p>
      {orderId && <p className="text-sm text-gray-500 mb-6">订单号：{orderId}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white font-semibold shadow hover:bg-orange-600 transition"
        >
          返回首页
        </button>
        <button
          onClick={() => router.push(`/${locale}/profile`)}
          className="px-4 py-2 rounded-lg bg-white border border-orange-200 text-orange-700 font-semibold shadow-sm hover:bg-orange-50 transition"
        >
          查看账户
        </button>
      </div>
    </div>
  )
}

function PaymentSuccessFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 via-white to-emerald-50 px-4 text-center">
      <div className="h-12 w-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
      <div className="mt-4 text-gray-700 font-medium">正在加载订单信息...</div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}

