import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI 新年许愿机 - 定制专属新年愿望图 | Dreamifly',
  description: '上传你的照片，让 Dreamifly AI 为你生成专属新年愿望九宫格，定制独一无二的新年祝福图。',
}

export default function NewYearWishLayout({ children }: { children: React.ReactNode }) {
  return children
}
