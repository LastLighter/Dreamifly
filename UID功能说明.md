# UID 功能说明

## 功能概述

为每个用户添加了唯一的数字 ID (UID)，从 1 开始自动递增，用于用户识别和展示。

## 实现的功能

### 1. UID 自增字段
- ✅ 每个用户都有唯一的数字 UID
- ✅ 从 1 开始自动递增
- ✅ 不会与 Better Auth 的内部 ID 冲突
- ✅ 可在个人资料页面查看

### 2. 自动昵称生成
- ✅ 注册时自动生成昵称：`Dreamer-{uid}`
- ✅ 例如：`Dreamer-1`, `Dreamer-2`, `Dreamer-3`...
- ✅ 用户可以在个人资料页面修改昵称

## 技术实现

### 数据库 Schema

```typescript
// src/db/schema.ts
export const user = pgTable("user", {
  id: text("id").primaryKey(),              // Better Auth 内部 ID
  uid: integer("uid").unique(),             // 用户唯一数字 ID（自增）
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  // ... 其他字段
  nickname: text("nickname"),               // 用户昵称
});
```

### UID 生成逻辑

```typescript
// src/app/api/auth/signup-handler/route.ts
async function getNextUid(): Promise<number> {
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM "user"
  `);
  return result.rows[0].next_uid;
}
```

### 注册流程

```
用户注册 → Better Auth 创建用户 → 调用 signup-handler API 
→ 生成 UID → 设置昵称为 Dreamer-{uid} → 完成
```

## 文件变更

### 新建文件
```
src/app/api/auth/signup-handler/route.ts  # UID 生成和昵称设置 API
UID功能说明.md                            # 本文档
```

### 修改文件
```
src/db/schema.ts                          # 添加 uid 字段
src/lib/auth.ts                           # 配置 uid 字段
src/components/AuthModal.tsx              # 注册后调用 signup-handler
src/app/[locale]/profile/page.tsx         # 显示 UID
```

## 使用说明

### 查看 UID

用户登录后，访问个人资料页面 (`/profile`)，可以看到：

```
用户 ID (UID)
#1
```

### UID 特性

1. **唯一性**：每个用户的 UID 都是唯一的
2. **递增性**：新用户的 UID 总是比之前的用户大
3. **不可修改**：UID 一旦生成就不能修改
4. **独立性**：UID 与 Better Auth 的内部 ID 完全独立

### 昵称特性

1. **自动生成**：注册时自动生成 `Dreamer-{uid}`
2. **可修改**：用户可以在个人资料页面修改昵称
3. **显示优先级**：
   - 导航栏优先显示 `nickname`
   - 如果没有 `nickname` 则显示 `name`

## 数据库迁移

运行以下命令应用数据库变更：

```bash
# 生成迁移
npx drizzle-kit generate

# 应用迁移
npx drizzle-kit push
```

### 迁移 SQL（参考）

```sql
-- 添加 uid 列
ALTER TABLE "user" ADD COLUMN "uid" INTEGER UNIQUE;

-- 为现有用户生成 UID（如果有）
DO $$
DECLARE
  user_record RECORD;
  current_uid INTEGER := 1;
BEGIN
  FOR user_record IN SELECT id FROM "user" WHERE uid IS NULL ORDER BY created_at
  LOOP
    UPDATE "user" 
    SET uid = current_uid, 
        nickname = 'Dreamer-' || current_uid
    WHERE id = user_record.id;
    current_uid := current_uid + 1;
  END LOOP;
