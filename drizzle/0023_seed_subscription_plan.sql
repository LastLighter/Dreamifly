-- 重置订阅与积分套餐数据，避免重复残留
BEGIN;

DELETE FROM "points_package";
DELETE FROM "subscription_plan";

-- 插入默认订阅套餐数据
-- 月度订阅套餐 39.9元，赠送3000积分，每日签到双倍积分

INSERT INTO "subscription_plan" (
  "name",
  "type",
  "price",
  "original_price",
  "bonus_points",
  "daily_points_multiplier",
  "description",
  "features",
  "is_active",
  "sort_order"
) VALUES (
  '月度会员',
  'monthly',
  39.9,
  49.9,
  3000,
  2.0,
  '解锁会员专属权益，每日签到获得双倍积分',
  '["立即获得3000积分","每日签到双倍积分","专属会员标识","优先客服支持","商用无忧","极速生成","无广告体验"]',
  true,
  1
)
ON CONFLICT DO NOTHING;

-- 季度订阅套餐 100元，权益与月度一致
INSERT INTO "subscription_plan" (
  "name",
  "type",
  "price",
  "original_price",
  "bonus_points",
  "daily_points_multiplier",
  "description",
  "features",
  "is_active",
  "sort_order"
) VALUES (
  '季度会员',
  'quarterly',
  100,
  NULL,
  3000,
  2.0,
  '季度订阅，享受与月度会员一致的所有权益',
  '["立即获得3000积分","每日签到双倍积分","专属会员标识","优先客服支持","商用无忧","极速生成","无广告体验","生成内容不公开"]',
  true,
  2
)
ON CONFLICT DO NOTHING;

-- 可选：也插入一些积分套餐作为备选购买方式
INSERT INTO "points_package" ("name", "points", "price", "original_price", "is_popular", "is_active", "sort_order")
VALUES 
  -- 按 100 积分 / 元计算，并应用额外赠送
  ('入门包', 1000, 9.9, NULL, false, true, 1),              -- 约10元
  ('基础包', 2000, 19.9, NULL, false, true, 2),              -- 约20元
  ('进阶包（+10%）', 5500, 49.9, NULL, true, true, 3),       -- 5000 + 10%
  ('豪华包（+20%）', 12000, 99.9, NULL, false, true, 4)      -- 10000 + 20%
ON CONFLICT DO NOTHING;

COMMIT;

