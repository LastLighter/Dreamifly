-- 积分包表增加「是否在前端展示」字段，默认 true
ALTER TABLE "points_package" 
ADD COLUMN IF NOT EXISTS "show_on_frontend" boolean DEFAULT true NOT NULL;

COMMENT ON COLUMN "points_package"."show_on_frontend" IS '是否在前端展示该积分包，默认 true';
