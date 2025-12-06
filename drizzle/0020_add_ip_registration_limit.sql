-- 添加IP注册限制表
CREATE TABLE IF NOT EXISTS "ip_registration_limit" (
  "ip_address" text PRIMARY KEY NOT NULL,
  "registration_count" integer DEFAULT 0 NOT NULL,
  "first_registration_at" timestamp,
  "last_registration_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_ip_registration_limit_first_registration_at" 
ON "ip_registration_limit" ("first_registration_at");

