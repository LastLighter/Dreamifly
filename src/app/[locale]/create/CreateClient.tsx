'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import GenerateSection from '@/components/GenerateSection'
import TencentAds from '@/components/TencentAds'
import community from '../communityWorks'

export default function CreateClient() {
  const searchParams = useSearchParams()
  const communityWorks = community

  const initialPrompt = useMemo(() => {
    return searchParams.get('prompt') || ''
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 overflow-x-hidden">
      <main className="transition-all duration-300 mx-auto lg:pl-40 pt-10 sm:pt-8 lg:pt-2 lg:mt-0">
        <GenerateSection
          communityWorks={communityWorks}
          initialPrompt={initialPrompt}
        />

        <div className="relative py-6 px-5 sm:px-8 lg:px-40 z-20">
          <div id="create-ad-bottom"></div>
          <TencentAds placementId="8232358642752084" containerId="create-ad-bottom" />
        </div>
      </main>
    </div>
  )
}

