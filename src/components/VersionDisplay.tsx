'use client'

import { useEffect, useRef } from 'react'

export default function VersionDisplay() {
  const hasLoggedRef = useRef(false)

  useEffect(() => {
    // 检测开发者工具是否打开
    const detectDevTools = () => {
      const threshold = 160
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        return true
      }
      return false
    }

    // 输出版本信息（只执行一次）
    const logVersionInfo = () => {
      if (hasLoggedRef.current) return
      
      hasLoggedRef.current = true
      const version = process.env.NEXT_PUBLIC_NEXT_PUBLIC_WEB_VERSION || '未知版本'
      console.log(
        `%c🚀 Dreamifly ${version}`,
        'color: #f97316; font-size: 16px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);'
      )
      console.log(
        `%c📝 网站版本: ${version}`,
        'color: #059669; font-size: 14px; font-weight: bold;'
      )
      console.log(
        `%c🔗 项目地址: https://github.com/LastLighter/Dreamifly`,
        'color: #3b82f6; font-size: 12px;'
      )
      console.log(
        `%c💡 提示: 欢迎开发者！如有问题请提交 Issue`,
        'color: #7c3aed; font-size: 12px; font-style: italic;'
      )
    }

    // 监听窗口大小变化
    const handleResize = () => {
      if (detectDevTools()) {
        logVersionInfo()
      }
    }

    // 初始检测
    if (detectDevTools()) {
      logVersionInfo()
    }

    // 监听窗口大小变化
    window.addEventListener('resize', handleResize)

    // 清理事件监听器
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return null // 不渲染任何内容
}
