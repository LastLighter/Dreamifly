-- 添加无水印下载协议同意字段到用户表
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS accepted_download_terms BOOLEAN DEFAULT false;

-- 添加注释
COMMENT ON COLUMN "user".accepted_download_terms IS '是否同意无水印下载协议';
