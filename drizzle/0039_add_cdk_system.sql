-- CDK系统数据表创建
-- 包含CDK主表、兑换记录表、用户每日限制表、全局配置表

-- CDK主表 - 存储CDK基本信息，关联到积分包或订阅包
CREATE TABLE IF NOT EXISTS "cdk" (
  "id" text PRIMARY KEY, -- UUID主键
  "code" text NOT NULL UNIQUE, -- CDK代码（19位十六进制，格式：XXXX-XXXX-XXXX-XXXX）
  "package_type" text NOT NULL, -- 包类型：'points_package' | 'subscription_plan'
  "package_id" integer NOT NULL, -- 关联的包ID
  "is_redeemed" boolean DEFAULT false NOT NULL, -- 是否已被兑换
  "expires_at" timestamp, -- CDK过期时间（UTC无时区）
  "created_at" timestamp NOT NULL, -- 创建时间（UTC无时区）
  "updated_at" timestamp NOT NULL, -- 更新时间（UTC无时区）
  "created_by" text -- 创建者ID（管理员ID）
);

-- CDK兑换记录表 - 每个CDK只能有一条兑换记录
CREATE TABLE IF NOT EXISTS "cdk_redemption" (
  "id" text PRIMARY KEY, -- UUID主键
  "cdk_id" text NOT NULL UNIQUE, -- CDK ID（一个CDK只能兑换一次）
  "user_id" text NOT NULL, -- 用户ID
  "redeemed_at" timestamp NOT NULL, -- 兑换时间（UTC无时区）
  "ip_address" text, -- 兑换时的IP地址
  "package_type" text NOT NULL, -- 包类型快照（防止包信息变更）
  "package_name" text NOT NULL, -- 包名称快照
  "package_data" jsonb NOT NULL -- 包的完整数据快照
);

-- 用户每日CDK兑换限制表
CREATE TABLE IF NOT EXISTS "user_cdk_daily_limit" (
  "id" text PRIMARY KEY, -- UUID主键
  "user_id" text NOT NULL UNIQUE, -- 用户ID（每个用户只能有一条记录）
  "daily_redemptions" integer DEFAULT 0 NOT NULL, -- 当日已兑换次数
  "last_redemption_reset_date" timestamp NOT NULL, -- 最后重置日期（UTC无时区）
  "updated_at" timestamp NOT NULL -- 更新时间（UTC无时区）
);

-- CDK全局配置表（单例模式）
CREATE TABLE IF NOT EXISTS "cdk_config" (
  "id" integer PRIMARY KEY DEFAULT 1, -- 单例配置，id固定为1
  "user_daily_limit" integer DEFAULT 5 NOT NULL, -- 用户每日兑换次数限制，默认5次
  "updated_at" timestamp NOT NULL -- 更新时间（UTC无时区）
);

-- 添加表注释
COMMENT ON TABLE "cdk" IS 'CDK主表，存储激活码基本信息';
COMMENT ON TABLE "cdk_redemption" IS 'CDK兑换记录表，每个CDK只能兑换一次';
COMMENT ON TABLE "user_cdk_daily_limit" IS '用户每日CDK兑换限制表';
COMMENT ON TABLE "cdk_config" IS 'CDK全局配置表';

-- 添加列注释
COMMENT ON COLUMN "cdk"."code" IS 'CDK代码，19位十六进制字符，格式：XXXX-XXXX-XXXX-XXXX';
COMMENT ON COLUMN "cdk"."package_type" IS '关联的包类型：points_package（积分包）或 subscription_plan（订阅套餐）';
COMMENT ON COLUMN "cdk"."package_id" IS '关联的包ID，对应points_package或subscription_plan表的id';
COMMENT ON COLUMN "cdk"."is_redeemed" IS 'CDK是否已被兑换，一个CDK只能兑换一次';
COMMENT ON COLUMN "cdk"."expires_at" IS 'CDK过期时间，为空表示永久有效';
COMMENT ON COLUMN "cdk"."created_by" IS 'CDK创建者ID（管理员ID）';

COMMENT ON COLUMN "cdk_redemption"."cdk_id" IS '兑换的CDK ID，每个CDK只能有一条兑换记录';
COMMENT ON COLUMN "cdk_redemption"."package_type" IS '兑换时的包类型快照';
COMMENT ON COLUMN "cdk_redemption"."package_name" IS '兑换时的包名称快照';
COMMENT ON COLUMN "cdk_redemption"."package_data" IS '兑换时的完整包数据快照，JSON格式';

COMMENT ON COLUMN "user_cdk_daily_limit"."daily_redemptions" IS '用户当日已兑换CDK次数';
COMMENT ON COLUMN "user_cdk_daily_limit"."last_redemption_reset_date" IS '最后一次重置兑换次数的日期（UTC时区）';

COMMENT ON COLUMN "cdk_config"."user_daily_limit" IS '用户每日可以兑换CDK的最大次数，防止爆破攻击';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_cdk_code" ON "cdk"("code");
CREATE INDEX IF NOT EXISTS "idx_cdk_package_type_id" ON "cdk"("package_type", "package_id");
CREATE INDEX IF NOT EXISTS "idx_cdk_is_redeemed" ON "cdk"("is_redeemed");
CREATE INDEX IF NOT EXISTS "idx_cdk_expires_at" ON "cdk"("expires_at");
CREATE INDEX IF NOT EXISTS "idx_cdk_created_at" ON "cdk"("created_at");

CREATE INDEX IF NOT EXISTS "idx_cdk_redemption_cdk_id" ON "cdk_redemption"("cdk_id");
CREATE INDEX IF NOT EXISTS "idx_cdk_redemption_user_id" ON "cdk_redemption"("user_id");
CREATE INDEX IF NOT EXISTS "idx_cdk_redemption_redeemed_at" ON "cdk_redemption"("redeemed_at");
CREATE INDEX IF NOT EXISTS "idx_cdk_redemption_package_type" ON "cdk_redemption"("package_type");

CREATE INDEX IF NOT EXISTS "idx_user_cdk_daily_limit_user_id" ON "user_cdk_daily_limit"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_cdk_daily_limit_reset_date" ON "user_cdk_daily_limit"("last_redemption_reset_date");

-- 确保cdk_config表只有一条记录
INSERT INTO "cdk_config" ("id", "user_daily_limit", "updated_at")
VALUES (1, 5, now())
ON CONFLICT ("id") DO NOTHING;
