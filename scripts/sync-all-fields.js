const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function syncAllFields() {
  const client = await pool.connect();
  try {
    console.log('🔍 检查并同步所有字段...\n');

    // 获取当前所有字段
    const currentFields = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user'
    `);
    
    const existingFields = new Set(currentFields.rows.map(row => row.column_name));
    console.log('📋 当前字段:', Array.from(existingFields).join(', '));
    console.log('');

    // 定义所有需要的字段
    const requiredFields = [
      { name: 'uid', sql: 'ALTER TABLE "user" ADD COLUMN "uid" integer UNIQUE' },
      { name: 'signature', sql: 'ALTER TABLE "user" ADD COLUMN "signature" text' },
      { name: 'is_active', sql: 'ALTER TABLE "user" ADD COLUMN "is_active" boolean DEFAULT true' },
      { name: 'last_login_at', sql: 'ALTER TABLE "user" ADD COLUMN "last_login_at" timestamp' },
    ];

    let added = 0;
    let skipped = 0;

    // 检查并添加缺失的字段
    for (const field of requiredFields) {
      if (!existingFields.has(field.name)) {
        console.log(`➕ 添加字段: ${field.name}`);
        try {
          await client.query(field.sql);
          console.log(`✅ ${field.name} 添加成功`);
          added++;
        } catch (error) {
          console.error(`❌ ${field.name} 添加失败:`, error.message);
        }
      } else {
        console.log(`✓ ${field.name} 已存在`);
        skipped++;
      }
    }

    console.log(`\n📊 总结: 添加 ${added} 个字段，跳过 ${skipped} 个已存在字段\n`);

    // 显示最终的字段列表
    console.log('📋 user表最终字段列表:');
    console.log('='.repeat(60));
    const finalFields = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user' 
      ORDER BY ordinal_position
    `);
    
    finalFields.rows.forEach(row => {
      const defaultVal = row.column_default ? ` (默认: ${row.column_default})` : '';
      console.log(`  ${row.column_name.padEnd(25)} ${row.data_type}${defaultVal}`);
    });
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ 操作失败:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

syncAllFields();

