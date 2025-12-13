import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserGeneratedImages } from '@/utils/userImageStorage'

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const images = await getUserGeneratedImages(session.user.id)
    
    return NextResponse.json({
      success: true,
      images: images.map(img => ({
        ...img,
        createdAt: img.createdAt.toISOString(),
      })),
      count: images.length,
    })
  } catch (error) {
    console.error('Error fetching user images:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

