-- 在用户表中添加可用头像框ID列表字段
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "available_avatar_frame_ids" text;

COMMENT ON COLUMN "user"."available_avatar_frame_ids" IS '可用头像框ID列表，用逗号分隔';
