-- 为积分套餐表添加 name_tag 字段，用于前端展示
ALTER TABLE "points_package" 
ADD COLUMN IF NOT EXISTS "name_tag" text;

-- 添加注释
COMMENT ON COLUMN "points_package"."name_tag" IS '套餐标题标签，用于在前端显示套餐标题时加在标题后面，仅用于前端展示';

