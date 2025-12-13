-- 为用户生成图片表添加用户信息字段
ALTER TABLE "user_generated_images" 
ADD COLUMN IF NOT EXISTS "user_role" text,
ADD COLUMN IF NOT EXISTS "user_avatar" text,
ADD COLUMN IF NOT EXISTS "user_nickname" text,
ADD COLUMN IF NOT EXISTS "avatar_frame_id" integer;

-- 添加注释
COMMENT ON COLUMN "user_generated_images"."user_role" IS '用户角色：admin, subscribed, premium, oldUser, regular';
COMMENT ON COLUMN "user_generated_images"."user_avatar" IS '用户头像URL';
COMMENT ON COLUMN "user_generated_images"."user_nickname" IS '用户昵称';
COMMENT ON COLUMN "user_generated_images"."avatar_frame_id" IS '头像框ID';

