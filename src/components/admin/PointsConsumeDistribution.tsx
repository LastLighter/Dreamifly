'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from '@/lib/auth-client'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

interface DistributionData {
  type: string
  consumedPoints: number
  percentage: number
  recordCount: number
  averageCost: number
}

interface Props {
  timeRange: TimeRange
}

const COLORS = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#45B7D1', // 蓝色
  '#FFA07A', // 橙色
  '#98D8C8', // 绿色
  '#F7DC6F', // 黄色
  '#BB8FCE', // 紫色
  '#85C1E9', // 浅蓝
  '#F8C471', // 金色
  '#82E0AA', // 浅绿
]

export default function PointsConsumeDistribution({ timeRange }: Props) {
  const [distribution, setDistribution] = useState<DistributionData[]>([])
  const [totalConsumed, setTotalConsumed] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [loading, setLoading] = useState(true)
  const { data: session } = useSession()

  const fetchDistribution = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/points/consume-distribution?timeRange=${timeRange}&t=${Date.now()}`
      )
      if (response.ok) {
        const data = await response.json()
        setDistribution(data.distribution)
        setTotalConsumed(data.totalConsumed)
        setTotalRecords(data.totalRecords)
      }
    } catch (error) {
      console.error('Failed to fetch consume distribution:', error)
    } finally {
      setLoading(false)
    }
  }, [timeRange])

  // 首次加载 & 时间范围变化时刷新
  useEffect(() => {
    if (session?.user) {
      fetchDistribution()
    }
  }, [session?.user, fetchDistribution])

  // 自动刷新 - 每30秒
  useEffect(() => {
    if (!session?.user) return

    const interval = setInterval(() => {
      fetchDistribution()
    }, 30000) // 30秒

    return () => clearInterval(interval)
  }, [session?.user, fetchDistribution])

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'hour':
        return '近一小时'
      case 'today':
        return '今天'
      case 'yesterday':
        return '昨天'
      case 'week':
        return '最近一周'
      case 'month':
        return '最近一月'
      case 'all':
      default:
        return '全部'
    }
  }

  if (loading && distribution.length === 0) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="text-sm text-gray-600">
          当前时间范围：<span className="font-medium text-orange-600">{getTimeRangeLabel()}</span>
        </div>
        <button
          onClick={() => fetchDistribution()}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>

      {/* 统计概览 */}
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600">总消耗积分</div>
            <div className="text-2xl font-bold text-orange-600">{totalConsumed.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600">消耗记录总数</div>
            <div className="text-2xl font-bold text-blue-600">{totalRecords.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600">消耗类型数量</div>
            <div className="text-2xl font-bold text-green-600">{distribution.length}</div>
          </div>
        </div>
      </div>

      {distribution.length === 0 ? (
        <div className="p-8 text-center text-gray-500">该时间范围内暂无积分消耗记录</div>
      ) : (
        <>
          {/* 图表区域 */}
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 饼图 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">消耗类型占比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distribution as any}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="consumedPoints"
                  >
                    {distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), '消耗积分']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* 柱状图 */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">消耗积分对比</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={distribution as any}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="type"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                    fontSize={12}
                  />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), '消耗积分']} />
                  <Bar dataKey="consumedPoints" fill="#FF6B6B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 数据表格 */}
          <div className="p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">详细数据</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      消耗类型
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      消耗积分
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      占比
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      记录数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      平均消耗
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {distribution.map((item, index) => (
                    <tr key={item.type}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          {item.type}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.consumedPoints.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.percentage}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.recordCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.averageCost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
