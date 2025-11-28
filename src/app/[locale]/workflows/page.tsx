'use client'

import { useRef, useState, useEffect } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'
import { usePoints } from '@/contexts/PointsContext'

type TabKey = 'repair' | 'upscale'

export default function WorkflowsPage() {
  const { refreshPoints } = usePoints()
  const [activeTab, setActiveTab] = useState<TabKey>('repair')
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [zoomedImage, setZoomedImage] = useState<{ original: string; repaired: string } | null>(null)
  const [isShowingOriginal, setIsShowingOriginal] = useState(false)
  const [repairTime, setRepairTime] = useState<number | null>(null)
  const [repairCost, setRepairCost] = useState<number>(1) // 工作流修复消耗积分
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 获取工作流修复消耗积分配置
  useEffect(() => {
    const fetchRepairCost = async () => {
      try {
        const response = await fetch('/api/points/repair-cost')
        if (response.ok) {
          const data = await response.json()
          setRepairCost(data.repairWorkflowCost || 1)
        }
      } catch (error) {
        console.error('Failed to fetch repair cost:', error)
      }
    }
    fetchRepairCost()
  }, [])

  const resetState = () => {
    setUploadedImage(null)
    setPreviewUrl(null)
    setResultImage(null)
    setError(null)
    setUploadError(null)
    setRepairTime(null)
  }

  const processFile = (file: File) => {
    setUploadError(null)
    setError(null)
    setResultImage(null)

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      setUploadError('仅支持 PNG、JPG、JPEG 格式的图片')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('图片大小不能超过 10MB')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result
      if (typeof result === 'string') {
        // 创建图片对象以获取尺寸
        const img = new Image()
        img.onload = () => {
          const width = img.width
          const height = img.height
          
          // 验证图片尺寸：宽高需小于 2000 像素
          if (width > 2000 || height > 2000) {
            setUploadError('图片宽高需小于 2000 像素')
            return
          }
          
          // 尺寸验证通过，设置图片
          setPreviewUrl(result)
          const base64 = result.split(',')[1]
          setUploadedImage(base64)
        }
        img.onerror = () => {
          setUploadError('读取图片失败，请重试')
        }
        img.src = result
      }
    }
    reader.onerror = () => {
      setUploadError('读取图片失败，请重试')
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processFile(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer.files?.[0]) {
      processFile(event.dataTransfer.files[0])
    }
  }

  const handleRepair = async () => {
    if (!uploadedImage) {
      setUploadError('请先上传需要修复的图片')
      return
    }

    setIsProcessing(true)
    setError(null)
    setRepairTime(null)

    const startTime = Date.now()

    try {
      // 获取动态 token
      const token = await generateDynamicTokenWithServerTime()
      
      const response = await fetch('/api/workflows/repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ image: uploadedImage }),
        cache: 'no-store'
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || '修复失败，请稍后重试')
      }

      const data = await response.json()
      const endTime = Date.now()
      const elapsedTime = ((endTime - startTime) / 1000).toFixed(2) // 转换为秒，保留2位小数
      
      setResultImage(data.imageUrl)
      setRepairTime(parseFloat(elapsedTime))
      
      // 如果API返回了新的积分余额，更新前端积分显示
      if (data.pointsBalance !== undefined && data.pointsBalance !== null) {
        await refreshPoints()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '修复失败，请稍后重试')
      setRepairTime(null)
    } finally {
      setIsProcessing(false)
    }
  }

  const renderRepairTab = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-orange-200/40 p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">图像修复</h2>
        <p className="text-sm text-gray-500 mt-1">
          基于 Supir Repair 工作流对图片进行智能修复，自动消除划痕、噪点等瑕疵并提升整体画质。
        </p>
      </div>

      <div
        className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          previewUrl ? 'border-orange-400/60 bg-orange-50/30' : 'border-orange-200/70 hover:bg-orange-50/30'
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".png,.jpg,.jpeg,image/png,image/jpeg"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        {previewUrl ? (
          <div className="w-full space-y-4">
            <div className="relative w-full max-w-xl mx-auto aspect-video rounded-xl overflow-hidden shadow-lg border border-orange-200/60 bg-white">
              <img
                src={previewUrl}
                alt="待修复图片预览"
                className="object-contain w-full h-full"
              />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                disabled={isProcessing}
              >
                更换图片
              </button>
              <button
                type="button"
                onClick={resetState}
                className="px-4 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isProcessing}
              >
                移除
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-gray-800 font-medium">点击或拖拽图片到此区域</p>
              <p className="text-sm text-gray-500">
                仅支持 PNG/JPG/JPEG
              </p>
            </div>
          </div>
        )}
      </div>

      {uploadError && <div className="text-sm text-red-500">{uploadError}</div>}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={handleRepair}
          disabled={isProcessing || !uploadedImage}
          className="relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
        >
          {isProcessing ? (
            <>
              <span className="h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
              正在修复
            </>
          ) : (
            '开始修复'
          )}
          {/* 积分消耗标识 - 按钮内部右下角 */}
          <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
            <span>{repairCost}</span>
          </div>
        </button>
        {error && <div className="text-sm text-red-500">{error}</div>}
      </div>

      {resultImage && (
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-orange-400/40 p-4 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-100/70 text-orange-600 border border-orange-200">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m0 0H9m6 0v6m5 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h2" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">修复结果</h3>
                  <p className="text-xs text-gray-500">点击图片可查看大图</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = resultImage
                  link.download = `supir-repair-${Date.now()}.png`
                  link.click()
                }}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-orange-600 border border-orange-300 rounded-xl hover:bg-orange-50 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                下载
              </button>
            </div>
          </div>

          <div className="relative rounded-3xl border border-orange-400/40 bg-white/80 overflow-hidden shadow-xl group">
            <img
              src={resultImage}
              alt="修复后的图片"
              className="w-full h-full object-contain cursor-zoom-in transition-opacity duration-200 group-hover:opacity-90"
              onClick={() => {
                if (resultImage) {
                  setZoomedImage({
                    original: previewUrl || '',
                    repaired: resultImage
                  })
                  setIsShowingOriginal(false)
                }
              }}
            />
            {repairTime !== null && (
              <div className="absolute bottom-0 left-0 right-0 p-3 text-center text-xs text-gray-900 backdrop-blur-md bg-white/40">
                <span>耗时 {repairTime} 秒</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  const renderUpscaleTab = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-4">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mx-auto">
        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m4-4H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900">放大功能开发中</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        图像放大流程正在对接新的工作流，完成后将在这里提供一键放大与对比查看功能。
      </p>
      <div className="inline-flex items-center px-4 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
        敬请期待
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pt-20 lg:pt-24 lg:pl-48">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <header className="mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-r from-orange-400/10 to-amber-400/10 rounded-lg">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m0 0H9m6 0v6m-1 3H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2-2h5a2 2 0 012 2v9a2 2 0 01-2 2h-3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">工作流工具</h1>
              <p className="text-sm text-gray-500 -mt-0.5">运行内置的 ComfyUI 工作流</p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('repair')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'repair'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            修复
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('upscale')}
            className={`flex-1 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'upscale'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            放大
          </button>
        </div>

        {activeTab === 'repair' ? renderRepairTab() : renderUpscaleTab()}
      </div>

      {/* 图片放大模态框 */}
      {zoomedImage && (
        <div
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-4 animate-fadeInUp"
          onClick={() => {
            setZoomedImage(null)
            setIsShowingOriginal(false)
          }}
        >
          {/* 顶部控制栏 */}
          <div className="w-full max-w-[1400px] flex justify-between items-start mb-4">
            {/* 对比按钮 - 左上角（仅在有原图时显示） */}
            {zoomedImage.original && (
              <button
                className="px-4 py-2 text-orange-300 hover:text-orange-100 transition-colors bg-orange-800/50 rounded-lg hover:bg-orange-700/50 flex items-center gap-2 font-medium active:bg-orange-700/70"
                onMouseDown={() => setIsShowingOriginal(true)}
                onMouseUp={() => setIsShowingOriginal(false)}
                onMouseLeave={() => setIsShowingOriginal(false)}
                onTouchStart={() => setIsShowingOriginal(true)}
                onTouchEnd={() => setIsShowingOriginal(false)}
                onClick={(e) => e.stopPropagation()}
                aria-label="按住查看原图"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                <span className="text-sm">按住对比</span>
              </button>
            )}

            {/* 关闭按钮 - 右上角 */}
            <button
              className="p-2 text-orange-300 hover:text-orange-100 transition-colors hover:scale-110 transform duration-300 bg-orange-800/50 rounded-full hover:bg-orange-700/50"
              onClick={(e) => {
                e.stopPropagation()
                setZoomedImage(null)
                setIsShowingOriginal(false)
              }}
              aria-label="关闭预览"
            >
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 图片容器 */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full max-w-[1400px] max-h-[calc(100vh-8rem)] flex items-center justify-center">
              <img
                src={isShowingOriginal && zoomedImage.original ? zoomedImage.original : zoomedImage.repaired}
                alt={isShowingOriginal && zoomedImage.original ? "原图预览" : "修复后预览"}
                className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto object-contain rounded-lg shadow-2xl border border-orange-400/30 animate-scaleIn transition-opacity duration-200"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* 底部提示 */}
          <div className="w-full max-w-[1400px] mt-4 text-center text-sm text-orange-200/60">
            <p>
              {isShowingOriginal && zoomedImage.original ? '显示原图' : '显示修复后'} - 点击背景或关闭按钮退出预览
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

