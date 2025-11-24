-- 检查修复前的时间情况
-- 用于确认问题

SELECT 
  id,
  email,
  -- 显示时间（根据会话时区，可能是东八区）
  last_request_reset_date as displayed_time,
  -- 实际存储的UTC时间
  last_request_reset_date AT TIME ZONE 'UTC' as stored_utc_time,
  -- 转换为东八区时间
  last_request_reset_date AT TIME ZONE 'Asia/Shanghai' as shanghai_time,
  -- Unix时间戳
  EXTRACT(EPOCH FROM last_request_reset_date) as unix_timestamp,
  -- 如果回退8小时后的值
  (last_request_reset_date - INTERVAL '8 hours') as after_minus_8h,
  (last_request_reset_date - INTERVAL '8 hours') AT TIME ZONE 'Asia/Shanghai' as after_minus_8h_shanghai
FROM "user" 
WHERE last_request_reset_date IS NOT NULL 
ORDER BY last_request_reset_date DESC
LIMIT 5;

