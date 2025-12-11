-- 添加模型积分消耗配置字段
ALTER TABLE "points_config" ADD COLUMN IF NOT EXISTS "z_image_turbo_cost" integer;
ALTER TABLE "points_config" ADD COLUMN IF NOT EXISTS "qwen_image_edit_cost" integer;
ALTER TABLE "points_config" ADD COLUMN IF NOT EXISTS "wai_sdxl_v150_cost" integer;

