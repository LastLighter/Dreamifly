/**
 * 为数据库中已存在但没有 UID 的用户分配 UID
 * 运行方式: node scripts/assign-missing-uids.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://dreamifly:Dreamifly123!QAZ.@10.0.1.16:5432/dreamifly'
});

async function assignMissingUids() {
  const client = await pool.connect();
  try {
    console.log('🔍 开始检查并分配缺失的 UID...\n');

    // 查询所有没有 UID 的用户
    const usersResult = await client.query(`
      SELECT id, email, name, created_at, email_verified
      FROM "user"
      WHERE uid IS NULL
      ORDER BY created_at ASC
    `);

    const usersWithoutUid = usersResult.rows;

    if (usersWithoutUid.length === 0) {
      console.log('✅ 所有用户都已经有 UID 了！');
      return;
    }

    console.log(`发现 ${usersWithoutUid.length} 个用户没有 UID，开始分配...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const user of usersWithoutUid) {
      try {
        // 获取下一个可用的 UID
        const nextUidResult = await client.query(`
          SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM "user"
        `);
        const nextUid = nextUidResult.rows[0].next_uid;

        // 使用用户输入的昵称，如果没有则使用默认格式
        const nickname = user.name || `Dreamer-${nextUid}`;

        // 更新用户的 UID 和昵称（使用原子操作，避免并发问题）
        const updateResult = await client.query(`
          UPDATE "user" 
          SET uid = $1, 
              nickname = $2
          WHERE id = $3 AND uid IS NULL
          RETURNING uid, nickname
        `, [nextUid, nickname, user.id]);

        // 验证更新是否成功
        if (updateResult.rows.length > 0 && updateResult.rows[0].uid) {
          console.log(`✅ 用户 ${user.email} (${user.id}) 已分配 UID: ${updateResult.rows[0].uid}, 昵称: ${updateResult.rows[0].nickname}`);
          successCount++;
        } else {
          // 可能是并发冲突，重新查询
          const checkResult = await client.query(`
            SELECT uid, nickname FROM "user" WHERE id = $1
          `, [user.id]);
          
          if (checkResult.rows.length > 0 && checkResult.rows[0].uid) {
            console.log(`⚠️  用户 ${user.email} (${user.id}) 已经有 UID 了（可能是并发分配）: ${checkResult.rows[0].uid}`);
            successCount++;
          } else {
            console.log(`⚠️  用户 ${user.email} (${user.id}) UID 分配可能失败`);
            errorCount++;
          }
        }
      } catch (error) {
        console.error(`❌ 为用户 ${user.email} (${user.id}) 分配 UID 时出错:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n✅ 完成！成功: ${successCount}, 失败: ${errorCount}`);
  } catch (error) {
    console.error('❌ 执行过程中出错:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

assignMissingUids();

