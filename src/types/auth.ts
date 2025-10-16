// Extended user type with additional fields
export interface ExtendedUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
  uid?: number
  avatar?: string
  nickname?: string
}

// Extended session type
export interface ExtendedSession {
  user: ExtendedUser
  expiresAt: Date
  token: string
  id: string
  createdAt: Date
  updatedAt: Date
  ipAddress?: string
  userAgent?: string
  userId: string
}
