-- 为用户生成图片表添加媒体类型和视频相关字段
ALTER TABLE "user_generated_images" 
ADD COLUMN IF NOT EXISTS "media_type" text DEFAULT 'image' NOT NULL,
ADD COLUMN IF NOT EXISTS "duration" integer, -- 视频时长（秒）
ADD COLUMN IF NOT EXISTS "fps" integer, -- 视频帧率
ADD COLUMN IF NOT EXISTS "frame_count" integer; -- 视频总帧数

-- 为未通过审核图片表添加媒体类型和视频相关字段
ALTER TABLE "rejected_images" 
ADD COLUMN IF NOT EXISTS "media_type" text DEFAULT 'image' NOT NULL,
ADD COLUMN IF NOT EXISTS "duration" integer, -- 视频时长（秒）
ADD COLUMN IF NOT EXISTS "fps" integer, -- 视频帧率
ADD COLUMN IF NOT EXISTS "frame_count" integer; -- 视频总帧数

-- 添加注释
COMMENT ON COLUMN "user_generated_images"."media_type" IS '媒体类型：image（图片）或 video（视频）';
COMMENT ON COLUMN "user_generated_images"."duration" IS '视频时长（秒），仅视频类型有效';
COMMENT ON COLUMN "user_generated_images"."fps" IS '视频帧率，仅视频类型有效';
COMMENT ON COLUMN "user_generated_images"."frame_count" IS '视频总帧数，仅视频类型有效';

COMMENT ON COLUMN "rejected_images"."media_type" IS '媒体类型：image（图片）或 video（视频）';
COMMENT ON COLUMN "rejected_images"."duration" IS '视频时长（秒），仅视频类型有效';
COMMENT ON COLUMN "rejected_images"."fps" IS '视频帧率，仅视频类型有效';
COMMENT ON COLUMN "rejected_images"."frame_count" IS '视频总帧数，仅视频类型有效';

-- 创建索引以提高查询性能（按媒体类型筛选）
CREATE INDEX IF NOT EXISTS "idx_user_generated_images_media_type" 
  ON "user_generated_images"("media_type");

CREATE INDEX IF NOT EXISTS "idx_rejected_images_media_type" 
  ON "rejected_images"("media_type");

