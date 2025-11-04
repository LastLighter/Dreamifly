-- Add ip_address column to model_usage_stats table for crawler analysis
-- 如果字段已存在，则跳过添加
DO $$ 
BEGIN
    -- 检查字段是否已存在
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'model_usage_stats' 
        AND column_name = 'ip_address'
    ) THEN
        -- 添加 ip_address 字段
        ALTER TABLE "model_usage_stats" 
        ADD COLUMN "ip_address" text;
        
        RAISE NOTICE 'Column ip_address added to model_usage_stats table';
    ELSE
        RAISE NOTICE 'Column ip_address already exists in model_usage_stats table';
    END IF;
END $$;

-- Create index on ip_address for faster queries
CREATE INDEX IF NOT EXISTS "idx_model_usage_stats_ip_address" ON "model_usage_stats" ("ip_address");

-- Create composite index for filtering by IP and authentication status
CREATE INDEX IF NOT EXISTS "idx_model_usage_stats_ip_auth" ON "model_usage_stats" ("ip_address", "is_authenticated");

