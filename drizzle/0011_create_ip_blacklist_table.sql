-- 创建IP黑名单表
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id TEXT PRIMARY KEY,
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by TEXT
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_ip_address ON ip_blacklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blacklist_created_at ON ip_blacklist(created_at DESC);

-- 添加注释
COMMENT ON TABLE ip_blacklist IS 'IP黑名单表';
COMMENT ON COLUMN ip_blacklist.id IS '主键，使用UUID';
COMMENT ON COLUMN ip_blacklist.ip_address IS 'IP地址，唯一';
COMMENT ON COLUMN ip_blacklist.reason IS '拉黑原因';
COMMENT ON COLUMN ip_blacklist.created_at IS '创建时间';
COMMENT ON COLUMN ip_blacklist.updated_at IS '更新时间';
COMMENT ON COLUMN ip_blacklist.created_by IS '创建者（管理员ID）';

