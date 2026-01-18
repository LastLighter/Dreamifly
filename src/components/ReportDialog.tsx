'use client'

import { useState } from 'react'

// 举报原因选项
const VIOLATION_OPTIONS = [
  { value: 'pornography', label: '色情内容' },
  { value: 'political', label: '政治敏感' },
  { value: 'violence', label: '暴力恐怖' },
  { value: 'gore', label: '血腥恶心' },
  { value: 'illegal', label: '违法违规' },
  { value: 'other', label: '其他' },
] as const

type ViolationReason = typeof VIOLATION_OPTIONS[number]['value']

interface ReportDialogProps {
  isOpen: boolean
  onClose: () => void
  imageId: string
}

export default function ReportDialog({ isOpen, onClose, imageId }: ReportDialogProps) {
  const [selectedReason, setSelectedReason] = useState<ViolationReason | ''>('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // 验证选择的原因
    if (!selectedReason) {
      setError('请选择举报原因')
      return
    }

    // 如果选择"其他"，必须填写描述
    if (selectedReason === 'other' && !description.trim()) {
      setError('选择"其他"时必须填写详细描述')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/community/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageId,
          reason: selectedReason,
          description: selectedReason === 'other' ? description.trim() : undefined,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('举报成功！请勿重复举报')
        // 2秒后自动关闭弹窗
        setTimeout(() => {
          onClose()
          // 重置表单状态
          setSelectedReason('')
          setDescription('')
          setSuccess('')
        }, 2000)
      } else {
        setError(data.error || '举报失败，请重试')
      }
    } catch (error) {
      console.error('举报请求失败:', error)
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          disabled={loading}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 标题 */}
        <h2 className="text-xl font-semibold text-gray-900 mb-6 pr-8">
          举报不当内容
        </h2>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 举报原因选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              举报原因 *
            </label>
            <div className="space-y-2">
              {VIOLATION_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center">
                  <input
                    type="radio"
                    name="reason"
                    value={option.value}
                    checked={selectedReason === option.value}
                    onChange={(e) => setSelectedReason(e.target.value as ViolationReason)}
                    className="text-orange-500 focus:ring-orange-500"
                    disabled={loading}
                  />
                  <span className="ml-2 text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 详细描述（仅在选择"其他"时显示） */}
          {selectedReason === 'other' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                详细描述 *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="请描述具体的原因..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                rows={3}
                disabled={loading}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">
                {description.length}/500
              </p>
            </div>
          )}

          {/* 错误消息 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 成功消息 */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">{success}</p>
            </div>
          )}

          {/* 提交按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading || !selectedReason || (selectedReason === 'other' && !description.trim())}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? '提交中...' : '确认举报'}
            </button>
          </div>
        </form>

        {/* 提示信息 */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          您的举报将帮助我们维护更好的社区环境
        </p>
      </div>
    </div>
  )
}