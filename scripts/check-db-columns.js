const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user' 
      ORDER BY ordinal_position
    `);

    console.log('\n数据库中 user 表的字段:');
    console.log('='.repeat(50));
    result.rows.forEach(row => {
      console.log(`  ${row.column_name.padEnd(25)} ${row.data_type}`);
    });
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();

