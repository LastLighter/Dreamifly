import { NextResponse } from 'next/server'

export async function GET() {
  const backendVersion = process.env.BACKEND_VERSION || 'unknown'

  return NextResponse.json({
    backendVersion,
  })
}

