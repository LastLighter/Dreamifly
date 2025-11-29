'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { usePoints } from '@/contexts/PointsContext'

interface AvatarContextType {
  avatar: string
  nickname: string
  avatarFrameId: number | null
  setAvatar: (avatar: string) => void
  setNickname: (nickname: string) => void
  setAvatarFrameId: (frameId: number | null) => void
  updateAvatar: (newAvatar: string) => void
  updateNickname: (newNickname: string) => void
  updateProfile: (avatar: string, nickname: string) => void
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined)

interface DailyAwardInfo {
  points: number
  expiresInDays: number
  userType: 'regular' | 'premium'
}

export function AvatarProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const { refreshPoints } = usePoints()
  const [avatar, setAvatar] = useState('/images/default-avatar.svg')
  const [nickname, setNickname] = useState('')
  const [avatarFrameId, setAvatarFrameId] = useState<number | null>(null)
  const [dailyAwardInfo, setDailyAwardInfo] = useState<DailyAwardInfo | null>(null)
  const [showDailyAwardModal, setShowDailyAwardModal] = useState(false)

  // 监听session变化，更新头像、昵称和头像框
  useEffect(() => {
    if (session?.user) {
      const user = session.user as ExtendedUser
      setAvatar(user.avatar || '/images/default-avatar.svg')
      setNickname(user.nickname || user.name || '')
      setAvatarFrameId(user.avatarFrameId ?? null)
    }
  }, [session?.user])

  // 更新头像的方法
  const updateAvatar = (newAvatar: string) => {
    setAvatar(newAvatar)
  }

  // 更新昵称的方法
  const updateNickname = (newNickname: string) => {
    console.log('AvatarContext: Updating nickname to:', newNickname)
    setNickname(newNickname)
  }

  // 同时更新头像和昵称的方法
  const updateProfile = (newAvatar: string, newNickname: string) => {
    setAvatar(newAvatar)
    setNickname(newNickname)
  }

  useEffect(() => {
    if (!session?.user?.id) {
      return
    }

    let aborted = false

    const checkDailyAward = async () => {
      try {
        const response = await fetch('/api/points/award-daily', {
          method: 'POST',
        })

        if (!response.ok) {
          return
        }

        const data = await response.json()
        if (!aborted && data.awarded) {
          setDailyAwardInfo({
            points: data.points,
            expiresInDays: data.expiresInDays,
            userType: data.userType === 'premium' ? 'premium' : 'regular',
          })
          setShowDailyAwardModal(true)
          // 刷新积分显示
          await refreshPoints()
        }
      } catch (error) {
        console.error('Failed to check daily award:', error)
      }
    }

    checkDailyAward()

    return () => {
      aborted = true
    }
  }, [session?.user?.id])

  return (
    <AvatarContext.Provider value={{ 
      avatar, 
      nickname,
      avatarFrameId,
      setAvatar, 
      setNickname,
      setAvatarFrameId,
      updateAvatar, 
      updateNickname, 
      updateProfile 
    }}>
      {children}

      {showDailyAwardModal && dailyAwardInfo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 relative">
            <button
              aria-label="Close"
              onClick={() => setShowDailyAwardModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.7 2.288a1 1 0 01.6 0l7 2.333A1 1 0 0120 5.567v6.933c0 3.831-2.82 7.612-8.423 11.334a1 1 0 01-1.154 0C4.82 20.112 2 16.33 2 12.5V5.567a1 1 0 01.7-.946l7-2.333z" />
                </svg>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-orange-600">
                  {dailyAwardInfo.userType === 'premium' ? '优质用户' : '欢迎回来'}
                </p>
                <h3 className="text-lg font-bold text-gray-900">
                  今日签到获得 {dailyAwardInfo.points} 积分
                </h3>
                <p className="text-sm text-gray-600">
                有效期为 {dailyAwardInfo.expiresInDays} 天
                </p>
              </div>

              <button
                onClick={() => setShowDailyAwardModal(false)}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
              >
                知道啦
              </button>
            </div>
          </div>
        </div>
      )}
    </AvatarContext.Provider>
  )
}

export function useAvatar() {
  const context = useContext(AvatarContext)
  if (context === undefined) {
    throw new Error('useAvatar must be used within an AvatarProvider')
  }
  return context
}
