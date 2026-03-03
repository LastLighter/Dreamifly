/**
 * NewYearHeader — 新年许愿机页面顶部导航
 * 微拟物设计：渐变背景 + 三层阴影
 */
'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Sparkles, Palette } from 'lucide-react'
import { transferUrl } from '@/utils/locale'

interface NewYearHeaderProps {
  onShowDesignSystem?: () => void
}

export default function NewYearHeader({ onShowDesignSystem }: NewYearHeaderProps) {
  const { locale } = useParams()

  return (
    <header
      className="w-full rounded-[20px] px-5 py-3 flex items-center justify-between transition-all duration-200"
      style={{
        background: 'linear-gradient(135deg, var(--card) 0%, color-mix(in srgb, var(--card) 95%, var(--primary)) 100%)',
        boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 15%, transparent), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.03)',
        color: 'var(--foreground)',
      }}
    >
      {/* 左侧品牌 */}
      <Link
        href={transferUrl('/', locale)}
        className="flex items-center gap-2 group transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)',
            boxShadow: '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
          }}
        >
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-base font-bold" style={{ color: 'var(--foreground)' }}>
          Dreamifly
        </span>
      </Link>

      {/* 右侧操作 */}
      <div className="flex items-center gap-2">
        {onShowDesignSystem && (
          <button
            onClick={onShowDesignSystem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 80%, black) 100%)',
              color: 'var(--accent-foreground)',
              boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
            }}
          >
            <Palette className="w-3.5 h-3.5" />
            Design System
          </button>
        )}
        <Link
          href={transferUrl('/new-year-wish', locale)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 80%, black) 100%)',
            color: 'var(--primary-foreground)',
            boxShadow: '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
          }}
        >
          <Sparkles className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  )
}
