-- 为 user_limit_config 表新增新用户每日限额字段
ALTER TABLE "user_limit_config"
ADD COLUMN IF NOT EXISTS "new_user_daily_limit" integer;