-- 添加优质用户标记和每日请求次数字段
ALTER TABLE "user" ADD COLUMN "is_premium" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN "daily_request_count" integer DEFAULT 0;
ALTER TABLE "user" ADD COLUMN "last_request_reset_date" timestamp DEFAULT now();

