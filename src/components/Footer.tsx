'use client'

import { useTranslations } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')
  const webVersion = process.env.NEXT_PUBLIC_NEXT_PUBLIC_WEB_VERSION || ''

  return (
    <footer className="bg-gray-100/80 backdrop-blur-md border-t border-orange-400/20">
      <div className="container mx-auto px-8 py-6">
        <div className="text-center text-gray-700">
          {webVersion && <p className="mb-2">{webVersion}</p>}
          <p>{t('copyright')}</p>
        </div>
      </div>
    </footer>
  )
} 