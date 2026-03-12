import type { MetadataRoute } from 'next'

const locales = ['zh', 'zh-TW', 'en']

// 公开页面及其优先级、更新频率
const pages = [
  { path: '',            priority: 1.0,  changeFrequency: 'daily'   as const },
  { path: '/create',     priority: 0.9,  changeFrequency: 'weekly'  as const },
  { path: '/workflows',  priority: 0.8,  changeFrequency: 'weekly'  as const },
  { path: '/pricing',    priority: 0.7,  changeFrequency: 'monthly' as const },
  { path: '/new-year-wish', priority: 0.5, changeFrequency: 'monthly' as const },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://dreamifly.com'
  const now = new Date()

  return locales.flatMap(locale =>
    pages.map(({ path, priority, changeFrequency }) => ({
      url: `${baseUrl}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }))
  )
}