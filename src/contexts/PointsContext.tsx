'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'

interface PointsContextType {
  pointsBalance: number | null
  isLoading: boolean
  refreshPoints: () => Promise<void>
}

const PointsContext = createContext<PointsContextType | undefined>(undefined)

export function PointsProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [pointsBalance, setPointsBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const refreshPoints = async () => {
    if (!session?.user) {
      setPointsBalance(null)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/points/balance?t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        setPointsBalance(data.balance || 0)
      }
    } catch (error) {
      console.error('Failed to fetch points balance:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // 初始加载和session变化时获取积分
  useEffect(() => {
    refreshPoints()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user])

  return (
    <PointsContext.Provider value={{ pointsBalance, isLoading, refreshPoints }}>
      {children}
    </PointsContext.Provider>
  )
}

export function usePoints() {
  const context = useContext(PointsContext)
  if (context === undefined) {
    throw new Error('usePoints must be used within a PointsProvider')
  }
  return context
}

