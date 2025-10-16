const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 从环境变量读取数据库配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🚀 开始运行数据库迁移...\n');

    // 读取迁移文件
    const migrationFile = path.join(__dirname, '../drizzle/0003_add_avatar.sql');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    console.log('📝 执行迁移文件: 0003_add_avatar.sql');
    await client.query(migrationSQL);
    console.log('✅ 迁移成功完成！\n');

    // 验证avatar字段是否存在
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user' AND column_name = 'avatar'
    `);

    if (result.rows.length > 0) {
      console.log('✓ avatar 字段已成功添加到 user 表');
      console.log('  列名:', result.rows[0].column_name);
      console.log('  类型:', result.rows[0].data_type);
      console.log('  默认值:', result.rows[0].column_default);
    } else {
      console.log('⚠ avatar 字段可能已经存在');
    }

  } catch (err) {
    console.error('❌ 迁移失败:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();

