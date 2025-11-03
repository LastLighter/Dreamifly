import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 获取数据库连接字符串，如果还没有时区参数，添加时区设置
const getConnectionString = (): string => {
  const dbUrl = process.env.DATABASE_URL;
  
  // 构建时 DATABASE_URL 可能为空，返回一个有效的占位符 URL
  // 这样构建时不会报错，但运行时必须有真实的值
  if (!dbUrl || dbUrl.trim() === '') {
    return 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
  }

  // 如果连接字符串中没有timezone参数，添加它
  if (!dbUrl.includes('timezone')) {
    const separator = dbUrl.includes('?') ? '&' : '?';
    return `${dbUrl}${separator}timezone=Asia/Shanghai`;
  }
  
  return dbUrl;
};

const connectionString = getConnectionString();
const client = postgres(connectionString);
export const db = drizzle(client, { schema }); 