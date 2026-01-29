-- 创建举报记录表
-- 用于记录用户对社区图片的举报信息，便于管理和审核

CREATE TABLE IF NOT EXISTS "image_reports" (
  "id" text PRIMARY KEY, -- UUID主键
  "reporter_id" text NOT NULL, -- 举报人ID
  "image_id" text NOT NULL, -- 被举报的图片ID
  "reason" text NOT NULL, -- 举报原因：pornography, political, violence, gore, illegal, other
  "description" text, -- 详细描述（选择"其他"时可填写）
  "created_at" timestamp DEFAULT now() NOT NULL, -- 举报时间
  "updated_at" timestamp DEFAULT now() NOT NULL -- 更新时间
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS "idx_image_reports_reporter_id" ON "image_reports"("reporter_id");
CREATE INDEX IF NOT EXISTS "idx_image_reports_image_id" ON "image_reports"("image_id");
CREATE INDEX IF NOT EXISTS "idx_image_reports_created_at" ON "image_reports"("created_at" DESC);

-- 添加表注释
COMMENT ON TABLE "image_reports" IS '社区图片举报记录表';
COMMENT ON COLUMN "image_reports"."reporter_id" IS '举报人ID，外键关联user表';
COMMENT ON COLUMN "image_reports"."image_id" IS '被举报的图片ID，外键关联user_generated_images表';
COMMENT ON COLUMN "image_reports"."reason" IS '举报原因：pornography（色情内容）、political（政治敏感）、violence（暴力恐怖）、gore（血腥恶心）、illegal（违法违规）、other（其他）';
COMMENT ON COLUMN "image_reports"."description" IS '详细描述，当选择"其他"时可填写具体原因';