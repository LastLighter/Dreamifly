-- 检查 last_request_reset_date 字段的当前值
-- 在执行调整脚本前，先运行此脚本查看数据

SELECT 
  id,
  email,
  last_request_reset_date as current_value,
  last_request_reset_date - INTERVAL '8 hours' as after_adjustment,
  EXTRACT(EPOCH FROM (last_request_reset_date - INTERVAL '8 hours' - last_request_reset_date)) / 3600 as hours_diff
FROM "user" 
WHERE last_request_reset_date IS NOT NULL 
ORDER BY last_request_reset_date DESC
LIMIT 10;

-- 统计信息
SELECT 
  COUNT(*) as total_users,
  COUNT(last_request_reset_date) as users_with_reset_date,
  MIN(last_request_reset_date) as earliest_reset_date,
  MAX(last_request_reset_date) as latest_reset_date
FROM "user";

