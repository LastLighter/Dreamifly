import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '个人中心 - 账户设置 | Dreamifly',
  description: '管理你的 Dreamifly 账户信息、积分余额和会员权益。',
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children
}
