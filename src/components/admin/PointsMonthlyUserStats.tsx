'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MonthlyUserStatsResponse } from '@/types/points'

// 日期格式化为 YYYY-MM-DD
function formatDateToYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function PointsMonthlyUserStats() {
  const today = useMemo(() => new Date(), [])
  const defaultEndDate = useMemo(() => formatDateToYMD(today), [today])
  const defaultStartDate = useMemo(() => {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    return formatDateToYMD(firstDay)
  }, [today])

  const [startDate, setStartDate] = useState<string>(defaultStartDate)
  const [endDate, setEndDate] = useState<string>(defaultEndDate)
  const [userSearch, setUserSearch] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const [limit] = useState<number>(50)

  const [data, setData] = useState<MonthlyUserStatsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const totalPages = data?.totalPages ?? 0

  const fetchStats = async (targetPage = 1) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (startDate) params.set('startDate', startDate)
      if (endDate) params.set('endDate', endDate)
      if (userSearch.trim()) params.set('userSearch', userSearch.trim())
      params.set('page', String(targetPage))
      params.set('limit', String(limit))
      params.set('t', String(Date.now()))

      const response = await fetch(`/api/admin/points/monthly-user-stats?${params.toString()}`)
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error(err?.error || '加载月度统计数据失败')
      }

      const json: MonthlyUserStatsResponse = await response.json()
      setData(json)
      setPage(json.page)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '加载月度统计数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 初次加载：本月数据
  useEffect(() => {
    fetchStats(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchClick = () => {
    // 简单校验日期
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (start > end) {
        alert('开始日期不能晚于结束日期')
        return
      }
    }
    fetchStats(1)
  }

  const handleExport = async () => {
    try {
      // 简单校验
      if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        if (start > end) {
          alert('开始日期不能晚于结束日期')
          return
        }
      }

      const body: any = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userSearch: userSearch.trim() || undefined,
      }

      const response = await fetch('/api/admin/points/monthly-user-stats-export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        let message = '导出失败'
        try {
          const err = await response.json()
          message = err?.error || message
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `用户月度积分消耗_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export monthly stats error:', e)
      alert(e instanceof Error ? e.message : '导出失败，请重试')
    }
  }

  const months = data?.months ?? []

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
      {/* 筛选区域 */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              开始日期
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              结束日期
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              用户搜索（姓名 / 邮箱）
            </label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="输入用户名或邮箱关键词"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSearchClick}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-medium shadow-sm hover:from-orange-600 hover:to-amber-600 transition-colors"
          >
            查询
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-medium shadow-sm hover:from-green-600 hover:to-emerald-600 transition-colors"
          >
            导出 CSV
          </button>
        </div>
      </div>

      {/* 状态 & 表格 */}
      {loading ? (
        <div className="py-10 text-center text-gray-500 text-sm">加载中...</div>
      ) : error ? (
        <div className="py-10 text-center text-red-500 text-sm">{error}</div>
      ) : !data || data.users.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">
          当前筛选条件下没有积分消耗记录
        </div>
      ) : (
        <>
          {/* 汇总信息 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              共{' '}
              <span className="font-semibold text-gray-900">
                {data.totalUsers}
              </span>{' '}
              位用户，时间范围内总消耗{' '}
              <span className="font-semibold text-orange-600">
                {data.totalConsumedPoints}
              </span>{' '}
              积分
            </div>
            <div>
              第{' '}
              <span className="font-semibold text-gray-900">
                {page}
              </span>{' '}
              /{' '}
              <span className="font-semibold text-gray-900">
                {totalPages}
              </span>{' '}
              页
            </div>
          </div>

          {/* 表格 */}
          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    用户名
                  </th>
                  <th className="sticky left-[8rem] z-10 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    邮箱
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    角色
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    总消耗积分
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    总消耗次数
                  </th>
                  {months.map((m) => (
                    <th
                      key={m}
                      className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap"
                    >
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.users.map((u) => (
                  <tr key={u.userId} className="hover:bg-orange-50/40">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 text-gray-900 border-b border-gray-100 whitespace-nowrap">
                      {u.name || '(未设置昵称)'}
                    </td>
                    <td className="sticky left-[8rem] z-10 bg-white px-3 py-2 text-gray-700 border-b border-gray-100 whitespace-nowrap">
                      {u.email}
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-b border-gray-100 whitespace-nowrap">
                      {u.role === 'admin'
                        ? '管理员'
                        : u.role === 'premium'
                        ? '会员'
                        : '普通用户'}
                    </td>
                    <td className="px-3 py-2 text-right text-orange-600 font-semibold border-b border-gray-100 whitespace-nowrap">
                      {u.totalConsumedPoints}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 border-b border-gray-100 whitespace-nowrap">
                      {u.totalConsumedCount}
                    </td>
                    {months.map((m) => (
                      <td
                        key={m}
                        className="px-3 py-2 text-right text-gray-700 border-b border-gray-100 whitespace-nowrap"
                      >
                        {u.monthlyPoints[m] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 text-xs text-gray-600">
              <button
                type="button"
                onClick={() => page > 1 && fetchStats(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <span>
                第{' '}
                <span className="font-semibold text-gray-900">
                  {page}
                </span>{' '}
                /{' '}
                <span className="font-semibold text-gray-900">
                  {totalPages}
                </span>{' '}
                页
              </span>
              <button
                type="button"
                onClick={() => totalPages && page < totalPages && fetchStats(page + 1)}
                disabled={!totalPages || page >= totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

