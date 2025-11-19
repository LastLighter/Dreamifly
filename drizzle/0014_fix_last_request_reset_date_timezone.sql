-- 修复 last_request_reset_date 字段的时区问题
-- 问题：显示时间比实际时间多了约8小时
-- 解决：将所有时间戳回退8小时，使显示时间正确

-- 先查看当前情况
DO $$ 
DECLARE
    sample_time timestamptz;
    sample_utc timestamptz;
    sample_shanghai timestamptz;
BEGIN
    -- 获取一个样本时间
    SELECT last_request_reset_date INTO sample_time
    FROM "user" 
    WHERE last_request_reset_date IS NOT NULL 
    LIMIT 1;
    
    IF sample_time IS NOT NULL THEN
        sample_utc := sample_time AT TIME ZONE 'UTC';
        sample_shanghai := sample_time AT TIME ZONE 'Asia/Shanghai';
        
        RAISE NOTICE '当前显示时间: %', sample_time;
        RAISE NOTICE '实际UTC时间: %', sample_utc;
        RAISE NOTICE '转换为东八区: %', sample_shanghai;
        RAISE NOTICE '将回退8小时...';
    END IF;
END $$;

-- 执行回退8小时
DO $$ 
DECLARE
    affected_rows INTEGER;
BEGIN
    -- 检查字段是否存在
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'last_request_reset_date'
        AND data_type = 'timestamp with time zone'
    ) THEN
        -- 更新所有非空的 last_request_reset_date，减去8小时
        UPDATE "user"
        SET 
            last_request_reset_date = last_request_reset_date - INTERVAL '8 hours'
        WHERE last_request_reset_date IS NOT NULL;
        
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        
        RAISE NOTICE '已更新 % 行数据，时间戳回退8小时', affected_rows;
        
        -- 显示更新后的样本
        DECLARE
            sample_time timestamptz;
            sample_utc timestamptz;
            sample_shanghai timestamptz;
        BEGIN
            SELECT last_request_reset_date INTO sample_time
            FROM "user" 
            WHERE last_request_reset_date IS NOT NULL 
            LIMIT 1;
            
            IF sample_time IS NOT NULL THEN
                sample_utc := sample_time AT TIME ZONE 'UTC';
                sample_shanghai := sample_time AT TIME ZONE 'Asia/Shanghai';
                
                RAISE NOTICE '更新后显示时间: %', sample_time;
                RAISE NOTICE '更新后UTC时间: %', sample_utc;
                RAISE NOTICE '更新后东八区时间: %', sample_shanghai;
            END IF;
        END;
    ELSE
        RAISE NOTICE '字段不存在或类型不正确';
    END IF;
END $$;

