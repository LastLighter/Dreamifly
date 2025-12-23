/**
 * 服务启动时重置 IP 并发计数
 * 通过环境变量 RESET_CONCURRENCY_ON_STARTUP 控制是否执行
 */

const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const { sql } = require('drizzle-orm');
const fs = require('fs');
const path = require('path');

// 加载环境变量文件（按照 Next.js 的优先级：.env.local > .env）
function loadEnvFiles() {
  // 先加载 .env，然后加载 .env.local（.env.local 会覆盖 .env 中的值）
  const envFiles = ['.env', '.env.local'];
  
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        // 跳过注释和空行
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
          continue;
        }
        
        // 解析 KEY=VALUE 格式
        const match = trimmedLine.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          
          // 移除引号（如果存在）
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // 直接设置（.env.local 后加载，会覆盖 .env 中的值）
          process.env[key] = value;
        }
      }
    }
  }
}

// 在脚本开始时加载环境变量
loadEnvFiles();

async function resetConcurrencyOnStartup() {
  // 检查环境变量
  const shouldReset = process.env.RESET_CONCURRENCY_ON_STARTUP;
  
  // 如果环境变量未设置或为 false/0/空字符串，则不执行
  if (!shouldReset || shouldReset.toLowerCase() === 'false' || shouldReset === '0' || shouldReset.trim() === '') {
    console.log('[启动初始化] 跳过重置 IP 并发计数（环境变量 RESET_CONCURRENCY_ON_STARTUP 未启用）');
    return;
  }

  try {
    console.log('[启动初始化] 开始重置 IP 并发计数...');
    
    // 获取数据库连接字符串
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl || dbUrl.trim() === '') {
      console.error('[启动初始化] DATABASE_URL 未设置，无法重置 IP 并发计数');
      return;
    }

    // 如果连接字符串中没有timezone参数，添加它
    let connectionString = dbUrl;
    if (!connectionString.includes('timezone')) {
      const separator = connectionString.includes('?') ? '&' : '?';
      connectionString = `${connectionString}${separator}timezone=Asia/Shanghai`;
    }

    // 创建数据库连接
    const client = postgres(connectionString);
    const db = drizzle(client);
    
    // 执行 SQL 更新
    await db.execute(sql`
      UPDATE public.ip_concurrency
      SET current_concurrency = 0
      WHERE current_concurrency != 0
    `);
    
    // 关闭数据库连接
    await client.end();
    
    console.log('[启动初始化] IP 并发计数重置完成');
  } catch (error) {
    console.error('[启动初始化] 重置 IP 并发计数失败:', error);
    // 不抛出错误，避免阻止服务启动
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  resetConcurrencyOnStartup()
    .then(() => {
      // 即使重置失败，也正常退出，不阻止服务启动
      process.exit(0);
    })
    .catch((error) => {
      // 记录错误但不阻止服务启动
      console.error('启动初始化脚本执行失败:', error);
      process.exit(0);
    });
}

module.exports = { resetConcurrencyOnStartup };

