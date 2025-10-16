# UID 功能实现说明

## 概述

本系统为每个注册用户分配一个唯一的数字UID（User ID），从1开始自动递增。UID与Better Auth的默认ID（字符串）分开，方便用户识别和展示。

## 功能特性

### 1. 自动分配UID
- 用户注册时，系统自动生成下一个可用的UID
- UID从1开始，每个新用户递增1
- UID在数据库中设置为唯一约束，确保不重复

### 2. 默认昵称
- 注册成功后，系统自动设置默认昵称为 `Dreamer-{uid}`
- 例如：第一个用户的昵称为 `Dreamer-1`，第二个为 `Dreamer-2`
- 用户可以在个人资料页面修改昵称

### 3. 个人资料展示
- UID在个人资料页面以只读形式展示（格式：`#1`、`#2`等）
- 用户无法修改UID
- UID可用于用户身份识别

## 技术实现

### 数据库Schema

```typescript
// src/db/schema.ts
export const user = pgTable("user", {
  id: varchar("id", { length: 255 }).primaryKey(), // Better Auth默认ID
  uid: integer("uid").unique(), // 自定义数字UID
  nickname: varchar("nickname", { length: 50 }), // 用户昵称
  avatar: varchar("avatar", { length: 500 }).default("/images/default-avatar.svg"),
  // ... 其他字段
});
```

### 注册流程

1. **用户提交注册表单**
   - 用户输入昵称、邮箱、密码
   - `AuthModal.tsx` 调用 `signUp.email()`

2. **Better Auth创建用户**
   - 生成内部ID（字符串UUID）
   - 发送邮箱验证邮件

3. **自动分配UID**
   - `AuthModal.tsx` 调用 `/api/auth/signup-handler`
   - 查询数据库获取当前最大UID
   - 生成 `nextUid = maxUid + 1`
   - 更新用户记录，设置UID和昵称

```typescript
// src/app/api/auth/signup-handler/route.ts
export async function POST(request: NextRequest) {
  const { userId } = await request.json();
  
  // 获取下一个UID
  const result = await db.execute(sql`
    SELECT COALESCE(MAX(uid), 0) + 1 as next_uid FROM "user"
  `);
  const nextUid = result[0].next_uid;
  
  // 更新用户
  await db.execute(sql`
    UPDATE "user" 
    SET uid = ${nextUid}, 
        nickname = ${'Dreamer-' + nextUid}
    WHERE id = ${userId}
  `);
  
  return NextResponse.json({ success: true, uid: nextUid });
}
```

### 个人资料展示

```typescript
// src/app/[locale]/profile/page.tsx
{(session.user as ExtendedUser).uid && (
  <div className="mb-6">
    <label className="block text-sm font-medium text-gray-700 mb-2">
      用户 ID (UID)
    </label>
    <input
      type="text"
      value={`#${(session.user as ExtendedUser).uid}`}
      disabled
      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed font-mono"
    />
  </div>
)}
```

## 类型定义

```typescript
// src/types/auth.ts
export interface ExtendedUser {
  id: string
  uid?: number // 自定义数字UID
  name: string
  email: string
  nickname?: string // 用户昵称
  avatar?: string // 用户头像
  // ... 其他字段
}
```

## 注意事项

### 1. UID生成时机
- UID在邮箱验证之前就已生成
- 即使用户未验证邮箱，UID也已分配
- 这确保了UID的连续性

### 2. 并发安全
- 当前实现使用 `MAX(uid) + 1` 方式生成UID
- 在高并发场景下，可能需要使用数据库序列或事务锁来保证唯一性

### 3. 字段名称
- Better Auth使用驼峰命名（`emailVerified`、`createdAt`）
- 数据库字段名也使用驼峰命名以保持一致性

## 未来改进

1. **使用数据库序列**
   ```sql
   CREATE SEQUENCE user_uid_seq START 1;
   ```

2. **并发控制**
   - 使用事务和行锁确保UID唯一性
   - 或使用PostgreSQL的 `SERIAL` 类型

3. **UID格式化**
   - 可以添加前缀，如 `DRM-000001`
   - 提供更友好的显示格式

## 测试

### 手动测试步骤

1. **注册新用户**
   - 访问网站，点击"登录"按钮
   - 切换到"注册"标签
   - 输入昵称、邮箱、密码
   - 提交注册

2. **检查邮箱**
   - 查看验证邮件
   - 点击验证链接（或复制到浏览器）

3. **登录并查看资料**
   - 验证成功后自动登录
   - 点击用户头像 → "个人资料"
   - 确认UID已显示（例如 `#1`）
   - 确认昵称为 `Dreamer-1`

4. **修改昵称**
   - 在个人资料页面修改昵称
   - 点击"保存更改"
   - 确认昵称已更新，但UID保持不变

## 相关文件

- `src/db/schema.ts` - 数据库表结构
- `src/lib/auth.ts` - Better Auth配置
- `src/types/auth.ts` - 类型定义
- `src/app/api/auth/signup-handler/route.ts` - UID生成逻辑
- `src/components/AuthModal.tsx` - 注册表单
- `src/app/[locale]/profile/page.tsx` - 个人资料页面
- `drizzle/0003_add_avatar.sql` - 数据库迁移（添加avatar字段）

