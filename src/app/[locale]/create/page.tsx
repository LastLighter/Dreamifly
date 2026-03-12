import { Suspense } from 'react'
import CreateClient from './CreateClient'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'AI 创作 - 文生图 & 图生图 & 视频生成 | Dreamifly',
    description: '使用 Dreamifly 在线 AI 创作工具，支持文生图、图生图、AI 视频生成，多种专业模型任你选择，免费试用。',
  }
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CreateClient />
    </Suspense>
  )
}

