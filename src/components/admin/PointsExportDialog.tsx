'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import type {
  ExportFormData,
  ExportField,
  TimeRange,
  RecordType,
  UserRole,
} from '@/types/points'
import { FIELD_LABELS, DEFAULT_EXPORT_FIELDS } from '@/types/points'

export default function PointsExportDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedFields, setSelectedFields] = useState<ExportField[]>(DEFAULT_EXPORT_FIELDS)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ExportFormData>({
    defaultValues: {
      timeRange: 'today',
      startDate: '',
      endDate: '',
      fields: DEFAULT_EXPORT_FIELDS,
      userSearch: '',
      userRoles: [],
      recordType: 'all',
      descriptions: [],
      minPoints: undefined,
      maxPoints: undefined,
    },
  })

  const timeRange = watch('timeRange')
  const startDate = watch('startDate')
  const endDate = watch('endDate')

  // 所有可导出字段
  const allFields: ExportField[] = [
    'id',
    'userId',
    'userName',
    'userEmail',
    'userRole',
    'points',
    'type',
    'description',
    'earnedAt',
    'expiresAt',
    'createdAt',
  ]

  // 当时间范围改变时，自动设置日期
  useEffect(() => {
    if (timeRange === 'custom') return

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    switch (timeRange) {
      case 'today':
        setValue('startDate', today.toISOString().split('T')[0])
        setValue('endDate', today.toISOString().split('T')[0])
        break
      case 'yesterday': {
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        setValue('startDate', yesterday.toISOString().split('T')[0])
        setValue('endDate', yesterday.toISOString().split('T')[0])
        break
      }
      case 'week': {
        const weekAgo = new Date(today)
        weekAgo.setDate(weekAgo.getDate() - 7)
        setValue('startDate', weekAgo.toISOString().split('T')[0])
        setValue('endDate', today.toISOString().split('T')[0])
        break
      }
      case 'month': {
        const monthAgo = new Date(today)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        setValue('startDate', monthAgo.toISOString().split('T')[0])
        setValue('endDate', today.toISOString().split('T')[0])
        break
      }
      case 'all':
        setValue('startDate', '')
        setValue('endDate', '')
        break
    }
  }, [timeRange, setValue])

  // 当手动修改日期时，切换到自定义模式
  useEffect(() => {
    if (timeRange !== 'custom' && (startDate || endDate)) {
      // 检查日期是否与快捷选项匹配
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        .toISOString()
        .split('T')[0]

      const isToday = startDate === today && endDate === today
      if (!isToday) {
        setValue('timeRange', 'custom')
      }
    }
  }, [startDate, endDate])

  const toggleField = (field: ExportField) => {
    setSelectedFields((prev) => {
      if (prev.includes(field)) {
        return prev.filter((f) => f !== field)
      } else {
        return [...prev, field]
      }
    })
  }

  const selectAllFields = () => {
    setSelectedFields(allFields)
  }

  const deselectAllFields = () => {
    setSelectedFields([])
  }

  const resetToDefaultFields = () => {
    setSelectedFields(DEFAULT_EXPORT_FIELDS)
  }

  const onSubmit = async (data: ExportFormData) => {
    // 验证至少选择一个字段
    if (selectedFields.length === 0) {
      alert('请至少选择一个导出字段')
      return
    }

    // 验证日期范围
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate)
      const end = new Date(data.endDate)
      if (start > end) {
        alert('开始日期不能晚于结束日期')
        return
      }
    }

    setIsExporting(true)

    try {
      // 构建导出参数
      const exportParams: any = {
        fields: selectedFields,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        recordType: data.recordType,
        userSearch: data.userSearch?.trim() || undefined,
        minPoints: data.minPoints || undefined,
        maxPoints: data.maxPoints || undefined,
      }

      // 处理用户角色筛选
      const roleCheckboxes = document.querySelectorAll<HTMLInputElement>(
        'input[name^="userRole_"]'
      )
      const selectedRoles: UserRole[] = []
      roleCheckboxes.forEach((checkbox) => {
        if (checkbox.checked) {
          const role = checkbox.value as UserRole
          selectedRoles.push(role)
        }
      })
      if (selectedRoles.length > 0) {
        exportParams.userRoles = selectedRoles
      }

      // 处理描述筛选
      const descCheckboxes = document.querySelectorAll<HTMLInputElement>(
        'input[name^="description_"]'
      )
      const selectedDescriptions: string[] = []
      descCheckboxes.forEach((checkbox) => {
        if (checkbox.checked) {
          selectedDescriptions.push(checkbox.value)
        }
      })
      if (selectedDescriptions.length > 0) {
        exportParams.descriptions = selectedDescriptions
      }

      // 发送导出请求
      const response = await fetch('/api/admin/points/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(exportParams),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '导出失败')
      }

      // 下载文件
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `积分明细_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      // 成功提示
      alert('导出成功！')
      setIsOpen(false)
    } catch (error) {
      console.error('Export error:', error)
      alert(error instanceof Error ? error.message : '导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-sm font-medium flex items-center gap-2"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        导出
      </button>

      {/* 对话框 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* 头部 */}
            <div className="sticky top-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h2 className="text-xl font-bold">导出积分明细</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/90 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* 表单内容 */}
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
              {/* 时间范围选择 */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">时间范围</label>
                <div className="flex flex-wrap gap-2">
                  {(['today', 'yesterday', 'week', 'month', 'all', 'custom'] as TimeRange[]).map(
                    (range) => (
                      <label key={range} className="inline-flex items-center cursor-pointer">
                        <input
                          type="radio"
                          value={range}
                          {...register('timeRange')}
                          className="sr-only peer"
                        />
                        <span
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                            timeRange === range
                              ? 'bg-gradient-to-r from-orange-400 to-amber-400 text-white border-orange-400'
                              : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {range === 'today'
                            ? '今天'
                            : range === 'yesterday'
                            ? '昨天'
                            : range === 'week'
                            ? '最近一周'
                            : range === 'month'
                            ? '最近一月'
                            : range === 'all'
                            ? '全部'
                            : '自定义'}
                        </span>
                      </label>
                    )
                  )}
                </div>

                {/* 自定义日期范围 */}
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      开始日期
                    </label>
                    <input
                      type="date"
                      {...register('startDate')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      结束日期
                    </label>
                    <input
                      type="date"
                      {...register('endDate')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* 字段选择 */}
              <div className="space-y-3 border-t pt-6">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700">导出字段</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllFields}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={deselectAllFields}
                      className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100"
                    >
                      取消全选
                    </button>
                    <button
                      type="button"
                      onClick={resetToDefaultFields}
                      className="text-xs px-2 py-1 bg-orange-50 text-orange-600 rounded hover:bg-orange-100"
                    >
                      恢复默认
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {allFields.map((field) => (
                    <label
                      key={field}
                      className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field)}
                        onChange={() => toggleField(field)}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                      />
                      <span className="text-sm text-gray-700">{FIELD_LABELS[field]}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500">
                  已选择 {selectedFields.length} 个字段
                </p>
              </div>

              {/* 高级筛选 */}
              <div className="border-t pt-6">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  高级筛选（可选）
                </button>

                {showAdvanced && (
                  <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg">
                    {/* 用户搜索 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        用户搜索（姓名/邮箱）
                      </label>
                      <input
                        type="text"
                        {...register('userSearch')}
                        placeholder="输入用户名或邮箱关键词"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                      />
                    </div>

                    {/* 用户角色筛选 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        用户角色
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="userRole_admin"
                            value="admin"
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">管理员</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="userRole_premium"
                            value="premium"
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">会员</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="userRole_regular"
                            value="regular"
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">普通用户</span>
                        </label>
                      </div>
                    </div>

                    {/* 类型筛选 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        记录类型
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="all"
                            {...register('recordType')}
                            className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">全部</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="earned"
                            {...register('recordType')}
                            className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">仅获得</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            value="spent"
                            {...register('recordType')}
                            className="w-4 h-4 text-orange-500 border-gray-300 focus:ring-orange-400"
                          />
                          <span className="text-sm text-gray-700">仅消耗</span>
                        </label>
                      </div>
                    </div>

                    {/* 描述筛选 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        消耗类型
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {['每日签到', '图像生成', '视频生成', '工作流修复', '工作流放大'].map(
                          (desc) => (
                            <label key={desc} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                name={`description_${desc}`}
                                value={desc}
                                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400"
                              />
                              <span className="text-sm text-gray-700">{desc}</span>
                            </label>
                          )
                        )}
                      </div>
                    </div>

                    {/* 积分范围 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          最小积分数
                        </label>
                        <input
                          type="number"
                          {...register('minPoints', { valueAsNumber: true })}
                          placeholder="如：10"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          最大积分数
                        </label>
                        <input
                          type="number"
                          {...register('maxPoints', { valueAsNumber: true })}
                          placeholder="如：1000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 底部按钮 */}
              <div className="flex justify-end gap-3 border-t pt-6">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  disabled={isExporting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isExporting || selectedFields.length === 0}
                  className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isExporting ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      导出中...
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      确认导出
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
