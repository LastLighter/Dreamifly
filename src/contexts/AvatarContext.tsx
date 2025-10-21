'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'

interface AvatarContextType {
  avatar: string
  setAvatar: (avatar: string) => void
  updateAvatar: (newAvatar: string) => void
}

const AvatarContext = createContext<AvatarContextType | undefined>(undefined)

export function AvatarProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const [avatar, setAvatar] = useState('/images/default-avatar.svg')

  // 监听session变化，更新头像
  useEffect(() => {
    if (session?.user) {
      const user = session.user as ExtendedUser
      setAvatar(user.avatar || '/images/default-avatar.svg')
    }
  }, [session?.user?.avatar])

  // 更新头像的方法
  const updateAvatar = (newAvatar: string) => {
    setAvatar(newAvatar)
  }

  return (
    <AvatarContext.Provider value={{ avatar, setAvatar, updateAvatar }}>
      {children}
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
