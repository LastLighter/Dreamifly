'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth-client'

type TimeRange = 'hour' | 'today' | 'yesterday' | 'week' | 'month' | 'all'

interface RankingUser {
  userId: string
  name: string | null
  email: string
  isAdmin: boolean
  isPremium: boolean
  totalSpentPoints: number
}

interface Props {
  timeRange: TimeRange
}

export default function PointsConsumeRanking({ timeRange }: Props) {
  const [ranking, setRanking] = useState<RankingUser[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const { data: session } = useSession()

  const fetchRanking = async (page: number = currentPage) => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/admin/points/consume-ranking?page=${page}&limit=100&timeRange=${timeRange}&t=${Date.now()}`
      )
      if (response.ok) {
        const data = await response.json()
        setRanking(data.ranking)
        setTotalPages(data.totalPages)
        setCurrentPage(data.currentPage)
      }
    } catch (error) {
      console.error('Failed to fetch consume ranking:', error)
    } finally {
      setLoading(false)
    }
  }

  // 首次加载 & 时间范围变化时刷新到第一页
  useEffect(() => {
    if (session?.user) {
      fetchRanking(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, timeRange])

  if (loading && ranking.length === 0) {
    return <div className="text-center py-8">加载中...</div>
  }

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="text-sm text-gray-600">
          当前时间范围：<span className="font-medium text-orange-600">{getTimeRangeLabel()}</span>
        </div>
        <button
          onClick={() => fetchRanking()}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>
      {ranking.length === 0 ? (
        <div className="p-8 text-center text-gray-500">该时间范围内暂无积分消耗记录</div>
      ) : (
        <>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  排名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  邮箱
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  积分消耗
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ranking.map((user, index) => (
                <tr key={user.userId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {(currentPage - 1) * 100 + index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.name || '未设置'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.isAdmin
                          ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white'
                          : user.isPremium
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {user.isAdmin ? '管理员' : user.isPremium ? '优质用户' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.totalSpentPoints}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
            <button
              onClick={() => fetchRanking(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-orange-500 text-white rounded disabled:bg-gray-300"
            >
              上一页
            </button>
            <span>
              第 {currentPage} 页 / 共 {totalPages} 页
            </span>
            <button
              onClick={() => fetchRanking(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 bg-orange-500 text-white rounded disabled:bg-gray-300"
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  )
}


