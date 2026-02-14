/**
 * Card 组件 — 微拟物设计风格
 * 三层阴影 + 大圆角 + 微交互
 */
'use client'

import * as React from "react"
import { cn } from "@/lib/utils"

/* ========================================
   卡片阴影样式配置
   ======================================== */
const CARD_STYLES = {
  default: {
    boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 15%, transparent), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.03)',
    hoverBoxShadow: '0 8px 24px color-mix(in srgb, var(--primary) 22%, transparent), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.05)',
  },
  elevated: {
    boxShadow: '0 6px 20px color-mix(in srgb, var(--primary) 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.05)',
    hoverBoxShadow: '0 10px 32px color-mix(in srgb, var(--primary) 28%, transparent), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(0,0,0,0.08)',
  },
  flat: {
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)',
    hoverBoxShadow: '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
  },
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'flat'
  interactive?: boolean
  noPadding?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  className,
  variant = 'default',
  interactive = false,
  noPadding = false,
  style,
  children,
  ...props
}, ref) => {
  const [isHovered, setIsHovered] = React.useState(false)
  const styleConfig = CARD_STYLES[variant]

  const combinedStyle: React.CSSProperties = {
    background: 'var(--card)',
    color: 'var(--card-foreground)',
    boxShadow: (interactive && isHovered) ? styleConfig.hoverBoxShadow : styleConfig.boxShadow,
    ...style,
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[20px] border border-[var(--border)]",
        "transition-all duration-200",
        !noPadding && "p-6",
        interactive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
      style={combinedStyle}
      onMouseEnter={(e) => { setIsHovered(true); props.onMouseEnter?.(e) }}
      onMouseLeave={(e) => { setIsHovered(false); props.onMouseLeave?.(e) }}
      {...props}
    >
      {children}
    </div>
  )
})
Card.displayName = "Card"

/* CardHeader */
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 pb-4", className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

/* CardTitle */
const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-xl font-bold leading-none tracking-tight", className)}
      style={{ color: 'var(--card-foreground)' }}
      {...props}
    />
  )
)
CardTitle.displayName = "CardTitle"

/* CardDescription */
const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p
      ref={ref}
      className={cn("text-sm", className)}
      style={{ color: 'var(--muted-foreground)' }}
      {...props}
    />
  )
)
CardDescription.displayName = "CardDescription"

/* CardContent */
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

/* CardFooter */
const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center pt-4", className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
