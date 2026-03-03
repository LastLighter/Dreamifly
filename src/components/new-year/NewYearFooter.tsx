/**
 * NewYearFooter — 新年许愿机页面底部
 * 微拟物设计：渐变背景 + 三层阴影
 */
'use client'

import * as React from 'react'
import { Heart } from 'lucide-react'

export default function NewYearFooter() {
  return (
    <footer
      className="w-full rounded-[20px] px-6 py-4 text-center transition-all duration-200"
      style={{
        background: 'linear-gradient(135deg, var(--card) 0%, color-mix(in srgb, var(--card) 95%, var(--primary)) 100%)',
        boxShadow: '0 -2px 12px color-mix(in srgb, var(--primary) 10%, transparent), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.03)',
        color: 'var(--muted-foreground)',
      }}
    >
      <div className="flex items-center justify-center gap-1.5 text-xs">
        <span>Made with</span>
        <Heart className="w-3 h-3" style={{ color: 'var(--primary)' }} fill="var(--primary)" />
        <span>by Dreamifly</span>
      </div>
    </footer>
  )
}
