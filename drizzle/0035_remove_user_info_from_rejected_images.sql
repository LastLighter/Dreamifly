-- 删除 rejected_images 表中预存储的用户信息字段
-- 改为通过 user_id 关联 user 表实时获取用户信息

-- 删除用户角色字段
ALTER TABLE "rejected_images" DROP COLUMN IF EXISTS "user_role";

-- 删除用户头像字段
ALTER TABLE "rejected_images" DROP COLUMN IF EXISTS "user_avatar";

-- 删除用户昵称字段
ALTER TABLE "rejected_images" DROP COLUMN IF EXISTS "user_nickname";

-- 删除头像框ID字段
ALTER TABLE "rejected_images" DROP COLUMN IF EXISTS "avatar_frame_id";

-- 添加注释说明
COMMENT ON COLUMN "rejected_images"."user_id" IS '用户ID，可为NULL（未登录用户），通过此字段关联user表获取实时用户信息';

