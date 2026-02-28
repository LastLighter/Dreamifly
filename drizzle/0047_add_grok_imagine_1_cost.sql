-- 为 grok-imagine-1.0 模型添加积分消耗配置字段
ALTER TABLE "points_config" ADD COLUMN IF NOT EXISTS "grok_imagine_1_cost" integer;
