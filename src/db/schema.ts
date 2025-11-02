import { pgTable, timestamp, integer, text, boolean } from 'drizzle-orm/pg-core';

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
  lastLoginAt: timestamp("last_login_at"), // 数据库字段名: last_login_at
  isAdmin: boolean("is_admin").default(false), // 数据库字段名: is_admin
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