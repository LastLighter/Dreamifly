-- Add avatar column to user table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'user' 
        AND column_name = 'avatar'
    ) THEN
        ALTER TABLE "user" ADD COLUMN "avatar" varchar(500) DEFAULT '/images/default-avatar.svg';
    END IF;
END $$;

