const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function checkAllTables() {
  try {
    const tables = ['user', 'session', 'account', 'verification'];
    
    for (const table of tables) {
      const result = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.log(`\n📋 ${table.toUpperCase()} 表的字段:`);
      console.log('='.repeat(60));
      if (result.rows.length === 0) {
        console.log(`  ⚠️ 表 "${table}" 不存在`);
      } else {
        result.rows.forEach(row => {
          console.log(`  ${row.column_name.padEnd(30)} ${row.data_type}`);
        });
      }
      console.log('='.repeat(60));
    }

  } catch (error) {
    console.error('❌ 查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkAllTables();

