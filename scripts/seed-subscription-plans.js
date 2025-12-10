const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// 加载 .env 文件
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim();
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

// 从环境变量读取数据库配置
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ 错误: DATABASE_URL 环境变量未设置');
  console.log('请确保 .env.local 文件中包含 DATABASE_URL 配置');
  process.exit(1);
}

console.log('📌 使用数据库:', dbUrl.replace(/:[^:@]+@/, ':****@'));

const pool = new Pool({
  connectionString: dbUrl
});

async function seedSubscriptionPlans() {
  const client = await pool.connect();
  try {
    console.log('🚀 开始设置订阅系统...\n');

    // 1. 先运行创建表的迁移
    const createTableFile = path.join(__dirname, '../drizzle/0022_add_subscription_system.sql');
    if (fs.existsSync(createTableFile)) {
      console.log('📝 执行迁移文件: 0022_add_subscription_system.sql (创建表结构)');
      const createTableSQL = fs.readFileSync(createTableFile, 'utf8');
      await client.query(createTableSQL);
      console.log('✅ 表结构创建成功！\n');
    }

    // 2. 再运行插入数据的迁移
    const seedDataFile = path.join(__dirname, '../drizzle/0023_seed_subscription_plan.sql');
    const seedDataSQL = fs.readFileSync(seedDataFile, 'utf8');

    console.log('📝 执行迁移文件: 0023_seed_subscription_plan.sql (插入数据)');
    await client.query(seedDataSQL);
    console.log('✅ 数据插入成功完成！\n');

    // 验证订阅套餐是否存在
    const planResult = await client.query(`
      SELECT id, name, type, price, bonus_points, daily_points_multiplier, is_active
      FROM subscription_plan
      WHERE is_active = true
    `);

    console.log('📋 当前激活的订阅套餐:');
    planResult.rows.forEach(plan => {
      console.log(`  - ${plan.name} (${plan.type}): ¥${plan.price}, 赠送${plan.bonus_points}积分, ${plan.daily_points_multiplier}倍每日积分`);
    });

    // 验证积分套餐是否存在
    const packageResult = await client.query(`
      SELECT id, name, points, price, is_popular, is_active
      FROM points_package
      WHERE is_active = true
      ORDER BY sort_order
    `);

    console.log('\n📋 当前激活的积分套餐:');
    packageResult.rows.forEach(pkg => {
      console.log(`  - ${pkg.name}: ${pkg.points}积分, ¥${pkg.price}${pkg.is_popular ? ' (热门)' : ''}`);
    });

  } catch (err) {
    console.error('❌ 插入失败:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedSubscriptionPlans();

