-- 为用户生成图片表添加 NSFW 字段
-- NSFW 标记用于标识不适合在社区展示的图片内容
ALTER TABLE "user_generated_images"
ADD COLUMN IF NOT EXISTS "nsfw" boolean DEFAULT false NOT NULL;

-- 添加注释
COMMENT ON COLUMN "user_generated_images"."nsfw" IS '是否为 NSFW 内容，true 表示不适合在社区展示，默认为 false';