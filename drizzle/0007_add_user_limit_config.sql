-- 添加用户限额配置表
CREATE TABLE IF NOT EXISTS "user_limit_config" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "regular_user_daily_limit" integer,
  "premium_user_daily_limit" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 插入默认配置（null表示使用环境变量）
INSERT INTO "user_limit_config" ("id", "regular_user_daily_limit", "premium_user_daily_limit", "created_at", "updated_at")
VALUES (1, NULL, NULL, now(), now())
ON CONFLICT ("id") DO NOTHING;

