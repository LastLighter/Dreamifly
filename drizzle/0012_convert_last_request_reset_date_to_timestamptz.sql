-- 将 last_request_reset_date 字段从 timestamp 改为 timestamptz
-- 这样可以自动处理时区转换，避免时区相关的问题
-- 
-- 重要说明：
-- 1. timestamptz 在 PostgreSQL 中总是以 UTC 存储
-- 2. 根据当前代码使用 (now() at time zone 'UTC') 存储，现有数据应该是 UTC 时间
-- 3. 如果之前使用过 (now() at time zone 'Asia/Shanghai')，数据可能是东八区时间
-- 
-- 转换逻辑：
-- - 如果数据是 UTC 时间：使用 AT TIME ZONE 'UTC' 将其解释为 UTC，然后转为 timestamptz
-- - 如果数据是东八区时间：使用 AT TIME ZONE 'Asia/Shanghai' 将其解释为东八区，然后转为 timestamptz

DO $$ 
BEGIN
    -- 检查字段是否存在且类型为 timestamp without time zone
    IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'last_request_reset_date'
        AND data_type = 'timestamp without time zone'
    ) THEN
        -- 将 timestamp without time zone 转换为 timestamptz
        -- 根据当前代码逻辑，数据应该是 UTC 时间
        -- AT TIME ZONE 'UTC' 将 timestamp 解释为 UTC 时区的本地时间，然后转换为 timestamptz
        ALTER TABLE "user" 
        ALTER COLUMN "last_request_reset_date" TYPE timestamptz 
        USING ("last_request_reset_date" AT TIME ZONE 'UTC');
        
        RAISE NOTICE 'Column last_request_reset_date converted to timestamptz (assumed UTC)';
    ELSIF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'last_request_reset_date'
        AND data_type = 'timestamp with time zone'
    ) THEN
        -- 如果已经是 timestamptz，不需要修改
        RAISE NOTICE 'Column last_request_reset_date is already timestamptz';
    ELSE
        RAISE NOTICE 'Column last_request_reset_date does not exist';
    END IF;
END $$;

