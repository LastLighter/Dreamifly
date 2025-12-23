-- 添加图片存储配额字段到 user_limit_config 表
ALTER TABLE "user_limit_config" ADD COLUMN IF NOT EXISTS "regular_user_max_images" integer;
ALTER TABLE "user_limit_config" ADD COLUMN IF NOT EXISTS "subscribed_user_max_images" integer;