-- 创建积分记录表
CREATE TABLE IF NOT EXISTS "user_points" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "points" integer NOT NULL,
  "type" text NOT NULL CHECK ("type" IN ('earned', 'spent')),
  "description" text,
  "earned_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 创建积分配置表
CREATE TABLE IF NOT EXISTS "points_config" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "regular_user_daily_points" integer,
  "premium_user_daily_points" integer,
  "points_expiry_days" integer,
  "repair_workflow_cost" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON "user_points"("user_id");
CREATE INDEX IF NOT EXISTS idx_user_points_type ON "user_points"("type");
CREATE INDEX IF NOT EXISTS idx_user_points_earned_at ON "user_points"("earned_at" DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_expires_at ON "user_points"("expires_at");
CREATE INDEX IF NOT EXISTS idx_user_points_user_id_type ON "user_points"("user_id", "type");

-- 插入默认积分配置（null表示使用环境变量）
INSERT INTO "points_config" ("id", "regular_user_daily_points", "premium_user_daily_points", "points_expiry_days", "repair_workflow_cost", "created_at", "updated_at")
VALUES (1, NULL, NULL, NULL, NULL, now(), now())
ON CONFLICT ("id") DO NOTHING;

