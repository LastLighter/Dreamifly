/**
 * Button 组件 — 微拟物设计风格
 * 渐变背景 + 三层阴影 + 微交互
 */
'use client'

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/* ========================================
   按钮样式配置 - 渐变 + 立体效果
   ======================================== */
const BUTTON_STYLES: Record<string, {
  background: string
  boxShadow: string
  hoverBoxShadow: string
}> = {
  default: {
    background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 85%, black) 50%, color-mix(in srgb, var(--primary) 70%, black) 100%)',
    boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
    hoverBoxShadow: '0 6px 20px color-mix(in srgb, var(--primary) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)',
  },
  primary: {
    background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 85%, black) 50%, color-mix(in srgb, var(--primary) 70%, black) 100%)',
    boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
    hoverBoxShadow: '0 6px 20px color-mix(in srgb, var(--primary) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)',
  },
  destructive: {
    background: 'linear-gradient(135deg, var(--destructive) 0%, color-mix(in srgb, var(--destructive) 85%, black) 50%, color-mix(in srgb, var(--destructive) 70%, black) 100%)',
    boxShadow: '0 4px 12px color-mix(in srgb, var(--destructive) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
    hoverBoxShadow: '0 6px 20px color-mix(in srgb, var(--destructive) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)',
  },
  accent: {
    background: 'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 85%, black) 50%, color-mix(in srgb, var(--accent) 70%, black) 100%)',
    boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -1px 0 rgba(0,0,0,0.1)',
    hoverBoxShadow: '0 6px 20px color-mix(in srgb, var(--accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15)',
  },
  secondary: {
    background: 'linear-gradient(135deg, var(--secondary) 0%, color-mix(in srgb, var(--secondary) 90%, black) 50%, color-mix(in srgb, var(--secondary) 80%, black) 100%)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1), inset 0 -1px 0 rgba(0,0,0,0.05)',
    hoverBoxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08)',
  },
  outline: {
    background: 'transparent',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
    hoverBoxShadow: '0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.08)',
  },
  ghost: {
    background: 'transparent',
    boxShadow: 'none',
    hoverBoxShadow: 'none',
  },
  link: {
    background: 'transparent',
    boxShadow: 'none',
    hoverBoxShadow: 'none',
  },
}

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "whitespace-nowrap text-sm font-medium",
    "rounded-2xl",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
    "active:scale-[0.97] hover:scale-[1.02]",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "text-[var(--primary-foreground)]",
        primary: "text-[var(--primary-foreground)]",
        destructive: "text-[var(--destructive-foreground)]",
        accent: "text-[var(--accent-foreground)]",
        secondary: "text-[var(--secondary-foreground)]",
        outline: "border-2 border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        ghost: "text-[var(--foreground)] hover:bg-[var(--muted)]",
        link: "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-4 text-xs rounded-xl",
        default: "h-9 px-5 py-2 rounded-2xl",
        md: "h-10 px-6 py-2.5 rounded-2xl",
        lg: "h-12 px-10 rounded-2xl",
        xl: "h-14 px-12 py-4 text-lg rounded-3xl",
        icon: "h-10 w-10 rounded-2xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  isLoading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  style,
  ...props
}, ref) => {
  const Comp = asChild ? Slot : "button"
  const [isHovered, setIsHovered] = React.useState(false)

  const variantKey = variant || "default"
  const styleConfig = BUTTON_STYLES[variantKey] || BUTTON_STYLES.default
  const needsCustomStyle = !['ghost', 'link'].includes(variantKey)

  const combinedStyle: React.CSSProperties = needsCustomStyle ? {
    background: styleConfig.background,
    boxShadow: isHovered ? styleConfig.hoverBoxShadow : styleConfig.boxShadow,
    ...style,
  } : { ...style }

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      disabled={isLoading || props.disabled}
      style={combinedStyle}
      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { setIsHovered(true); props.onMouseEnter?.(e) }}
      onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { setIsHovered(false); props.onMouseLeave?.(e) }}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </Comp>
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
