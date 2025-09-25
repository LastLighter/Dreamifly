import { NextResponse } from 'next/server';
import { db } from '@/db';
import { siteStats } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SITE_START_DATE = '2025-05-20T00:10:17Z'; // 网站启动时间

export async function GET() {
  try {
    const stats = await db.select().from(siteStats).where(eq(siteStats.id, 1)).limit(1);

    if (!stats || stats.length === 0) {
      return NextResponse.json({
        totalGenerations: 0,
        dailyGenerations: 0,
        uptime: calculateUptime(),
      });
    }

    // 检查上次重置时间是否为今天
    const lastResetDate = stats[0].lastResetDate ? new Date(stats[0].lastResetDate) : new Date();
    const today = new Date();
    const isSameDay = lastResetDate.getDate() === today.getDate() &&
                     lastResetDate.getMonth() === today.getMonth() &&
                     lastResetDate.getFullYear() === today.getFullYear();

    // 如果不是今天，重置每日统计数据
    if (!isSameDay) {
      await db.update(siteStats)
        .set({
          dailyGenerations: 0,
          lastResetDate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(siteStats.id, 1));

      // 重新获取更新后的统计数据
      const updatedStats = await db.select().from(siteStats).where(eq(siteStats.id, 1)).limit(1);
      
      return NextResponse.json({
        totalGenerations: updatedStats[0].totalGenerations,
        dailyGenerations: updatedStats[0].dailyGenerations,
        uptime: calculateUptime(),
      });
    }

    return NextResponse.json({
      totalGenerations: stats[0].totalGenerations,
      dailyGenerations: stats[0].dailyGenerations,
      uptime: calculateUptime(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}

function calculateUptime() {
  const start = new Date(SITE_START_DATE);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return {
    days,
    hours,
    minutes,
  };
} 