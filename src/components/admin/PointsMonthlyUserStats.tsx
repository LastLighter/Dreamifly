'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MonthlyUserStatsResponse } from '@/types/points'

function formatDateToYM(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatRatio(part: number, total: number): string {
  if (total === 0) return '0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

// 年月拆分
function splitYM(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

// 年月选择器组件
function MonthPicker({
  label,
  value,
  onChange,
  yearRange,
  minYM,
}: {
  label: string
  value: string
  onChange: (val: string) => void
  yearRange: number[]
  minYM?: string // 最小可选值 YYYY-MM，用于结束月份限制
}) {
  const { year, month } = splitYM(value)
  const { year: minYear, month: minMonth } = minYM ? splitYM(minYM) : { year: 0, month: 0 }

  const handleYearChange = (newYear: string) => {
    const ny = Number(newYear)
    // 若新年份等于最小年份且当前月份早于最小月份，自动修正月份
    const newMonth = minYM && ny === minYear && month < minMonth ? minMonth : month
    onChange(`${newYear}-${String(newMonth).padStart(2, '0')}`)
  }

  const handleMonthChange = (newMonth: string) => {
    onChange(`${year}-${String(newMonth).padStart(2, '0')}`)
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-2">
        <select
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm bg-white"
        >
          {yearRange.map((y) => (
            <option key={y} value={y} disabled={minYM ? y < minYear : false}>
              {y} 年
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent text-sm bg-white"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option
              key={m}
              value={m}
              disabled={minYM ? year === minYear && m < minMonth : false}
            >
              {m} 月
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default function PointsMonthlyUserStats() {
  const today = useMemo(() => new Date(), [])
  const defaultEndDate = useMemo(() => formatDateToYM(today), [today])
  const defaultStartDate = useMemo(() => formatDateToYM(today), [today])

  // 年份列表：2025 年到当前年
  const yearRange = useMemo(() => {
    const currentYear = today.getFullYear()
    const years: number[] = []
    for (let y = 2025; y <= currentYear; y++) years.push(y)
    return years
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

  useEffect(() => {
    fetchStats(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSearchClick = () => {
    fetchStats(1)
  }

  const handleExport = async () => {
    try {

      const body: Record<string, unknown> = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        userSearch: userSearch.trim() || undefined,
      }

      const response = await fetch('/api/admin/points/monthly-user-stats-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const roleLabel = (role: string) =>
    role === 'admin' ? '管理员' : role === 'premium' ? '会员' : '普通用户'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
      {/* 筛选区域 */}
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <MonthPicker
            label="开始月份"
            value={startDate}
            onChange={(val) => {
              setStartDate(val)
              // 开始月份晚于结束月份时，自动将结束月份同步
              if (val > endDate) setEndDate(val)
            }}
            yearRange={yearRange}
          />
          <MonthPicker
            label="结束月份"
            value={endDate}
            onChange={setEndDate}
            yearRange={yearRange}
            minYM={startDate}
          />
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
      ) : !data || data.rows.length === 0 ? (
        <div className="py-10 text-center text-gray-500 text-sm">
          当前筛选条件下没有积分消耗记录
        </div>
      ) : (
        <>
          {/* 汇总信息 */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
            <div>
              共{' '}
              <span className="font-semibold text-gray-900">{data.totalRows}</span>{' '}
              条记录，时间范围内总消耗{' '}
              <span className="font-semibold text-orange-600">{data.totalConsumedPoints}</span>{' '}
              积分
            </div>
            <div>
              第 <span className="font-semibold text-gray-900">{page}</span> /{' '}
              <span className="font-semibold text-gray-900">{totalPages}</span> 页
            </div>
          </div>

          {/* 表格 */}
          <div className="overflow-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-xs md:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    月份
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    用户名
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    邮箱
                  </th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    角色
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    总积分消耗
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    购买积分消耗
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    赠送积分消耗
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    其他积分消耗
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    购买积分占比
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    赠送积分占比
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700 border-b border-gray-200 whitespace-nowrap">
                    其他积分占比
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.rows.map((row, idx) => {
                  const total = row.totalConsumedPoints
                  return (
                    <tr key={`${row.userId}-${row.month}-${idx}`} className="hover:bg-orange-50/40">
                      <td className="px-3 py-2 text-gray-700 border-b border-gray-100 whitespace-nowrap font-medium">
                        {row.month}
                      </td>
                      <td className="px-3 py-2 text-gray-900 border-b border-gray-100 whitespace-nowrap">
                        {row.name || '(未设置昵称)'}
                      </td>
                      <td className="px-3 py-2 text-gray-600 border-b border-gray-100 whitespace-nowrap">
                        {row.email}
                      </td>
                      <td className="px-3 py-2 text-gray-700 border-b border-gray-100 whitespace-nowrap">
                        {roleLabel(row.role)}
                      </td>
                      <td className="px-3 py-2 text-right text-orange-600 font-semibold border-b border-gray-100 whitespace-nowrap">
                        {total}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-600 border-b border-gray-100 whitespace-nowrap">
                        {row.purchasedPoints}
                      </td>
                      <td className="px-3 py-2 text-right text-green-600 border-b border-gray-100 whitespace-nowrap">
                        {row.giftedPoints}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500 border-b border-gray-100 whitespace-nowrap">
                        {row.otherPoints}
                      </td>
                      <td className="px-3 py-2 text-right text-blue-500 border-b border-gray-100 whitespace-nowrap">
                        {formatRatio(row.purchasedPoints, total)}
                      </td>
                      <td className="px-3 py-2 text-right text-green-500 border-b border-gray-100 whitespace-nowrap">
                        {formatRatio(row.giftedPoints, total)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-400 border-b border-gray-100 whitespace-nowrap">
                        {formatRatio(row.otherPoints, total)}
                      </td>
                    </tr>
                  )
                })}
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
                第 <span className="font-semibold text-gray-900">{page}</span> /{' '}
                <span className="font-semibold text-gray-900">{totalPages}</span> 页
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
