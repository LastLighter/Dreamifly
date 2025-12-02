-- 添加老用户标记字段
ALTER TABLE "user" ADD COLUMN "is_old_user" boolean DEFAULT false;