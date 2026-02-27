// 积分导出相关类型定义

export type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'

export type RecordType = 'all' | 'earned' | 'spent'

export type UserRole = 'admin' | 'premium' | 'regular'

// 积分来源类型
export type PointsSourceType = 'purchased' | 'gifted' | 'refund' | 'mixed' | 'other'

// 可导出的字段
export type ExportField =
  | 'id'
  | 'userId'
  | 'userName'
  | 'userEmail'
  | 'userRole'
  | 'points'
  | 'type'
  | 'sourceType'
  | 'description'
  | 'earnedAt'
  | 'expiresAt'
  | 'createdAt'

// 字段中文标签映射
export const FIELD_LABELS: Record<ExportField, string> = {
  id: '记录ID',
  userId: '用户ID',
  userName: '用户名',
  userEmail: '用户邮箱',
  userRole: '用户角色',
  points: '积分数量',
  type: '记录类型',
  sourceType: '积分来源类型',
  description: '描述说明',
  earnedAt: '发生时间',
  expiresAt: '过期时间',
  createdAt: '创建时间',
}

// 默认导出字段
export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  'userName',
  'userEmail',
  'points',
  'type',
  'description',
  'earnedAt',
]

// 导出请求参数
export interface PointsExportParams {
  // 时间筛选
  startDate?: string // ISO 8601格式，如 "2026-01-01"
  endDate?: string // ISO 8601格式，如 "2026-02-10"

  // 字段选择
  fields: ExportField[]

  // 高级筛选（可选）
  userSearch?: string // 用户名/邮箱搜索关键词
  userRoles?: UserRole[] // ['admin', 'premium', 'regular']
  recordType?: RecordType // 'earned' | 'spent' | 'all'
  descriptions?: string[] // 描述关键词列表
  minPoints?: number // 最小积分数（绝对值）
  maxPoints?: number // 最大积分数（绝对值）

  // 分页（防止数据量过大）
  limit?: number // 最大导出条数，默认10000
}

// 导出表单数据
export interface ExportFormData {
  // 时间范围
  timeRange: TimeRange
  startDate?: string
  endDate?: string

  // 字段选择
  fields: ExportField[]

  // 高级筛选
  userSearch?: string
  userRoles: UserRole[]
  recordType: RecordType
  descriptions: string[]
  minPoints?: number
  maxPoints?: number
}

// 积分记录数据结构
export interface PointsRecord {
  id: string
  userId: string
  userName: string | null
  userEmail: string
  isAdmin: boolean
  isPremium: boolean
  points: number
  type: 'earned' | 'spent'
  sourceType: PointsSourceType
  description: string | null
  earnedAt: Date
  expiresAt: Date | null
  createdAt: Date
}

// 导出响应
export interface PointsExportResponse {
  success: boolean
  recordCount: number
  message?: string
}

// =======================
// 用户月度统计相关类型
// =======================

// 月度统计查询/导出公共参数
export interface MonthlyUserStatsParams {
  // 时间范围（前端传 YYYY-MM-DD，后端按月聚合）
  startDate?: string
  endDate?: string

  // 用户搜索（姓名 / 邮箱）
  userSearch?: string

  // 分页（仅查询接口使用，导出接口通常不分页）
  page?: number
  limit?: number
}

// 单个用户的月度统计数据
export interface MonthlyUserStatsUser {
  userId: string
  name: string | null
  email: string
  role: UserRole
  totalConsumedPoints: number
  totalConsumedCount: number
  // 按月份键值对，例如 { '2026-01': 120, '2026-02': 300 }
  monthlyPoints: Record<string, number>
  monthlyCounts: Record<string, number>
}

// 月度统计查询接口响应
export interface MonthlyUserStatsResponse {
  // 参与统计的月份列表，例如 ['2026-01', '2026-02']
  months: string[]
  page: number
  totalPages: number
  totalUsers: number
  totalConsumedPoints: number
  users: MonthlyUserStatsUser[]
}

// 月度统计导出参数
export interface MonthlyUserStatsExportParams extends MonthlyUserStatsParams {
  // 是否在后续版本中导出类型占比相关列（当前实现可忽略，仅为兼容保留）
  includeTypeBreakdown?: boolean
}
