import { NextIntlClientProvider } from 'next-intl'
import { notFound } from 'next/navigation'
import '@/app/globals.css'
import { AvatarProvider } from '@/contexts/AvatarContext'

async function getMessagesForLocale(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    notFound()
  }
}

export default async function AdminLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }> | undefined
}) {
  const locale = (await Promise.resolve(params))?.locale || 'zh'
  const messages = await getMessagesForLocale(locale)

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AvatarProvider>
        <div className="admin-page min-h-screen bg-gray-50">
          {children}
        </div>
      </AvatarProvider>
    </NextIntlClientProvider>
  )
}

