import { db } from '@/db';
import { avatarFrame } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * 获取用户头像框路径
 * @param avatarFrameId 用户头像框ID，如果为null则返回null（不显示头像框）
 * @returns 头像框图片路径，如果没有则返回null
 */
export async function getUserAvatarFrame(avatarFrameId: number | null | undefined): Promise<string | null> {
  // 如果头像框ID为null或undefined，返回null（不显示头像框）
  if (!avatarFrameId) {
    return null;
  }

  try {
    // 从数据库查询头像框信息
    const frame = await db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.id, avatarFrameId))
      .limit(1);

    // 如果找不到头像框，返回null（不显示头像框）
    if (frame.length === 0) {
      return null;
    }

    const frameData = frame[0];
    
    // 如果头像框的imageUrl为null或空，返回null（不显示头像框）
    if (!frameData.imageUrl || frameData.imageUrl.trim() === '') {
      return null;
    }

    return frameData.imageUrl;
  } catch (error) {
    console.error('Error fetching avatar frame:', error);
    // 发生错误时返回null（不显示头像框）
    return null;
  }
}

/**
 * 获取所有头像框列表
 * @returns 头像框列表
 */
export async function getAllAvatarFrames() {
  try {
    const frames = await db
      .select()
      .from(avatarFrame)
      .orderBy(avatarFrame.createdAt);

    return frames;
  } catch (error) {
    console.error('Error fetching avatar frames:', error);
    return [];
  }
}

/**
 * 根据分类获取头像框列表
 * @param category 头像框分类
 * @returns 头像框列表
 */
export async function getAvatarFramesByCategory(category: string) {
  try {
    const frames = await db
      .select()
      .from(avatarFrame)
      .where(eq(avatarFrame.category, category))
      .orderBy(avatarFrame.createdAt);

    return frames;
  } catch (error) {
    console.error('Error fetching avatar frames by category:', error);
    return [];
  }
}

