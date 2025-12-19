-- 添加订阅系统相关表和字段

-- 1. 在 user 表添加订阅相关字段
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_subscribed" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "subscription_expires_at" timestamp;

-- 2. 创建用户订阅表
CREATE TABLE IF NOT EXISTS "user_subscription" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "plan_type" text NOT NULL DEFAULT 'monthly',
  "status" text NOT NULL DEFAULT 'active',
  "started_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 3. 创建积分套餐表
CREATE TABLE IF NOT EXISTS "points_package" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "points" integer NOT NULL,
  "price" real NOT NULL,
  "original_price" real,
  "is_popular" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 4. 创建订阅套餐表
CREATE TABLE IF NOT EXISTS "subscription_plan" (
  "id" serial PRIMARY KEY,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'monthly',
  "price" real NOT NULL,
  "original_price" real,
  "bonus_points" integer NOT NULL DEFAULT 3000,
  "daily_points_multiplier" real NOT NULL DEFAULT 2.0,
  "description" text,
  "features" text,
  "is_active" boolean DEFAULT true,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 5. 创建订单表
CREATE TABLE IF NOT EXISTS "payment_order" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "order_type" text NOT NULL,
  "product_id" text NOT NULL,
  "amount" real NOT NULL,
  "points_amount" integer,
  "status" text NOT NULL DEFAULT 'pending',
  "payment_method" text,
  "payment_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "paid_at" timestamp
);

-- 6. 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_user_subscription_user_id" ON "user_subscription"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_subscription_status" ON "user_subscription"("status");
CREATE INDEX IF NOT EXISTS "idx_user_subscription_expires_at" ON "user_subscription"("expires_at");

CREATE INDEX IF NOT EXISTS "idx_points_package_is_active" ON "points_package"("is_active");
CREATE INDEX IF NOT EXISTS "idx_points_package_sort_order" ON "points_package"("sort_order");

CREATE INDEX IF NOT EXISTS "idx_subscription_plan_is_active" ON "subscription_plan"("is_active");
CREATE INDEX IF NOT EXISTS "idx_subscription_plan_type" ON "subscription_plan"("type");

CREATE INDEX IF NOT EXISTS "idx_payment_order_user_id" ON "payment_order"("user_id");
CREATE INDEX IF NOT EXISTS "idx_payment_order_status" ON "payment_order"("status");
CREATE INDEX IF NOT EXISTS "idx_payment_order_order_type" ON "payment_order"("order_type");
CREATE INDEX IF NOT EXISTS "idx_payment_order_created_at" ON "payment_order"("created_at" DESC);










