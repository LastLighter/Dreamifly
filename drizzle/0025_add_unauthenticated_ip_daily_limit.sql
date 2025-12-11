-- 为 user_limit_config 表新增未登录用户IP每日限额字段
ALTER TABLE "user_limit_config"
ADD COLUMN IF NOT EXISTS "unauthenticated_ip_daily_limit" integer;

-- 创建未登录用户IP每日调用记录表
-- 注意：last_request_reset_date 存储的是 UTC 时间（不带时区）
-- 代码中插入和更新时会使用 (now() at time zone 'UTC') 确保存储 UTC 时间
CREATE TABLE IF NOT EXISTS "ip_daily_usage" (
  "ip_address" text PRIMARY KEY,
  "daily_request_count" integer DEFAULT 0 NOT NULL,
  "last_request_reset_date" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

