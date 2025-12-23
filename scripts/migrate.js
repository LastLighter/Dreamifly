const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 从环境变量读取数据库配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function runMigration(migrationFileName) {
  const client = await pool.connect();
  try {
    console.log('🚀 开始运行数据库迁移...\n');

    // 读取迁移文件
    const migrationFile = path.join(__dirname, '../drizzle', migrationFileName);
    
    if (!fs.existsSync(migrationFile)) {
      console.error(`❌ 迁移文件不存在: ${migrationFile}`);
      process.exit(1);
    }
    
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    console.log(`📝 执行迁移文件: ${migrationFileName}`);
    console.log('='.repeat(60));
    console.log(migrationSQL);
    console.log('='.repeat(60));
    
    // 执行迁移
    await client.query(migrationSQL);
    console.log('\n✅ 迁移成功完成！\n');

    // 显示所有表
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    console.log('📋 当前数据库中的表:');
    tables.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });

  } catch (err) {
    console.error('❌ 迁移失败:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// 获取命令行参数
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('用法: node scripts/migrate.js <迁移文件名>');
  console.log('示例: node scripts/migrate.js 0022_add_subscription_system.sql');
  console.log('\n可用的迁移文件:');
  
  const drizzleDir = path.join(__dirname, '../drizzle');
  const files = fs.readdirSync(drizzleDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  
  files.forEach(f => console.log(`  - ${f}`));
  process.exit(0);
}

runMigration(args[0]);



