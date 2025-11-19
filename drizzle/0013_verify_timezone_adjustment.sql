-- 验证时间戳调整是否生效
-- 重要：timestamptz 显示时会根据会话时区转换，需要查看UTC时间才能看到实际变化

-- 方法1：查看UTC时间（实际存储值）
SELECT 
  id,
  email,
  -- 显示为会话时区时间（可能是东八区）
  last_request_reset_date as displayed_time,
  -- 转换为UTC时间查看实际存储值（关键！）
  last_request_reset_date AT TIME ZONE 'UTC' as stored_utc_time,
  -- 查看Unix时间戳（绝对时间，不受时区影响）
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
RESET TIME ZONE;  -- 恢复原时区

-- 检查字段类型
SELECT 
  column_name,
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'user' 
AND column_name = 'last_request_reset_date';