END $$;
```

## API 端点

### POST /api/auth/signup-handler

**用途**：为新注册的用户生成 UID 和设置昵称

**请求体**：
```json
{
  "userId": "user_id_from_better_auth"
}
```

**响应**：
```json
{
  "success": true,
  "uid": 1,
  "nickname": "Dreamer-1"
}
```

**调用时机**：用户注册成功后自动调用

## 示例

### 用户注册流程

1. **用户填写注册信息**
   - 昵称：`张三`
   - 邮箱：`zhangsan@example.com`
   - 密码：`********`

2. **Better Auth 创建用户**
   - ID: `cm3x1y2z3...` (Better Auth 生成)
   - Name: `张三`
   - Email: `zhangsan@example.com`

3. **signup-handler 设置 UID**
   - UID: `1` (自动生成)
   - Nickname: `Dreamer-1` (自动生成)

4. **用户资料显示**
   ```
   用户 ID: #1
   邮箱: zhangsan@example.com
   姓名: 张三
   昵称: Dreamer-1 (可修改)
   ```

5. **导航栏显示**
   ```
   Dreamer-1 ▼
   ```

## 注意事项

### 1. UID 生成时机

- UID 在用户注册**成功后**立即生成
- 如果 signup-handler API 调用失败，用户仍然可以正常使用，但 UID 为 null
- 可以通过重新调用 signup-handler 为这些用户补充 UID

### 2. 并发注册

当前实现使用 `MAX(uid) + 1` 的方式生成 UID，在高并发场景下可能出现 UID 冲突。

**解决方案**（如需要）：
- 使用数据库序列（PostgreSQL SEQUENCE）
- 使用分布式 ID 生成器（如 Snowflake）
- 添加重试机制

### 3. 现有用户

如果数据库中已有用户（没有 UID），需要运行迁移脚本为他们生成 UID。

### 4. UID 显示

- 个人资料页面显示格式：`#1`
- 可以根据需要在其他地方显示 UID
- 建议不要在公开场合显示 UID（避免暴露用户数量）

## 扩展功能（可选）

### 1. UID 格式化

可以添加 UID 格式化函数：

```typescript
function formatUid(uid: number): string {
  return `#${uid.toString().padStart(6, '0')}`;
  // 例如: #000001, #000042, #001234
}
```

### 2. UID 搜索

可以添加通过 UID 搜索用户的功能：

```typescript
async function getUserByUid(uid: number) {
  return await db.query.user.findFirst({
    where: eq(user.uid, uid)
  });
}
```

### 3. UID 统计

可以显示网站的用户总数：

```typescript
async function getTotalUsers() {
  const result = await db.execute(sql`
    SELECT MAX(uid) as total FROM "user"
  `);
  return result.rows[0].total;
}
```

## 测试

### 测试步骤

1. **注册新用户**
   ```
   昵称: 测试用户
   邮箱: test@example.com
   密码: Test1234
   ```

2. **验证邮箱**
   - 查看邮件
   - 点击验证链接

3. **登录**
   - 使用注册的邮箱和密码登录

4. **查看个人资料**
   - 访问 `/profile`
   - 确认 UID 显示为 `#1` (或下一个可用的数字)
   - 确认昵称显示为 `Dreamer-1`

5. **修改昵称**
   - 将昵称改为 `我的新昵称`
   - 保存
   - 确认导航栏显示新昵称

6. **注册第二个用户**
   - 重复步骤 1-4
   - 确认 UID 为 `#2`
   - 确认昵称为 `Dreamer-2`

## 故障排除

### UID 没有生成

**检查**：
1. signup-handler API 是否正常工作
2. 查看服务器控制台日志
3. 检查数据库连接

**手动修复**：
```sql
-- 为特定用户设置 UID
UPDATE "user" 
SET uid = 1, nickname = 'Dreamer-1'
WHERE email = 'user@example.com';
```

### UID 重复

**原因**：并发注册导致

**修复**：
```sql
-- 查找重复的 UID
SELECT uid, COUNT(*) 
FROM "user" 
WHERE uid IS NOT NULL 
GROUP BY uid 
HAVING COUNT(*) > 1;

-- 重新分配 UID
-- 需要手动处理
```

### 昵称显示为空

**检查**：
1. 确认 signup-handler 正确设置了昵称
2. 查看数据库中的 nickname 字段

**手动修复**：
```sql
-- 为没有昵称的用户设置昵称
UPDATE "user" 
SET nickname = 'Dreamer-' || uid
WHERE nickname IS NULL AND uid IS NOT NULL;
```

## 总结

✅ **UID 功能已完整实现**
- 自动生成唯一的数字 ID
- 从 1 开始递增
- 自动设置昵称为 Dreamer-{uid}
- 可在个人资料页面查看
- 用户可以修改昵称

✅ **不影响现有功能**
- Better Auth 正常工作
- 邮箱验证正常
- 登录注册正常
- 个人资料管理正常

✅ **易于维护**
- 代码结构清晰
- 逻辑简单明了
- 易于扩展

