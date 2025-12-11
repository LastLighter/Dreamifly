import { Inter } from 'next/font/google'
import '@/app/globals.css'
import { defaultLocale } from '@/config'
import { NextIntlClientProvider } from 'next-intl'

const inter = Inter({ subsets: ['latin'] })

async function getMessages(locale: string) {
  try {
    return (await import(`@/messages/${locale}.json`)).default
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return {}
  }
}

export default async function PaymentLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  // 为 payment 路由加载默认 locale 的消息
  const messages = await getMessages(defaultLocale)

  return (
    <html lang={defaultLocale}>
      <body className={inter.className}>
        <NextIntlClientProvider locale={defaultLocale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}

