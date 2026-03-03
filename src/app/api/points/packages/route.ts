import { NextResponse } from 'next/server';
import { db } from '@/db';
import { pointsPackage } from '@/db/schema';
import { eq, asc, and } from 'drizzle-orm';

// 获取所有激活且需在前端展示的积分套餐
export async function GET() {
  try {
    const packages = await db
      .select()
      .from(pointsPackage)
      .where(
        and(
          eq(pointsPackage.isActive, true),
          eq(pointsPackage.showOnFrontend, true)
        )
      )
      .orderBy(asc(pointsPackage.sortOrder));

    return NextResponse.json({
      success: true,
      packages,
    });
  } catch (error) {
    console.error('Error fetching points packages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}










