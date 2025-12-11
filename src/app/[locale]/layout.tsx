import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { getTranslations } from 'next-intl/server'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/app/globals.css'
import UmamiProvider from 'next-umami'
import { AvatarProvider } from '@/contexts/AvatarContext'
import { PointsProvider } from '@/contexts/PointsContext'
import VersionDisplay from '@/components/VersionDisplay'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { db } from '@/db'
import { user } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { locales, defaultLocale } from '@/config'

const inter = Inter({ subsets: ['latin'] })
const umamiWebsiteId = "7fd99628-3822-4bae-a794-b2d1d8926678"
const umamiSrc = "https://umami.suanleme.cn:3000/script.js"

// 可以选择性地设置缓存时间
async function getMessages(locale: string) {
  // 验证 locale 是否有效
  if (!locales.includes(locale as any)) {
    // 如果 locale 无效，使用默认 locale
    locale = defaultLocale
  }
  
  try {
    return (await import(`@/messages/${locale}.json`)).default
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    notFound()
  }
}

export async function generateMetadata({params}: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const {locale} = await params;
  const t = await getTranslations({locale, namespace: 'site'})
  // 获取当前域名
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://dreamifly.com';

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: 'Dreamifly - 免费AI绘画工具 | AI画图网站在线生成',
      description: 'Dreamifly 是无需注册的AI生图网站，支持动漫、插画、3D风格，提供智能AI绘画服务，让创作更简单。',
      url: siteUrl,
      images: [
        {
          url:  `${siteUrl}/images/dreamifly-logo.jpg`,
          width: 600,
          height: 600,
          alt: 'Dreamifly Logo',
        },
      ],
      type: 'website',
      locale: locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Dreamifly - 免费AI绘画工具 | AI画图网站在线生成',
      description: 'Dreamifly 是无需注册的AI生图网站，支持动漫、插画、3D风格，提供智能AI绘画服务，让创作更简单。',
      images: [ `${siteUrl}/images/dreamifly-logo.jpg`],
    },
  }
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }> | undefined
}) {
  let locale = (await Promise.resolve(params))?.locale || defaultLocale;
  
  // 验证 locale 是否有效，如果无效则使用默认 locale
  if (!locales.includes(locale as any)) {
    locale = defaultLocale
  }
  
  const messages = await getMessages(locale)

  // 更新用户最近登录时间（异步执行，不阻塞渲染）
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session?.user) {
      // 异步更新登录时间，不等待结果
      // 每次页面加载都更新，确保刷新时能正确更新
      const userId = session.user.id
      ;(async () => {
        try {
          // 更新登录时间
          await db
            .update(user)
            .set({
              // 将当前时间转换为UTC并存为无时区
              lastLoginAt: sql`(now() at time zone 'UTC')`,
              updatedAt: sql`(now() at time zone 'UTC')`,
            })
            .where(eq(user.id, userId));
        } catch (error) {
          // 静默处理错误，不影响页面渲染
          console.error('Failed to update last login time:', error);
        }
      })();
    }
  } catch (error) {
    // 静默处理错误，不影响页面渲染
    console.error('Failed to get session for updating last login time:', error);
  }

  return (
    <html lang={locale}>
      <head>
      <UmamiProvider 
          websiteId={umamiWebsiteId} // 替换为你的实际 ID
          src={umamiSrc}
        />
        <meta name="google-site-verification" content="F_mzKY9JDvflHFEEsBGIiItkpIhVwc0sBPqo_UI5VtQ" />
        <meta name="baidu-site-verification" content="codeva-KBWW4lhtr9" />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PointsProvider>
            <AvatarProvider>
              <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-grow">
                  {children}
                </main>
                <Footer />
              </div>
              <VersionDisplay />
            </AvatarProvider>
          </PointsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}