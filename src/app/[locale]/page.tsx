import { Suspense } from 'react'
import HomeClient from './HomeClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dreamifly - 免费 AI 绘画/视频在线生成工具 | 一键生成动漫、插画、艺术图，多样化视频创作',
  description: 'Dreamifly 是一款免费 AI 绘画与视频创作网站，无需注册，支持文生图、图生图、图生视频等多种 AI 创作方式。提供动漫、插画、写实等多种风格，多台 4090 显卡免费算力支持，让你的创意即刻成图成片。',
}

export default function Home() {
  return (
      <Suspense fallback={<div>Loading...</div>}>
        <HomeClient />
      </Suspense>
  )
}