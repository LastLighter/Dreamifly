'use client'

import { useEffect, useRef, useState } from 'react'

const frontendVersion =
  process.env.NEXT_PUBLIC_WEB_VERSION ||
  process.env.NEXT_PUBLIC_NEXT_PUBLIC_WEB_VERSION ||
  '未知版本'

interface VersionInfo {
  currentVersion: string
  latestVersion: string
}

export default function VersionDisplay() {
  const hasLoggedRef = useRef(false)
  const [versionMismatch, setVersionMismatch] = useState<VersionInfo | null>(null)

  useEffect(() => {
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

    const logVersionInfo = () => {
      if (hasLoggedRef.current) return

      hasLoggedRef.current = true
      console.log(
        `%c🚀 Dreamifly ${frontendVersion}`,
        'color: #f97316; font-size: 16px; font-weight: bold; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);'
      )
      console.log(
        `%c📝 网站版本: ${frontendVersion}`,
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

    const handleResize = () => {
      if (detectDevTools()) {
        logVersionInfo()
      }
    }

    if (detectDevTools()) {
      logVersionInfo()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const fetchBackendVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const backendVersion = data.backendVersion || 'unknown'
        if (backendVersion && backendVersion !== frontendVersion) {
          setVersionMismatch({
            currentVersion: frontendVersion,
            latestVersion: backendVersion,
          })
        }
      } catch (error) {
        console.error('Failed to fetch backend version:', error)
      }
    }

    fetchBackendVersion()
  }, [])

  return versionMismatch ? (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full">
          <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 text-center mb-4">版本更新提醒</h3>
        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100 space-y-2 text-sm text-gray-700">
          <p>
            当前版本：<span className="font-semibold text-gray-900">{versionMismatch.currentVersion}</span>
          </p>
          <p>
            最新版本：<span className="font-semibold text-orange-600">{versionMismatch.latestVersion}</span>
          </p>
        </div>
        <p className="text-gray-600 text-sm text-center mb-6">
          可尝试刷新页面或清空浏览器缓存以更新至最新版本。
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all"
          >
            刷新页面
          </button>
          <button
            onClick={() => setVersionMismatch(null)}
            className="flex-1 px-4 py-2.5 border border-orange-200 text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-all"
          >
            稍后处理
          </button>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4">如多次刷新无效，请尝试清空缓存并重新打开页面。</p>
      </div>
    </div>
  ) : null
}
