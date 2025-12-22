-- 创建违禁词表
CREATE TABLE IF NOT EXISTS profanity_word (
  id SERIAL PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_profanity_word_word ON profanity_word(word);
CREATE INDEX IF NOT EXISTS idx_profanity_word_is_enabled ON profanity_word(is_enabled);
CREATE INDEX IF NOT EXISTS idx_profanity_word_created_at ON profanity_word(created_at DESC);

-- 添加注释
COMMENT ON TABLE profanity_word IS '违禁词表';
COMMENT ON COLUMN profanity_word.id IS '主键，自增ID';
COMMENT ON COLUMN profanity_word.word IS '违禁词内容，唯一';
COMMENT ON COLUMN profanity_word.is_enabled IS '是否启用';
COMMENT ON COLUMN profanity_word.created_at IS '创建时间';
COMMENT ON COLUMN profanity_word.updated_at IS '更新时间';

