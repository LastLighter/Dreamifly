import { pgTable, timestamp, integer, text, boolean, real, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const siteStats = pgTable('site_stats', {
  id: integer('id').primaryKey().default(1),
  totalGenerations: integer('total_generations').default(0),
  dailyGenerations: integer('daily_generations').default(0),
  lastResetDate: timestamp('last_reset_date').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Better Auth Tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false), // 数据库字段名: email_verified
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(), // 数据库字段名: created_at
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 数据库字段名: updated_at
  nickname: text("nickname"),
  uid: integer("uid").unique(), // 用户唯一数字ID，自增（注册后设置）
  avatar: text("avatar").default("/images/default-avatar.svg"), // 用户头像
  signature: text("signature"),
  isActive: boolean("is_active").default(true), // 数据库字段名: is_active
  lastLoginAt: timestamp("last_login_at"), // 数据库字段名: last_login_at，存储时间戳
  isAdmin: boolean("is_admin").default(false), // 数据库字段名: is_admin
  isPremium: boolean("is_premium").default(false), // 数据库字段名: is_premium，标记是否为优质用户
  isOldUser: boolean("is_old_user").default(false), // 数据库字段名: is_old_user，标记是否为老用户
  dailyRequestCount: integer("daily_request_count").default(0), // 数据库字段名: daily_request_count，当日请求次数
  lastRequestResetDate: timestamp("last_request_reset_date").defaultNow(), // 数据库字段名: last_request_reset_date，上次重置请求次数的日期（类型为 timestamptz）
  avatarFrameId: integer("avatar_frame_id"), // 数据库字段名: avatar_frame_id，头像框ID，为null时使用默认头像框
  isSubscribed: boolean("is_subscribed").default(false), // 是否为订阅用户
  subscriptionExpiresAt: timestamp("subscription_expires_at"), // 订阅过期时间
  lastDailyAwardDate: timestamp("last_daily_award_date"), // 数据库字段名: last_daily_award_date，最后签到日期（东八区凌晨4点刷新）
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(), // 数据库字段名: expires_at
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(), // 数据库字段名: created_at
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 数据库字段名: updated_at
  ipAddress: text("ip_address"), // 数据库字段名: ip_address
  userAgent: text("user_agent"), // 数据库字段名: user_agent
  userId: text("user_id") // 数据库字段名: user_id
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(), // 数据库字段名: account_id
  providerId: text("provider_id").notNull(), // 数据库字段名: provider_id
  userId: text("user_id") // 数据库字段名: user_id
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), // 数据库字段名: access_token
  refreshToken: text("refresh_token"), // 数据库字段名: refresh_token
  idToken: text("id_token"), // 数据库字段名: id_token
  accessTokenExpiresAt: timestamp("access_token_expires_at"), // 数据库字段名: access_token_expires_at
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"), // 数据库字段名: refresh_token_expires_at
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(), // 数据库字段名: created_at
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 数据库字段名: updated_at
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 数据库字段名: expires_at
  createdAt: timestamp("created_at").defaultNow(), // 数据库字段名: created_at
  updatedAt: timestamp("updated_at").defaultNow(), // 数据库字段名: updated_at
});

// 模型调用统计表
export const modelUsageStats = pgTable("model_usage_stats", {
  id: text("id").primaryKey(), // 使用UUID作为主键
  modelName: text("model_name").notNull(), // 模型名称
  userId: text("user_id"), // 用户ID，可以为null（未登录用户）
  responseTime: real("response_time").notNull(), // 响应时间（秒）
  isAuthenticated: boolean("is_authenticated").default(false).notNull(), // 是否已登录
  ipAddress: text("ip_address"), // IP地址，用于爬虫分析
  createdAt: timestamp("created_at").defaultNow().notNull(), // 调用时间
});

