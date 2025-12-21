import { NextRequest, NextResponse } from 'next/server';
import { getAllAvatarFrames } from '@/utils/avatarFrame';

/**
 * 获取所有头像框列表（公开API，无需管理员权限）
 * GET /api/avatar-frames
 */
export async function GET(request: NextRequest) {
  try {
    const frames = await getAllAvatarFrames();
    
    return NextResponse.json({ frames });
  } catch (error) {
    console.error('Error fetching avatar frames:', error);
    return NextResponse.json(
      { error: '获取头像框列表失败' },
      { status: 500 }
    );
  }
}

