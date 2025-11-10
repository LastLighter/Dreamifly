-- 添加IP并发记录表
CREATE TABLE IF NOT EXISTS "ip_concurrency" (
  "ip_address" text PRIMARY KEY,
  "current_concurrency" integer DEFAULT 0 NOT NULL,
  "max_concurrency" integer,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

