-- Create model_usage_stats table for tracking model API calls
-- 如果表已存在，需要先修改字段类型为带时区的timestamp
DO $$ 
BEGIN
    -- 如果表不存在，创建表
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'model_usage_stats') THEN
        CREATE TABLE "model_usage_stats" (
          "id" text PRIMARY KEY,
          "model_name" text NOT NULL,
          "user_id" text,
          "response_time" real NOT NULL,
          "is_authenticated" boolean NOT NULL DEFAULT false,
          "created_at" timestamptz NOT NULL DEFAULT now()
        );
    ELSE
        -- 如果表已存在，修改created_at字段类型为timestamptz
        -- 假设现有数据存储的是UTC时间，将其转换为timestamptz
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'model_usage_stats' 
            AND column_name = 'created_at'
            AND data_type = 'timestamp without time zone'
        ) THEN
            -- 将timestamp without time zone转换为timestamptz
            -- 假设现有数据是UTC时间，需要加8小时转换为中国时区，然后再转为timestamptz
            ALTER TABLE "model_usage_stats" 
            ALTER COLUMN "created_at" TYPE timestamptz 
            USING (("created_at" + INTERVAL '8 hours') AT TIME ZONE 'UTC');
        ELSIF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'model_usage_stats' 
            AND column_name = 'created_at'
            AND data_type = 'timestamp with time zone'
        ) THEN
            -- 如果已经是timestamptz，不需要修改
            RAISE NOTICE 'Column created_at is already timestamptz';
        END IF;
    END IF;
END $$;

-- Create index on model_name for faster queries
CREATE INDEX IF NOT EXISTS "idx_model_usage_stats_model_name" ON "model_usage_stats" ("model_name");

-- Create index on created_at for time range queries
CREATE INDEX IF NOT EXISTS "idx_model_usage_stats_created_at" ON "model_usage_stats" ("created_at");

-- Create index on user_id for user-specific queries
CREATE INDEX IF NOT EXISTS "idx_model_usage_stats_user_id" ON "model_usage_stats" ("user_id");

-- Create composite index for filtering by model and authentication status
CREATE INDEX IF NOT EXISTS "idx_model_usage_stats_model_auth" ON "model_usage_stats" ("model_name", "is_authenticated");

