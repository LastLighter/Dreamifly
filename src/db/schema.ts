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