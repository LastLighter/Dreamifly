-- 添加工作流放大消耗积分字段
ALTER TABLE "points_config" ADD COLUMN IF NOT EXISTS "upscale_workflow_cost" integer;

