-- 为 subscription_plan 表补充 is_popular 字段，使表结构与代码一致
ALTER TABLE "subscription_plan"
ADD COLUMN IF NOT EXISTS "is_popular" boolean DEFAULT false;

-- 将已有数据的该字段补齐为默认值
UPDATE "subscription_plan"
SET "is_popular" = false
WHERE "is_popular" IS NULL;







