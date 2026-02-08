'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DownloadTermsModalProps {
  isOpen: boolean
  onClose: () => void
  onAgree: () => Promise<void>
  isLoading?: boolean
  agreed: boolean
  onAgreedChange: (value: boolean) => void
}

type ViewMode = 'confirm' | 'full'

export default function DownloadTermsModal({ isOpen, onClose, onAgree, isLoading = false, agreed, onAgreedChange }: DownloadTermsModalProps) {
  const t = useTranslations('downloadTerms.modal')
  const [viewMode, setViewMode] = useState<ViewMode>('confirm')
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // 打开弹窗时重置为确认视图（agreed 由父级在打开时重置）
  useEffect(() => {
    if (isOpen) {
      setViewMode('confirm')
      setError('')
    }
  }, [isOpen])

  // 仅在进入完整协议视图时加载 markdown
  useEffect(() => {
    if (isOpen && viewMode === 'full') {
      setIsLoadingContent(true)
      setError('')
      fetch('/download-terms.md')
        .then(res => {
          if (!res.ok) throw new Error('加载协议失败')
          return res.text()
        })
        .then(content => {
          setMarkdownContent(content)
          setIsLoadingContent(false)
        })
        .catch(err => {
          console.error('加载下载协议失败:', err)
          setError('加载协议失败，请稍后重试')
          setIsLoadingContent(false)
        })
    }
  }, [isOpen, viewMode])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isLoading && viewMode === 'confirm') {
      onClose()
    }
  }

  const handleAgree = async () => {
    if (!agreed || isLoading) return
    await onAgree()
  }

  // 确认视图：勾选 + 链接，与注册协议一致
  const renderConfirmView = () => (
    <>
      <div className="p-6">
        <div className="flex items-start gap-2">
          <input
            id="agreeDownloadTerms"
            type="checkbox"
            checked={agreed}
            onChange={e => onAgreedChange(e.target.checked)}
            disabled={isLoading}
            className="mt-1 w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-400 disabled:opacity-50"
          />
          <label htmlFor="agreeDownloadTerms" className="text-sm text-gray-700 flex-1 cursor-pointer">
            {t('agreeLabel')}{' '}
            <button
              type="button"
              onClick={() => setViewMode('full')}
              className="text-orange-500 hover:text-orange-600 underline inline"
            >
              {t('linkText')}
            </button>
          </label>
        </div>
      </div>
      <div className="border-t border-gray-200 p-6">
        <div className="flex gap-4">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleAgree}
            disabled={!agreed || isLoading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('agreeing') : t('agree')}
          </button>
        </div>
      </div>
    </>
  )

  // 完整协议视图：仅点击链接后展示
  const renderFullView = () => (
    <>
      <div className="flex-1 overflow-y-auto p-6">
        <div className="prose max-w-none">
          {isLoadingContent && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600">{t('loading')}</div>
            </div>
          )}
          {error && (
            <div className="text-red-600 text-center py-12">{error}</div>
          )}
          {!isLoadingContent && !error && markdownContent && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => <h1 className="text-2xl font-bold text-gray-900 mb-4" {...props} />,
                h2: (props) => <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-6" {...props} />,
                h3: (props) => <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4" {...props} />,
                h4: (props) => <h4 className="text-base font-semibold text-gray-800 mb-2 mt-3" {...props} />,
                p: (props) => <p className="text-gray-700 text-sm leading-6 mb-3" {...props} />,
                ul: (props) => <ul className="list-disc list-inside space-y-2 mb-3 text-gray-700 text-sm" {...props} />,
                ol: (props) => <ol className="list-decimal list-inside space-y-2 mb-3 text-gray-700 text-sm" {...props} />,
                li: (props) => <li className="leading-6" {...props} />,
                strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
                hr: (props) => <hr className="my-6 border-gray-300" {...props} />,
                blockquote: (props) => <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4" {...props} />,
                code: (props) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} />,
                a: (props) => <a className="text-orange-500 hover:text-orange-600 underline" {...props} />,
              }}
            >
              {markdownContent}
            </ReactMarkdown>
          )}
        </div>
      </div>
      <div className="border-t border-gray-200 p-6">
        <div className="flex gap-4">
          <button
            onClick={() => setViewMode('confirm')}
            className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-all"
          >
            {t('back')}
          </button>
          <button
            onClick={() => {
              onAgreedChange(true)
              setViewMode('confirm')
            }}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
          >
            {t('agreeShort')}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        style={{ maxWidth: viewMode === 'full' ? '56rem' : '28rem' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          {viewMode === 'confirm' ? (
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setViewMode('confirm')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
        </div>

        {viewMode === 'confirm' ? renderConfirmView() : renderFullView()}
      </div>
    </div>
  )
}