// 用户限额配置表
export const userLimitConfig = pgTable("user_limit_config", {
  id: integer("id").primaryKey().default(1), // 单例配置，id固定为1
  regularUserDailyLimit: integer("regular_user_daily_limit"), // 普通用户每日限额，null表示使用环境变量
  premiumUserDailyLimit: integer("premium_user_daily_limit"), // 优质用户每日限额，null表示使用环境变量
  newUserDailyLimit: integer("new_user_daily_limit"), // 新用户每日限额，null表示使用环境变量
  unauthenticatedIpDailyLimit: integer("unauthenticated_ip_daily_limit"), // 未登录用户IP每日限额，null表示使用环境变量
  regularUserMaxImages: integer("regular_user_max_images"), // 普通用户最大图片数，null表示使用环境变量
  subscribedUserMaxImages: integer("subscribed_user_max_images"), // 订阅用户最大图片数，null表示使用环境变量
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// IP并发记录表
export const ipConcurrency = pgTable("ip_concurrency", {
  ipAddress: text("ip_address").primaryKey(), // IP地址作为主键
  currentConcurrency: integer("current_concurrency").default(0).notNull(), // 当前并发量
  maxConcurrency: integer("max_concurrency"), // 最大并发量，null表示不限（管理员）
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 最后更新时间
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
});

// IP黑名单表
export const ipBlacklist = pgTable("ip_blacklist", {
  id: text("id").primaryKey(), // 使用UUID作为主键
  ipAddress: text("ip_address").notNull().unique(), // IP地址，唯一
  reason: text("reason"), // 拉黑原因
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 更新时间
  createdBy: text("created_by"), // 创建者（管理员ID）
});

// IP注册限制表
export const ipRegistrationLimit = pgTable("ip_registration_limit", {
  ipAddress: text("ip_address").primaryKey(), // IP地址作为主键
  registrationCount: integer("registration_count").default(0).notNull(), // 注册次数
  firstRegistrationAt: timestamp("first_registration_at"), // 第一次注册时间，用于计算24小时窗口
  lastRegistrationAt: timestamp("last_registration_at"), // 最后一次注册时间
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 更新时间
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
});

// 未登录用户IP每日调用记录表
export const ipDailyUsage = pgTable("ip_daily_usage", {
  ipAddress: text("ip_address").primaryKey(), // IP地址作为主键
  dailyRequestCount: integer("daily_request_count").default(0).notNull(), // 当日请求次数
  lastRequestResetDate: timestamp("last_request_reset_date").defaultNow().notNull(), // 上次重置请求次数的日期（类型为 timestamptz）
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 更新时间
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
});

// 头像框表
export const avatarFrame = pgTable("avatar_frame", {
  id: serial("id").primaryKey(), // 头像框ID，自增
  category: text("category").notNull(), // 头像框分类
  imageUrl: text("image_url"), // 头像框图片路径，如果为null则使用默认头像框
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 更新时间
});

// 允许的邮箱域名表
export const allowedEmailDomain = pgTable("allowed_email_domain", {
  id: serial("id").primaryKey(), // 自增ID
  domain: text("domain").notNull().unique(), // 邮箱域名，唯一
  isEnabled: boolean("is_enabled").default(true).notNull(), // 是否启用
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // 更新时间
});

// 积分记录表
export const userPoints = pgTable("user_points", {
  id: text("id").primaryKey(), // 使用UUID作为主键
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }), // 用户ID，外键关联user表
  points: integer("points").notNull(), // 积分数量，正数表示获得，负数表示消费
  type: text("type").notNull(), // 积分类型：'earned' | 'spent'
  description: text("description"), // 描述
  earnedAt: timestamp("earned_at").defaultNow().notNull(), // 获得/消费时间
  expiresAt: timestamp("expires_at"), // 过期时间，仅对获得的积分有效
  createdAt: timestamp("created_at").defaultNow().notNull(), // 创建时间
});

// 积分配置表
export const pointsConfig = pgTable("points_config", {
  id: integer("id").primaryKey().default(1), // 单例配置
  regularUserDailyPoints: integer("regular_user_daily_points"), // 普通用户每日积分，null表示使用环境变量
  premiumUserDailyPoints: integer("premium_user_daily_points"), // 优质用户每日积分
  pointsExpiryDays: integer("points_expiry_days"), // 积分过期天数
  repairWorkflowCost: integer("repair_workflow_cost"), // 工作流修复消耗
  upscaleWorkflowCost: integer("upscale_workflow_cost"), // 工作流放大消耗
  zImageTurboCost: integer("z_image_turbo_cost"), // Z-Image-Turbo模型积分消耗，null表示使用环境变量
  qwenImageEditCost: integer("qwen_image_edit_cost"), // Qwen-Image-Edit模型积分消耗，null表示使用环境变量
  waiSdxlV150Cost: integer("wai_sdxl_v150_cost"), // Wai-SDXL-V150模型积分消耗，null表示使用环境变量
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 用户订阅表
export const userSubscription = pgTable("user_subscription", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  planType: text("plan_type").notNull().default('monthly'), // 'monthly', 'quarterly', 'yearly'
  status: text("status").notNull().default('active'), // 'active', 'expired', 'cancelled'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 积分套餐表
export const pointsPackage = pgTable("points_package", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  points: integer("points").notNull(),
  price: real("price").notNull(), // 价格（人民币）
  originalPrice: real("original_price"), // 原价（用于显示折扣）
  isPopular: boolean("is_popular").default(false), // 是否热门
  isActive: boolean("is_active").default(true), // 是否上架
  sortOrder: integer("sort_order").default(0), // 排序
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 订阅套餐表
export const subscriptionPlan = pgTable("subscription_plan", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default('monthly'), // 'monthly', 'quarterly', 'yearly'
  price: real("price").notNull(),
  originalPrice: real("original_price"),
  bonusPoints: integer("bonus_points").notNull().default(3000), // 订阅赠送积分
  dailyPointsMultiplier: real("daily_points_multiplier").notNull().default(2.0), // 每日签到积分倍率
  description: text("description"),
  features: text("features"), // JSON格式的功能列表
  isPopular: boolean("is_popular").default(false), // 是否热门
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 订单表
export const paymentOrder = pgTable("payment_order", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  orderType: text("order_type").notNull(), // 'subscription', 'points'
  productId: text("product_id").notNull(), // 关联的套餐ID
  amount: real("amount").notNull(), // 支付金额
  pointsAmount: integer("points_amount"), // 积分数量（仅积分订单）
  status: text("status").notNull().default('pending'), // 'pending', 'paid', 'failed', 'refunded'
  paymentMethod: text("payment_method"), // 'alipay', 'wechat'
  paymentId: text("payment_id"), // 第三方支付订单号
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
});

// 用户生成图片表
export const userGeneratedImages = pgTable("user_generated_images", {
  id: text("id").primaryKey(), // UUID
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(), // OSS中的图片URL
  prompt: text("prompt"), // 生成时的提示词
  model: text("model"), // 使用的模型
  width: integer("width"), // 图片宽度
  height: integer("height"), // 图片高度
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 用户与头像框的关系
export const userRelations = relations(user, ({ one }) => ({
  avatarFrame: one(avatarFrame, {
    fields: [user.avatarFrameId],
    references: [avatarFrame.id],
  }),
}));