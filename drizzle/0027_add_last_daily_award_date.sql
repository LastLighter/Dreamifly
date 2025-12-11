-- 添加最后签到日期字段到 user 表
-- 用于记录用户最后签到的日期（东八区凌晨4点刷新）
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_daily_award_date" timestamp;