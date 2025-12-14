'use client'

import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'error' | 'warning' | 'success' | 'info'
  duration?: number
  onClose?: () => void
}

export default function Toast({ message, type = 'error', duration = 4000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        onClose?.()
      }, 300) // 等待动画完成
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const typeStyles = {
    error: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: 'text-red-500',
      iconBg: 'bg-red-100'
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-300',
      text: 'text-orange-800',
      icon: 'text-orange-500',
      iconBg: 'bg-orange-100'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800',
      icon: 'text-green-500',
      iconBg: 'bg-green-100'
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      text: 'text-blue-800',
      icon: 'text-blue-500',
      iconBg: 'bg-blue-100'
    }
  }

  const styles = typeStyles[type]

  return (
    <div
      className={`fixed top-4 right-4 z-[10000] transition-all duration-300 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div
        className={`${styles.bg} ${styles.border} border rounded-xl shadow-lg p-4 min-w-[320px] max-w-[480px] flex items-start gap-3 backdrop-blur-sm`}
      >
        {/* 图标 */}
        <div className={`${styles.iconBg} rounded-full p-2 flex-shrink-0`}>
          {type === 'error' && (
            <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {type === 'warning' && (
            <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {type === 'success' && (
            <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {type === 'info' && (
            <svg className={`w-5 h-5 ${styles.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>

        {/* 消息内容 */}
        <div className="flex-1 min-w-0">
          <p className={`${styles.text} text-sm font-medium leading-relaxed break-words`}>
            {message}
          </p>
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => {
              onClose?.()
            }, 300)
          }}
          className={`${styles.text} opacity-60 hover:opacity-100 transition-opacity flex-shrink-0 ml-2`}
          aria-label="关闭"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

