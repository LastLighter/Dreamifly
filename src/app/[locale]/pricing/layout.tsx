import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '定价方案 - 会员订阅与积分套餐 | Dreamifly',
  description: '查看 Dreamifly 定价方案，提供灵活的会员订阅和积分套餐，解锁更多 AI 创作权益。',
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
