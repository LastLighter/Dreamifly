import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// 获取数据库连接字符串，如果还没有时区参数，添加时区设置
let connectionString = process.env.DATABASE_URL!;
// 如果连接字符串中没有timezone参数，添加它
if (!connectionString.includes('timezone')) {
  const separator = connectionString.includes('?') ? '&' : '?';
  connectionString = `${connectionString}${separator}timezone=Asia/Shanghai`;
}

const client = postgres(connectionString);
export const db = drizzle(client, { schema }); 