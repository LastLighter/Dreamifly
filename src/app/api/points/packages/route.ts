import { NextResponse } from 'next/server';
import { db } from '@/db';
import { pointsPackage } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

// 获取所有激活的积分套餐
export async function GET() {
  try {
    const packages = await db
      .select()
      .from(pointsPackage)
      .where(eq(pointsPackage.isActive, true))
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



