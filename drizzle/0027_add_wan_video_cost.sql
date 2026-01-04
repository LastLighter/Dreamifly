-- 添加Wan视频模型积分消耗字段
ALTER TABLE points_config 
ADD COLUMN IF NOT EXISTS wan_video_cost INTEGER;

