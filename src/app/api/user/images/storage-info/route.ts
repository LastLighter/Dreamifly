import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserImageStorageInfo } from '@/utils/userImageStorage'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const info = await getUserImageStorageInfo(session.user.id)
    
    return NextResponse.json({
      ...info,
      subscriptionExpiresAt: info.subscriptionExpiresAt?.toISOString() || null,
    })
  } catch (error) {
    console.error('Error fetching storage info:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}












