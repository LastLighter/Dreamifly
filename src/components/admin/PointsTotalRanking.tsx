'use client'

import { useState, useEffect } from 'react'
import { useSession } from '@/lib/auth-client'

interface RankingUser {
  userId: string
  name: string | null
  email: string
  isAdmin: boolean
  isPremium: boolean
  totalPoints: number
}

export default function PointsTotalRanking() {
  const [ranking, setRanking] = useState<RankingUser[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const { data: session } = useSession()

  const fetchRanking = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/points/total-ranking?page=${currentPage}&limit=100&t=${Date.now()}`)
      if (response.ok) {
        const data = await response.json()
        setRanking(data.ranking)
        setTotalPages(data.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch ranking:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) {
      fetchRanking()
    }
  }, [currentPage, session])

  if (loading) {
    return <div className="text-center py-8">加载中...</div>
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="flex justify-end p-4 border-b border-gray-200">
        <button
          onClick={fetchRanking}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-300"
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </button>
      </div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邮箱</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总积分</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {ranking.map((user, index) => (
            <tr key={user.userId}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(currentPage - 1) * 100 + index + 1}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.name || '未设置'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  user.isAdmin ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white' :
                  user.isPremium ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-200 text-gray-700'
                }`}>
                  {user.isAdmin ? '管理员' : user.isPremium ? '优质用户' : '普通用户'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-orange-500 text-white rounded disabled:bg-gray-300"
        >
          上一页
        </button>
        <span>第 {currentPage} 页 / 共 {totalPages} 页</span>
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-orange-500 text-white rounded disabled:bg-gray-300"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
