/**
 * DesignSystemShowcase — 设计系统组件展示面板
 * 展示所有微拟物设计系统组件
 */
'use client'

import * as React from 'react'
import { X, Download, Upload, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card'

interface DesignSystemShowcaseProps {
  onClose: () => void
}

export default function DesignSystemShowcase({ onClose }: DesignSystemShowcaseProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* 内容面板 */}
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-[24px] p-6 sm:p-8"
        style={{
          background: 'var(--background)',
          boxShadow: '0 16px 48px color-mix(in srgb, var(--primary) 25%, transparent), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 0 rgba(0,0,0,0.05)',
        }}
      >
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-[1.1] active:scale-[0.9]"
          style={{
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          <X className="w-4 h-4" />
        </button>

        <h2
          className="text-2xl font-bold mb-6"
          style={{ color: 'var(--foreground)' }}
        >
          Design System
        </h2>

        {/* Button 展示 */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            Buttons
          </h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Default</Button>
            <Button variant="primary">Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <Button size="xl">Extra Large</Button>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <Button isLoading>Loading</Button>
            <Button leftIcon={<Upload className="w-4 h-4" />}>Upload</Button>
            <Button variant="accent" leftIcon={<Download className="w-4 h-4" />}>Download</Button>
            <Button variant="outline" leftIcon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>
          </div>
        </section>

        {/* Card 展示 */}
        <section className="mb-8">
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            Cards
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card variant="default" interactive>
              <CardHeader>
                <CardTitle>Default</CardTitle>
                <CardDescription>Standard card</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  三层阴影结构
                </p>
              </CardContent>
            </Card>

            <Card variant="elevated" interactive>
              <CardHeader>
                <CardTitle>Elevated</CardTitle>
                <CardDescription>Higher elevation</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  更强的立体感
                </p>
              </CardContent>
            </Card>

            <Card variant="flat" interactive>
              <CardHeader>
                <CardTitle>Flat</CardTitle>
                <CardDescription>Subtle shadow</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  轻量阴影
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 颜色展示 */}
        <section>
          <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            Colors
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
            {[
              { name: 'Primary', var: '--primary', fg: '--primary-foreground' },
              { name: 'Secondary', var: '--secondary', fg: '--secondary-foreground' },
              { name: 'Accent', var: '--accent', fg: '--accent-foreground' },
              { name: 'Destructive', var: '--destructive', fg: '--destructive-foreground' },
              { name: 'Muted', var: '--muted', fg: '--muted-foreground' },
              { name: 'Background', var: '--background', fg: '--foreground' },
            ].map((color) => (
              <div key={color.name} className="text-center">
                <div
                  className="w-full aspect-square rounded-2xl mb-1.5 transition-all duration-200 hover:scale-[1.05]"
                  style={{
                    background: `var(${color.var})`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                />
                <span className="text-[10px] font-medium" style={{ color: 'var(--muted-foreground)' }}>
                  {color.name}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
