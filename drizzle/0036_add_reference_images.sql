-- 为用户生成图片表添加参考图片字段
ALTER TABLE "user_generated_images" 
ADD COLUMN IF NOT EXISTS "reference_images" JSONB DEFAULT '[]'::jsonb;

-- 为未通过审核图片表添加参考图片字段
ALTER TABLE "rejected_images" 
ADD COLUMN IF NOT EXISTS "reference_images" JSONB DEFAULT '[]'::jsonb;

-- 添加注释
COMMENT ON COLUMN "user_generated_images"."reference_images" IS '参考图片URL数组（加密存储），用于图生图场景';
COMMENT ON COLUMN "rejected_images"."reference_images" IS '参考图片URL数组（加密存储），用于图生图场景';

