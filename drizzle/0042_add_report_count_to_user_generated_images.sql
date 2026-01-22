-- 添加举报次数字段到用户生成图片表
-- 用于统计普通用户的举报次数，达到阈值后标记为 NSFW

ALTER TABLE "user_generated_images"
ADD COLUMN "report_count" integer DEFAULT 0 NOT NULL;

-- 添加字段注释
COMMENT ON COLUMN "user_generated_images"."report_count" 
IS '被普通用户举报的次数（优质用户和管理员举报不计入），达到阈值后标记为 NSFW';
