-- 创建未通过审核图片表
CREATE TABLE IF NOT EXISTS "rejected_images" (
  "id" text PRIMARY KEY,
  "user_id" text, -- 可为NULL（未登录用户）
  "ip_address" text, -- 未登录用户的IP地址
  "image_url" text NOT NULL, -- OSS中的加密图片URL
  "prompt" text, -- 生成时的提示词
  "model" text, -- 使用的模型
  "width" integer, -- 图片宽度
  "height" integer, -- 图片高度
  "user_role" text, -- 用户角色（不包含admin）
  "user_avatar" text, -- 用户头像URL
  "user_nickname" text, -- 用户昵称
  "avatar_frame_id" integer, -- 头像框ID
  "rejection_reason" text, -- 拒绝原因：'image' | 'prompt' | 'both'
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS "idx_rejected_images_user_id" ON "rejected_images"("user_id");
CREATE INDEX IF NOT EXISTS "idx_rejected_images_created_at" ON "rejected_images"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_rejected_images_ip_address" ON "rejected_images"("ip_address");

-- 添加注释
COMMENT ON TABLE "rejected_images" IS '未通过审核的图片记录表';
COMMENT ON COLUMN "rejected_images"."user_id" IS '用户ID，可为NULL（未登录用户）';
COMMENT ON COLUMN "rejected_images"."ip_address" IS '未登录用户的IP地址';
COMMENT ON COLUMN "rejected_images"."image_url" IS 'OSS中的加密图片URL（.dat格式）';
COMMENT ON COLUMN "rejected_images"."rejection_reason" IS '拒绝原因：image（图片审核未通过）、prompt（提示词审核未通过）、both（两者都未通过）';

