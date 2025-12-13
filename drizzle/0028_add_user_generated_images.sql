-- 创建用户生成图片表
CREATE TABLE IF NOT EXISTS "user_generated_images" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "image_url" text NOT NULL,
  "prompt" text,
  "model" text,
  "width" integer,
  "height" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_user_generated_images_user_id_created_at" 
  ON "user_generated_images"("user_id", "created_at" DESC);

