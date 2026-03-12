import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '我的作品 - AI 创作作品管理 | Dreamifly',
  description: '查看和管理你在 Dreamifly 生成的所有 AI 绘画与视频作品，支持下载和分享。',
}

export default function MyWorksLayout({ children }: { children: React.ReactNode }) {
  return children
}
