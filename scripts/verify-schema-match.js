const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

// Schema.ts 中定义的字段映射
const schemaMapping = {
  user: {
    id: 'id',
    name: 'name',
    email: 'email',
    emailVerified: 'email_verified',
    image: 'image',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    nickname: 'nickname',
    uid: 'uid',
    avatar: 'avatar',
    signature: 'signature',
    isActive: 'is_active',
    lastLoginAt: 'last_login_at',
  },
  session: {
    id: 'id',
    expiresAt: 'expires_at',
    token: 'token',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    ipAddress: 'ip_address',
    userAgent: 'user_agent',
    userId: 'user_id',
  },
  account: {
    id: 'id',
    accountId: 'account_id',
    providerId: 'provider_id',
    userId: 'user_id',
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    idToken: 'id_token',
    accessTokenExpiresAt: 'access_token_expires_at',
    refreshTokenExpiresAt: 'refresh_token_expires_at',
    scope: 'scope',
    password: 'password',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  verification: {
    id: 'id',
    identifier: 'identifier',
    value: 'value',
    expiresAt: 'expires_at',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
};

async function verifySchemaMatch() {
  const client = await pool.connect();
  try {
    console.log('🔍 验证Schema与数据库字段匹配情况\n');
    console.log('='.repeat(70));

    let allMatched = true;

    for (const [tableName, mapping] of Object.entries(schemaMapping)) {
      console.log(`\n📋 检查表: ${tableName.toUpperCase()}`);
      console.log('-'.repeat(70));

      // 获取数据库中的字段
      const result = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      const dbFields = new Set(result.rows.map(row => row.column_name));
      const schemaDbFields = new Set(Object.values(mapping));

      // 检查每个映射的字段
      let tableMatched = true;
      for (const [codeField, dbField] of Object.entries(mapping)) {
        if (dbFields.has(dbField)) {
          console.log(`  ✅ ${codeField.padEnd(25)} → ${dbField}`);
        } else {
          console.log(`  ❌ ${codeField.padEnd(25)} → ${dbField} (缺失)`);
          tableMatched = false;
          allMatched = false;
        }
      }

      // 检查数据库中是否有多余的字段
      const extraFields = Array.from(dbFields).filter(f => !schemaDbFields.has(f));
      if (extraFields.length > 0) {
        console.log(`\n  ⚠️  数据库中的额外字段 (未在Schema中定义):`);
        extraFields.forEach(field => {
          console.log(`     - ${field}`);
        });
      }

      if (tableMatched && extraFields.length === 0) {
        console.log(`\n  ✅ ${tableName} 表完全匹配`);
      }
    }

    console.log('\n' + '='.repeat(70));
    if (allMatched) {
      console.log('✅ 所有表的字段映射都正确！');
      console.log('🚀 可以开始测试注册功能了！');
    } else {
      console.log('❌ 存在缺失的字段，请先运行同步脚本：');
      console.log('   node scripts/sync-all-fields.js');
    }
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchemaMatch();

