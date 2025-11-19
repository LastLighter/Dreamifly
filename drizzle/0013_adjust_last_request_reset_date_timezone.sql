-- 将所有 last_request_reset_date 字段的时间戳回退8小时
-- 这是简单的时间戳回退，不是时区转换
-- 例如：2025-11-18 07:17:26 -> 2025-11-17 23:17:26

DO $$ 
DECLARE
    affected_rows INTEGER;
BEGIN
    -- 检查字段是否存在
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'last_request_reset_date'
    ) THEN
        -- 更新所有非空的 last_request_reset_date，直接减去8小时
        UPDATE "user"
        SET 
            last_request_reset_date = last_request_reset_date - INTERVAL '8 hours'
        WHERE last_request_reset_date IS NOT NULL;
        
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        
        RAISE NOTICE 'Updated % rows: last_request_reset_date adjusted by -8 hours', affected_rows;
    ELSE
        RAISE NOTICE 'Column last_request_reset_date does not exist';
    END IF;
END $$;

-- 验证更新结果（可选，可以手动运行查看）
-- SELECT 
--   id,
--   last_request_reset_date,
--   last_request_reset_date AT TIME ZONE 'UTC' as utc_time,
--   last_request_reset_date AT TIME ZONE 'Asia/Shanghai' as shanghai_time
-- FROM "user" 
-- WHERE last_request_reset_date IS NOT NULL 
-- LIMIT 5;

