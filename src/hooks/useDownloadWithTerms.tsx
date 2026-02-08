'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSession } from '@/lib/auth-client'
import { useTranslations } from 'next-intl'
import DownloadTermsModal from '@/components/DownloadTermsModal'

interface UseDownloadWithTermsReturn {
  checkAndDownload: (downloadFn: () => void | Promise<void>) => Promise<void>
  isModalOpen: boolean
  isLoading: boolean
  closeModal: () => void
  DownloadTermsModalWrapper: () => React.ReactElement | null
}

export function useDownloadWithTerms(): UseDownloadWithTermsReturn {
  const { data: session, isPending } = useSession()
  const t = useTranslations('downloadTerms.toast')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const pendingDownloadRef = useRef<(() => void | Promise<void>) | null>(null)

  const closeModal = useCallback(() => {
    if (!isLoading) {
      setIsModalOpen(false)
      setAgreed(false)
      pendingDownloadRef.current = null
    }
  }, [isLoading])

  const handleAgree = useCallback(async () => {
    try {
      setIsLoading(true)

      // 调用 API 更新用户协议状态
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acceptedDownloadTerms: true,
        }),
      })

      if (!response.ok) {
        throw new Error('更新协议状态失败')
      }

      // 关闭弹窗
      setIsModalOpen(false)

      // 执行下载函数
      if (pendingDownloadRef.current) {
        await pendingDownloadRef.current()
        pendingDownloadRef.current = null
      }
    } catch (error) {
      console.error('同意协议失败:', error)
      alert(t('failed'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  const checkAndDownload = useCallback(async (downloadFn: () => void | Promise<void>) => {
    // 如果 session 还在加载中，等待
    if (isPending) {
      return
    }

    // 未登录用户直接下载，不显示协议弹窗
    if (!session?.user) {
      await downloadFn()
      return
    }

    // 已登录用户：仅依赖 API 查数据库，不依赖 session 中的字段
    try {
      const res = await fetch('/api/user/download-terms-status', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.acceptedDownloadTerms === true) {
          await downloadFn()
          return
        }
      }
    } catch (_) {
      // 接口失败则按未同意处理，弹窗让用户确认
    }

    // 未同意或接口未返回已同意，显示协议弹窗
    pendingDownloadRef.current = downloadFn
    setAgreed(false)
    setIsModalOpen(true)
  }, [session?.user, isPending])

  // 使用 Portal 将弹窗挂载到 body，避免受父容器 overflow/transform 影响，实现全界面覆盖
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const DownloadTermsModalWrapper = useCallback(() => {
    if (!mounted || typeof document === 'undefined') return null
    return createPortal(
      <DownloadTermsModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onAgree={handleAgree}
        isLoading={isLoading}
        agreed={agreed}
        onAgreedChange={setAgreed}
      />,
      document.body
    )
  }, [mounted, isModalOpen, closeModal, handleAgree, isLoading, agreed])

  return {
    checkAndDownload,
    isModalOpen,
    isLoading,
    closeModal,
    DownloadTermsModalWrapper,
  }
}
