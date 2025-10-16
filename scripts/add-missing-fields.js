const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function addMissingFields() {
  const client = await pool.connect();
  try {
    console.log('🔍 检查user表字段...\n');

    // 检查uid字段
    const uidCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'user' AND column_name = 'uid'
    `);

    if (uidCheck.rows.length === 0) {
      console.log('➕ 添加 uid 字段...');
      await client.query(`ALTER TABLE "user" ADD COLUMN "uid" integer UNIQUE`);
      console.log('✅ uid 字段添加成功');
    } else {
      console.log('✓ uid 字段已存在');
    }

    // 检查is_active字段
    const isActiveCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'user' AND column_name = 'is_active'
    `);

    if (isActiveCheck.rows.length === 0) {
      console.log('➕ 添加 is_active 字段...');
      await client.query(`ALTER TABLE "user" ADD COLUMN "is_active" boolean DEFAULT true`);
      console.log('✅ is_active 字段添加成功');
    } else {
      console.log('✓ is_active 字段已存在');
    }

    // 检查last_login_at字段
    const lastLoginCheck = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'user' AND column_name = 'last_login_at'
    `);

    if (lastLoginCheck.rows.length === 0) {
      console.log('➕ 添加 last_login_at 字段...');
      await client.query(`ALTER TABLE "user" ADD COLUMN "last_login_at" timestamp`);
      console.log('✅ last_login_at 字段添加成功');
    } else {
      console.log('✓ last_login_at 字段已存在');
    }

    // 显示最终的字段列表
    console.log('\n📋 user表当前所有字段:');
    const allColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user' 
      ORDER BY ordinal_position
    `);
    allColumns.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(25)} ${row.data_type}`);
    });

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addMissingFields();

