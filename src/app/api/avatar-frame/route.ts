import { NextRequest, NextResponse } from 'next/server';
import { getUserAvatarFrame } from '@/utils/avatarFrame';

/**
 * 获取头像框路径的 API
 * GET /api/avatar-frame?frameId=123
 * 如果 frameId 为 null 或无效，返回 null（不显示头像框）
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const frameIdParam = searchParams.get('frameId');

    // 如果 frameId 为 null 或未提供，返回 null（不显示头像框）
    if (!frameIdParam) {
      return NextResponse.json({
        frameUrl: null
      });
    }

    const frameId = parseInt(frameIdParam, 10);
    
    // 如果 frameId 无效，返回 null（不显示头像框）
    if (isNaN(frameId)) {
      return NextResponse.json({
        frameUrl: null
      });
    }

    // 获取头像框路径
    const frameUrl = await getUserAvatarFrame(frameId);

    return NextResponse.json({
      frameUrl
    });
  } catch (error) {
    console.error('Error in avatar-frame API:', error);
    // 发生错误时返回 null（不显示头像框）
    return NextResponse.json({
      frameUrl: null
    });
  }
}

