import { NextResponse } from 'next/server';
import { getModelBaseCost } from '@/utils/points';

// 获取模型基础积分消耗（公开API，无需登录）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    // 获取模型基础积分消耗
    const baseCost = await getModelBaseCost(modelId);

    return NextResponse.json({
      baseCost: baseCost,
    });
  } catch (error) {
    console.error('Error fetching model base cost:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

