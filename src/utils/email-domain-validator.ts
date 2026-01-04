import { db } from '@/db';
import { allowedEmailDomain } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * 从邮箱地址中提取域名
 */
export function extractDomainFromEmail(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) {
    return null;
  }
  return parts[1].toLowerCase();
}

/**
 * 验证邮箱域名是否在允许列表中且已启用
 */
export async function isEmailDomainAllowed(email: string): Promise<boolean> {
  const domain = extractDomainFromEmail(email);
  if (!domain) {
    return false;
  }

  try {
    const result = await db
      .select()
      .from(allowedEmailDomain)
      .where(
        and(
          eq(allowedEmailDomain.domain, domain),
          eq(allowedEmailDomain.isEnabled, true)
        )
      )
      .limit(1);

    return result.length > 0;
  } catch (error) {
    console.error('Error checking email domain:', error);
    return false;
  }
}

/**
 * 验证163邮箱格式：只允许纯数字+@163.com
 * @param email 邮箱地址
 * @returns 如果是163邮箱且格式正确（纯数字）返回true，否则返回false
 */
export function isValid163Email(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  if (domain !== '163.com') {
    return true; // 不是163邮箱，不在此处验证
  }

  // 提取@前面的部分
  const parts = email.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const localPart = parts[0];
  // 检查是否只包含数字
  return /^\d+$/.test(localPart);
}

/**
 * 获取所有启用的邮箱域名列表
 */
export async function getAllowedEmailDomains(): Promise<string[]> {
  try {
    const result = await db
      .select({ domain: allowedEmailDomain.domain })
      .from(allowedEmailDomain)
      .where(eq(allowedEmailDomain.isEnabled, true));

    return result.map((r) => r.domain);
  } catch (error) {
    console.error('Error fetching allowed email domains:', error);
    return [];
  }
}

