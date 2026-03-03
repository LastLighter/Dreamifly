const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

// 根据 schema.ts 定义的所有表和字段
const schemaDefinition = {
  // user 表字段
  user: {
    id: 'text',
    name: 'text',
    email: 'text',
    email_verified: 'boolean',
    image: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    nickname: 'text',
    uid: 'integer',
    avatar: 'text',
    signature: 'text',
    is_active: 'boolean',
    last_login_at: 'timestamp',
    is_admin: 'boolean',
    is_premium: 'boolean',
    is_old_user: 'boolean',
    daily_request_count: 'integer',
    last_request_reset_date: 'timestamp',
    avatar_frame_id: 'integer',
    is_subscribed: 'boolean',
    subscription_expires_at: 'timestamp',
  },
  
  // session 表字段
  session: {
    id: 'text',
    expires_at: 'timestamp',
    token: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    ip_address: 'text',
    user_agent: 'text',
    user_id: 'text',
  },
  
  // account 表字段
  account: {
    id: 'text',
    account_id: 'text',
    provider_id: 'text',
    user_id: 'text',
    access_token: 'text',
    refresh_token: 'text',
    id_token: 'text',
    access_token_expires_at: 'timestamp',
    refresh_token_expires_at: 'timestamp',
    scope: 'text',
    password: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // verification 表字段
  verification: {
    id: 'text',
    identifier: 'text',
    value: 'text',
    expires_at: 'timestamp',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // site_stats 表字段
  site_stats: {
    id: 'integer',
    total_generations: 'integer',
    daily_generations: 'integer',
    last_reset_date: 'timestamp',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // model_usage_stats 表字段
  model_usage_stats: {
    id: 'text',
    model_name: 'text',
    user_id: 'text',
    response_time: 'real',
    is_authenticated: 'boolean',
    ip_address: 'text',
    created_at: 'timestamp',
  },
  
  // user_limit_config 表字段
  user_limit_config: {
    id: 'integer',
    regular_user_daily_limit: 'integer',
    premium_user_daily_limit: 'integer',
    new_user_daily_limit: 'integer',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // ip_concurrency 表字段
  ip_concurrency: {
    ip_address: 'text',
    current_concurrency: 'integer',
    max_concurrency: 'integer',
    updated_at: 'timestamp',
    created_at: 'timestamp',
  },
  
  // ip_blacklist 表字段
  ip_blacklist: {
    id: 'text',
    ip_address: 'text',
    reason: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    created_by: 'text',
  },
  
  // ip_registration_limit 表字段
  ip_registration_limit: {
    ip_address: 'text',
    registration_count: 'integer',
    first_registration_at: 'timestamp',
    last_registration_at: 'timestamp',
    updated_at: 'timestamp',
    created_at: 'timestamp',
  },
  
  // avatar_frame 表字段
  avatar_frame: {
    id: 'integer',
    category: 'text',
    image_url: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // allowed_email_domain 表字段
  allowed_email_domain: {
    id: 'integer',
    domain: 'text',
    is_enabled: 'boolean',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // user_points 表字段
  user_points: {
    id: 'text',
    user_id: 'text',
    points: 'integer',
    type: 'text',
    description: 'text',
    earned_at: 'timestamp',
    expires_at: 'timestamp',
    created_at: 'timestamp',
  },
  
  // points_config 表字段
  points_config: {
    id: 'integer',
    regular_user_daily_points: 'integer',
    premium_user_daily_points: 'integer',
    points_expiry_days: 'integer',
    repair_workflow_cost: 'integer',
    upscale_workflow_cost: 'integer',
    z_image_cost: 'integer',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // user_subscription 表字段
  user_subscription: {
    id: 'text',
    user_id: 'text',
    plan_type: 'text',
    status: 'text',
    started_at: 'timestamp',
    expires_at: 'timestamp',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // points_package 表字段
  points_package: {
    id: 'integer',
    name: 'text',
    name_tag: 'text',
    points: 'integer',
    price: 'real',
    original_price: 'real',
    is_popular: 'boolean',
    is_active: 'boolean',
    show_on_frontend: 'boolean',
    sort_order: 'integer',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // subscription_plan 表字段
  subscription_plan: {
    id: 'integer',
    name: 'text',
    type: 'text',
    price: 'real',
    original_price: 'real',
    bonus_points: 'integer',
    daily_points_multiplier: 'real',
    description: 'text',
    features: 'text',
    is_active: 'boolean',
    sort_order: 'integer',
    created_at: 'timestamp',
    updated_at: 'timestamp',
  },
  
  // payment_order 表字段
  payment_order: {
    id: 'text',
    user_id: 'text',
    order_type: 'text',
    product_id: 'text',
    amount: 'real',
    points_amount: 'integer',
    status: 'text',
    payment_method: 'text',
    payment_id: 'text',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    paid_at: 'timestamp',
  },
};

async function checkAndReportSchema() {
  const client = await pool.connect();
  try {
    console.log('🔍 检查数据库 Schema 与代码定义的差异...\n');
    
    const missingTables = [];
    const missingColumns = {};
    const extraColumns = {};
    
    for (const [tableName, expectedColumns] of Object.entries(schemaDefinition)) {
      // 检查表是否存在
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [tableName]);
      
      if (!tableExists.rows[0].exists) {
        missingTables.push(tableName);
        continue;
      }
      
      // 获取表的当前列
      const currentColumns = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `, [tableName]);
      
      const currentColumnNames = new Set(currentColumns.rows.map(r => r.column_name));
      const expectedColumnNames = new Set(Object.keys(expectedColumns));
      
      // 找出缺失的列
      const missing = [...expectedColumnNames].filter(c => !currentColumnNames.has(c));
      if (missing.length > 0) {
        missingColumns[tableName] = missing;
      }
      
      // 找出多余的列
      const extra = [...currentColumnNames].filter(c => !expectedColumnNames.has(c));
      if (extra.length > 0) {
        extraColumns[tableName] = extra;
      }
    }
    
    // 输出报告
    console.log('='.repeat(70));
    console.log('📊 Schema 检查报告');
    console.log('='.repeat(70));
    
    if (missingTables.length > 0) {
      console.log('\n❌ 缺失的表:');
      missingTables.forEach(t => console.log(`  - ${t}`));
    } else {
      console.log('\n✅ 所有表都已存在');
    }
    
    if (Object.keys(missingColumns).length > 0) {
      console.log('\n❌ 缺失的字段:');
      for (const [table, columns] of Object.entries(missingColumns)) {
        console.log(`  ${table}:`);
        columns.forEach(c => console.log(`    - ${c}`));
      }
    } else {
      console.log('\n✅ 所有字段都已存在');
    }
    
    if (Object.keys(extraColumns).length > 0) {
      console.log('\n⚠️ 数据库中存在但 schema 未定义的字段 (可能是旧字段):');
      for (const [table, columns] of Object.entries(extraColumns)) {
        console.log(`  ${table}:`);
        columns.forEach(c => console.log(`    - ${c}`));
      }
    }
    
    console.log('\n' + '='.repeat(70));
    
    // 如果有缺失，生成迁移 SQL
    if (missingTables.length > 0 || Object.keys(missingColumns).length > 0) {
      console.log('\n📝 需要运行的迁移 SQL:');
      console.log('-'.repeat(70));
      
      // 生成创建表的 SQL
      for (const tableName of missingTables) {
        console.log(`-- 创建 ${tableName} 表`);
        console.log(`-- 请运行: node scripts/migrate.js 0022_add_subscription_system.sql`);
      }
      
      // 生成添加列的 SQL
      for (const [tableName, columns] of Object.entries(missingColumns)) {
        for (const columnName of columns) {
          const columnType = schemaDefinition[tableName][columnName];
          let sqlType = columnType;
          if (columnType === 'timestamp') sqlType = 'timestamp';
          if (columnType === 'boolean') sqlType = 'boolean DEFAULT false';
          if (columnType === 'integer') sqlType = 'integer';
          if (columnType === 'real') sqlType = 'real';
          if (columnType === 'text') sqlType = 'text';
          
          console.log(`ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${columnName}" ${sqlType};`);
        }
      }
      
      console.log('-'.repeat(70));
    } else {
      console.log('\n✅ 数据库 Schema 与代码定义完全一致！');
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkAndReportSchema();










