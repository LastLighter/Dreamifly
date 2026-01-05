import { createHash, randomBytes } from 'crypto';

/**
 * 生成不易破解的CDK代码
 * 使用随机盐值 + 时间戳 + 随机数据，通过SHA256哈希生成
 * 格式：XXXX-XXXX-XXXX-XXXX（每4个字符一组，用连字符分隔）
 */
export function generateCDK(): string {
  // 生成32字节随机数据
  const randomData = randomBytes(32);

  // 添加时间戳（精确到分钟，避免太频繁）
  const timestamp = Math.floor(Date.now() / 60000); // 分钟级时间戳

  // 添加随机盐值
  const salt = randomBytes(16);

  // 组合数据：随机数据 + 时间戳 + 盐值
  const combined = Buffer.concat([
    randomData,
    Buffer.from(timestamp.toString()),
    salt
  ]);

  // 使用SHA256生成哈希
  const hash = createHash('sha256')
    .update(combined)
    .digest('hex')
    .toUpperCase();

  // 格式化为XXXX-XXXX-XXXX-XXXX格式
  const formatted = hash.match(/.{1,4}/g)?.join('-') || hash;

  return formatted.substring(0, 19); // 确保长度一致
}

/**
 * 验证CDK格式
 */
export function validateCDKFormat(code: string): boolean {
  const cdkRegex = /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/;
  return cdkRegex.test(code);
}

/**
 * 获取CDK配置
 * 优先级：数据库配置 > 环境变量 > 默认值（5次）
 */
export async function getCDKConfig(): Promise<{ userDailyLimit: number }> {
  const { db } = await import('@/db');
  const { cdkConfig } = await import('@/db/schema');
  const { eq } = await import('drizzle-orm');

  try {
    const config = await db.select()
      .from(cdkConfig)
      .where(eq(cdkConfig.id, 1))
      .limit(1);

    if (config.length > 0 && config[0].userDailyLimit !== null) {
      // 数据库配置存在，直接返回
      return { userDailyLimit: config[0].userDailyLimit };
    }
  } catch (error) {
    console.error('获取数据库CDK配置失败:', error);
  }

  // 数据库配置不存在或查询失败，使用环境变量 > 默认值
  const envLimit = parseInt(process.env.CDK_USER_DAILY_LIMIT || '5', 10);

  return { userDailyLimit: envLimit };
}
