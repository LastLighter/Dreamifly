-- 创建允许的邮箱域名表
CREATE TABLE IF NOT EXISTS allowed_email_domain (
  id SERIAL PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_allowed_email_domain_domain ON allowed_email_domain(domain);
CREATE INDEX IF NOT EXISTS idx_allowed_email_domain_is_enabled ON allowed_email_domain(is_enabled);
CREATE INDEX IF NOT EXISTS idx_allowed_email_domain_created_at ON allowed_email_domain(created_at DESC);

-- 添加注释
COMMENT ON TABLE allowed_email_domain IS '允许的邮箱域名表';
COMMENT ON COLUMN allowed_email_domain.id IS '主键，自增ID';
COMMENT ON COLUMN allowed_email_domain.domain IS '邮箱域名，唯一';
COMMENT ON COLUMN allowed_email_domain.is_enabled IS '是否启用';
COMMENT ON COLUMN allowed_email_domain.created_at IS '创建时间';
COMMENT ON COLUMN allowed_email_domain.updated_at IS '更新时间';

-- 插入一些默认的常用邮箱域名
INSERT INTO allowed_email_domain (domain, is_enabled) VALUES
  ('gmail.com', true),
  ('outlook.com', true),
  ('hotmail.com', true),
  ('qq.com', true),
  ('163.com', true),
  ('126.com', true),
  ('sina.com', true),
  ('yahoo.com', true)
ON CONFLICT (domain) DO NOTHING;

