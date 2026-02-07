'use client'

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const t = useTranslations('auth.terms')
  const [markdownContent, setMarkdownContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    // 加载统一的用户协议MD文档（不依赖语言）
    fetch('/terms.md')
      .then(res => {
        if (!res.ok) {
          throw new Error('加载用户协议失败')
        }
        return res.text()
      })
      .then(content => {
        setMarkdownContent(content)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('加载用户协议失败:', err)
        setError('加载用户协议失败，请稍后重试')
        setIsLoading(false)
      })
  }, [])

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose max-w-none">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-600">加载中...</div>
              </div>
            )}
            
            {error && (
              <div className="text-red-600 text-center py-12">
                {error}
              </div>
            )}

            {!isLoading && !error && markdownContent && (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => (
                    <h1 className="text-2xl font-bold text-gray-900 mb-4" {...props} />
                  ),
                  h2: ({ node, ...props }) => (
                    <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-6" {...props} />
                  ),
                  h3: ({ node, ...props }) => (
                    <h3 className="text-lg font-semibold text-gray-800 mb-2 mt-4" {...props} />
                  ),
                  h4: ({ node, ...props }) => (
                    <h4 className="text-base font-semibold text-gray-800 mb-2 mt-3" {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p className="text-gray-700 text-sm leading-6 mb-3" {...props} />
                  ),
                  ul: ({ node, ...props }) => (
                    <ul className="list-disc list-inside space-y-2 mb-3 text-gray-700 text-sm" {...props} />
                  ),
                  ol: ({ node, ...props }) => (
                    <ol className="list-decimal list-inside space-y-2 mb-3 text-gray-700 text-sm" {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li className="leading-6" {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong className="font-semibold text-gray-900" {...props} />
                  ),
                  hr: ({ node, ...props }) => (
                    <hr className="my-6 border-gray-300" {...props} />
                  ),
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4" {...props} />
                  ),
                  code: ({ node, ...props }) => (
                    <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...props} />
                  ),
                  a: ({ node, ...props }) => (
                    <a className="text-orange-500 hover:text-orange-600 underline" {...props} />
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}




