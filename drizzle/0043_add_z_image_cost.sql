-- 为 Z-Image 模型添加积分消耗配置字段
ALTER TABLE "points_config" ADD COLUMN IF NOT EXISTS "z_image_cost" integer;

