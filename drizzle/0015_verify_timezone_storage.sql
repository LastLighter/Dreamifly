-- 验证 last_request_reset_date 字段的实际存储值和显示值
-- 用于诊断时区转换问题

-- 方法1：查看原始存储值（UTC）
SELECT 
  id,
  email,
  -- 显示为会话时区（可能是东八区）
  last_request_reset_date as displayed_time,
  -- 转换为UTC查看实际存储值
  last_request_reset_date AT TIME ZONE 'UTC' as stored_utc_time,
  -- 转换为东八区时间
  last_request_reset_date AT TIME ZONE 'Asia/Shanghai' as shanghai_time,
  -- Unix时间戳（绝对时间）
  EXTRACT(EPOCH FROM last_request_reset_date) as unix_timestamp
FROM "user" 
WHERE last_request_reset_date IS NOT NULL 
ORDER BY last_request_reset_date DESC
LIMIT 5;

-- 方法2：临时切换到UTC时区查看
SET TIME ZONE 'UTC';
SELECT 
  id,
  email,
  last_request_reset_date as utc_display_time
FROM "user" 
WHERE last_request_reset_date IS NOT NULL 
ORDER BY last_request_reset_date DESC
LIMIT 5;
RESET TIME ZONE;

-- 方法3：查看当前会话时区设置
SHOW timezone;

