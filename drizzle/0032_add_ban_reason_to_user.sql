-- 添加封禁原因字段到用户表
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 添加注释
COMMENT ON COLUMN "user".ban_reason IS '封禁原因';

