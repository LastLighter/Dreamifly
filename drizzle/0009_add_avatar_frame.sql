-- 创建头像框表
CREATE TABLE IF NOT EXISTS "avatar_frame" (
  "id" serial PRIMARY KEY NOT NULL,
  "category" text NOT NULL,
  "image_url" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- 在用户表中添加头像框ID字段
ALTER TABLE "user" ADD COLUMN "avatar_frame_id" integer;

-- 添加外键约束
ALTER TABLE "user" ADD CONSTRAINT "user_avatar_frame_id_fk" FOREIGN KEY ("avatar_frame_id") REFERENCES "avatar_frame"("id") ON DELETE SET NULL;

