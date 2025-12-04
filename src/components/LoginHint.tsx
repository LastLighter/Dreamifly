'use client'

import { useSession } from '@/lib/auth-client'

interface LoginHintProps {
  /**
   * 提示文本内容
   * @default "登录可减少排队时间，建议登录使用"
   */
  message?: string
  /**
   * 自定义样式类名
   */
  className?: string
  /**
   * 自定义提示图标
   */
  icon?: React.ReactNode
}

/**
 * 登录提示组件
 * 当用户未登录时显示提示信息，鼓励用户登录
 */
export default function LoginHint({
  message = '登录可减少排队时间，建议登录使用',
  className = '',
  icon
}: LoginHintProps) {
  const { data: session, isPending } = useSession()

  // 如果正在加载或已登录，不显示提示
  if (isPending || session?.user) {
    return null
  }

  const defaultIcon = (
    <svg
      className="w-4 h-4 text-amber-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )

  return (
    <div
      className={`flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap ${className}`}
    >
      {icon || defaultIcon}
      <span>{message}</span>
    </div>
  )
}

