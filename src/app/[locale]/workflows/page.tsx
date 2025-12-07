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
  const [repairCost, setRepairCost] = useState<number | null>(null) // 工作流修复消耗积分，null表示未加载
  const [isLoadingCost, setIsLoadingCost] = useState(true)
  const [showLoginTip, setShowLoginTip] = useState(false)
  const [showPointsInsufficientTip, setShowPointsInsufficientTip] = useState(false) // 积分不足提示
  const [requiredPoints, setRequiredPoints] = useState<number | null>(null) // 需要的积分数
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null) // 图片尺寸
  const [isImageValid, setIsImageValid] = useState(false) // 图片是否有效（尺寸符合要求）
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  // 放大功能相关状态
  const [upscaleImage, setUpscaleImage] = useState<string | null>(null)
  const [upscalePreviewUrl, setUpscalePreviewUrl] = useState<string | null>(null)
  const [upscaleResultImage, setUpscaleResultImage] = useState<string | null>(null)
  const [upscaleError, setUpscaleError] = useState<string | null>(null)
  const [upscaleUploadError, setUpscaleUploadError] = useState<string | null>(null)
  const [upscaleTime, setUpscaleTime] = useState<number | null>(null)
  const [upscaleCost, setUpscaleCost] = useState<number | null>(null) // 工作流放大消耗积分
  const [isLoadingUpscaleCost, setIsLoadingUpscaleCost] = useState(true)
  const [upscaleImageDimensions, setUpscaleImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isUpscaleImageValid, setIsUpscaleImageValid] = useState(false)
  const [scaleBy, setScaleBy] = useState<number>(1) // 放大倍数
  const [displayScaleBy, setDisplayScaleBy] = useState<number>(1) // 用于显示和计算的放大倍数（防抖后）
  const upscaleFileInputRef = useRef<HTMLInputElement | null>(null)
  const scaleByDebounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // 获取工作流修复消耗积分配置
  useEffect(() => {
    const fetchRepairCost = async () => {
      setIsLoadingCost(true)
      try {
        const response = await fetch('/api/points/repair-cost')
        if (response.ok) {
          const data = await response.json()
          setRepairCost(data.repairWorkflowCost || 5) // 默认5积分
        }
      } catch (error) {
        console.error('Failed to fetch repair cost:', error)
        setRepairCost(5) // 失败时使用默认值5
      } finally {
        setIsLoadingCost(false)
      }
    }
    fetchRepairCost()
  }, [])

  // 获取工作流放大消耗积分配置
  useEffect(() => {
    const fetchUpscaleCost = async () => {
      setIsLoadingUpscaleCost(true)
      try {
        const response = await fetch('/api/points/upscale-cost')
        if (response.ok) {
          const data = await response.json()
          setUpscaleCost(data.upscaleWorkflowCost || 5) // 默认5积分
        }
      } catch (error) {
        console.error('Failed to fetch upscale cost:', error)
        setUpscaleCost(5) // 失败时使用默认值5
      } finally {
        setIsLoadingUpscaleCost(false)
      }
    }
    fetchUpscaleCost()
  }, [])

  // 防抖处理放大倍数变化，200ms后更新用于计算的displayScaleBy
  useEffect(() => {
    // 清除之前的定时器
    if (scaleByDebounceTimerRef.current) {
      clearTimeout(scaleByDebounceTimerRef.current)
    }

    // 设置新的定时器
    scaleByDebounceTimerRef.current = setTimeout(() => {
      setDisplayScaleBy(scaleBy)
    }, 200)

    // 清理函数
    return () => {
      if (scaleByDebounceTimerRef.current) {
        clearTimeout(scaleByDebounceTimerRef.current)
      }
    }
  }, [scaleBy])

  // 根据图片分辨率计算积分费用（修复功能）
  const calculateCost = (width: number, height: number, baseCost: number): number => {
    const totalPixels = width * height
    const pixels1K = 1920 * 1080 // 2,073,600
    const pixels2K = 2560 * 1440 // 3,686,400
    
    if (totalPixels < pixels1K) {
      // 小于1K：使用基础费用
      return baseCost
    } else if (totalPixels >= pixels1K && totalPixels < pixels2K) {
      // 大于等于1K且小于2K：基础费用的两倍
      return baseCost * 2
    } else {
      // 大于等于2K：基础费用的两倍
      return baseCost * 2
    }
  }

  // 根据放大后的分辨率计算积分费用（放大功能）
  // 计费标准：以1920x1080像素为标准，默认5个积分（数据库不为空使用数据库的）
  // 当移动倍率时，根据放大后的像素是1920x1080的多少倍来控制积分，计算出来的小数向上取整
  const calculateUpscaleCost = (width: number, height: number, scaleBy: number, baseCost: number): number => {
    const scaledWidth = Math.round(width * scaleBy)
    const scaledHeight = Math.round(height * scaleBy)
    const scaledPixels = scaledWidth * scaledHeight
    
    // 标准像素 = 1920x1080 = 2,073,600
    const standardPixels = 1920 * 1080 // 2,073,600
    
    // 计算倍率：放大后的像素是标准像素的多少倍（保留小数）
    const multiplier = scaledPixels / standardPixels
    
    // 费用 = 基础费用 * 倍率，然后向上取整
    let cost = Math.ceil(baseCost * multiplier)
    
    // 如果计算出来的值低于基础费用（默认5积分），则按基础费用算
    cost = Math.max(cost, baseCost)
    
    // 调试信息（开发环境）
    if (process.env.NODE_ENV === 'development') {
      console.log('放大计费计算:', {
        原图尺寸: `${width}x${height}`,
        放大倍数: scaleBy,
        放大后尺寸: `${scaledWidth}x${scaledHeight}`,
        放大后像素: scaledPixels,
        标准像素: standardPixels,
        倍率: multiplier.toFixed(4),
        基础费用: baseCost,
        费用计算: `${baseCost} * ${multiplier.toFixed(4)} = ${(baseCost * multiplier).toFixed(2)}`,
        向上取整后: Math.ceil(baseCost * multiplier),
        最终费用: cost
      })
    }
    
    return cost
  }

  // 计算最大可用放大倍数（保证放大后小于2K，即 < 3,686,400）
  const calculateMaxScale = (width: number, height: number): number => {
    const pixels2K = 2560 * 1440 // 3,686,400
    const currentPixels = width * height
    // 最大像素数应该是小于2K标准，所以用 pixels2K - 1
    const maxPixels = pixels2K - 1
    const maxScale = Math.sqrt(maxPixels / currentPixels)
    return Math.floor(maxScale * 100) / 100 // 保留两位小数
  }

  const resetState = () => {
    setUploadedImage(null)
    setPreviewUrl(null)
    setResultImage(null)
    setError(null)
    setUploadError(null)
    setRepairTime(null)
    setImageDimensions(null)
    setIsImageValid(false)
  }

  const resetUpscaleState = () => {
    setUpscaleImage(null)
    setUpscalePreviewUrl(null)
    setUpscaleResultImage(null)
    setUpscaleError(null)
    setUpscaleUploadError(null)
    setUpscaleTime(null)
    setUpscaleImageDimensions(null)
    setIsUpscaleImageValid(false)
    setScaleBy(1)
  }

  const processFile = (file: File) => {
    setUploadError(null)
    setError(null)
    setResultImage(null)
    setImageDimensions(null)
    setIsImageValid(false)

    // 验证文件类型：支持 PNG、JPG、JPEG
    // 通过 MIME 类型或文件扩展名验证（某些浏览器可能MIME类型不一致）
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    const allowedExtensions = ['.png', '.jpg', '.jpeg']
    const fileName = file.name.toLowerCase()
    const fileExtension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
    
    const isValidType = allowedTypes.includes(file.type) || 
                        (fileExtension && allowedExtensions.includes(fileExtension))
    
    if (!isValidType) {
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
          
          // 保存图片尺寸
          setImageDimensions({ width, height })
          
          // 验证图片尺寸：宽高需不小于 500 像素
          if (width < 500 || height < 500) {
            setUploadError('图片宽高需不小于 500 像素')
            setIsImageValid(false)
            return
          }
          
          // 检查是否超过2K（总像素数 >= 2560x1440 = 3,686,400）
          const totalPixels = width * height
          const pixels2K = 2560 * 1440 // 3,686,400
          if (totalPixels >= pixels2K) {
            setUploadError('图片分辨率不能超过 2K（2560x1440）')
            setIsImageValid(false)
            return
          }
          
          // 尺寸验证通过，设置图片
          setUploadError(null)
          setIsImageValid(true)
          setPreviewUrl(result)
          const base64 = result.split(',')[1]
          setUploadedImage(base64)
        }
        img.onerror = () => {
          setUploadError('读取图片失败，请重试')
          setIsImageValid(false)
        }
        img.src = result
      }
    }
    reader.onerror = () => {
      setUploadError('读取图片失败，请重试')
      setIsImageValid(false)
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

  const processUpscaleFile = (file: File) => {
    setUpscaleUploadError(null)
    setUpscaleError(null)
    setUpscaleResultImage(null)
    setUpscaleImageDimensions(null)
    setIsUpscaleImageValid(false)

    // 验证文件类型：支持 PNG、JPG、JPEG
    // 通过 MIME 类型或文件扩展名验证（某些浏览器可能MIME类型不一致）
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg']
    const allowedExtensions = ['.png', '.jpg', '.jpeg']
    const fileName = file.name.toLowerCase()
    const fileExtension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : ''
    
    const isValidType = allowedTypes.includes(file.type) || 
                        (fileExtension && allowedExtensions.includes(fileExtension))
    
    if (!isValidType) {
      setUpscaleUploadError('仅支持 PNG、JPG、JPEG 格式的图片')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setUpscaleUploadError('图片大小不能超过 10MB')
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
          
          // 保存图片尺寸
          setUpscaleImageDimensions({ width, height })
          
          // 验证图片尺寸：宽高需不小于 500 像素
          if (width < 500 || height < 500) {
            setUpscaleUploadError('图片宽高需不小于 500 像素')
            setIsUpscaleImageValid(false)
            return
          }
          
          // 检查是否超过2K（总像素数 >= 2560x1440 = 3,686,400）
          const totalPixels = width * height
          const pixels2K = 2560 * 1440 // 3,686,400
          if (totalPixels >= pixels2K) {
            setUpscaleUploadError('图片分辨率不能超过 2K（2560x1440）')
            setIsUpscaleImageValid(false)
            return
          }
          
          // 计算最大可用放大倍数
          const maxScale = calculateMaxScale(width, height)
          
          // 如果当前倍数超过最大倍数，调整为最大倍数
          if (scaleBy > maxScale) {
            setScaleBy(maxScale)
            setDisplayScaleBy(maxScale)
          } else {
            // 确保displayScaleBy也同步
            setDisplayScaleBy(scaleBy)
          }
          
          // 验证通过
          setUpscaleUploadError(null)
          setIsUpscaleImageValid(true)
          setUpscalePreviewUrl(result)
          const base64 = result.split(',')[1]
          setUpscaleImage(base64)
        }
        img.onerror = () => {
          setUpscaleUploadError('读取图片失败，请重试')
          setIsUpscaleImageValid(false)
        }
        img.src = result
      }
    }
    reader.onerror = () => {
      setUpscaleUploadError('读取图片失败，请重试')
      setIsUpscaleImageValid(false)
    }
    reader.readAsDataURL(file)
  }

  const handleUpscaleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    processUpscaleFile(file)
  }

  const handleUpscaleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer.files?.[0]) {
      processUpscaleFile(event.dataTransfer.files[0])
    }
  }

  const handleUpscale = async () => {
    if (!upscaleImage) {
      setUpscaleUploadError('请先上传需要放大的图片')
      return
    }

    if (!upscaleImageDimensions) {
      setUpscaleUploadError('无法获取图片尺寸')
      return
    }

    // 验证放大倍数（使用当前的scaleBy，不是displayScaleBy）
    const maxScale = calculateMaxScale(upscaleImageDimensions.width, upscaleImageDimensions.height)
    if (scaleBy > maxScale) {
      setUpscaleUploadError(`放大倍数不能超过 ${maxScale.toFixed(2)} 倍`)
      return
    }

    setIsProcessing(true)
    setUpscaleError(null)
    setUpscaleTime(null)

    const startTime = Date.now()

    try {
      // 获取动态 token
      const token = await generateDynamicTokenWithServerTime()
      
      const response = await fetch('/api/workflows/upscale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          image: upscaleImage,
          scaleBy
        }),
        cache: 'no-store'
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        
        // 如果是401未登录错误，显示提示
        if (response.status === 401) {
          setShowLoginTip(true)
          setIsProcessing(false)
          return
        }
        
        // 如果是403积分不足错误，显示积分不足提示
        if (response.status === 403 && data.error && data.error.includes('积分不足')) {
          // 从错误信息中提取需要的积分数
          const pointsMatch = data.error.match(/需要 (\d+) 积分/)
          const points = pointsMatch ? parseInt(pointsMatch[1], 10) : null
          setRequiredPoints(points)
          setShowPointsInsufficientTip(true)
          setIsProcessing(false)
          return
        }
        
        throw new Error(data.error || '放大失败，请稍后重试')
      }

      const data = await response.json()
      const endTime = Date.now()
      const elapsedTime = ((endTime - startTime) / 1000).toFixed(2) // 转换为秒，保留2位小数
      
      setUpscaleResultImage(data.imageUrl)
      setUpscaleTime(parseFloat(elapsedTime))
      
      // 如果API返回了新的积分余额，更新前端积分显示
      if (data.pointsBalance !== undefined && data.pointsBalance !== null) {
        await refreshPoints()
      }
    } catch (err) {
      setUpscaleError(err instanceof Error ? err.message : '放大失败，请稍后重试')
      setUpscaleTime(null)
    } finally {
      setIsProcessing(false)
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
        
        // 如果是401未登录错误，显示提示
        if (response.status === 401) {
          setShowLoginTip(true)
          setIsProcessing(false)
          return
        }
        
        // 如果是403积分不足错误，显示积分不足提示
        if (response.status === 403 && data.error && data.error.includes('积分不足')) {
          // 从错误信息中提取需要的积分数
          const pointsMatch = data.error.match(/需要 (\d+) 积分/)
          const points = pointsMatch ? parseInt(pointsMatch[1], 10) : null
          setRequiredPoints(points)
          setShowPointsInsufficientTip(true)
          setIsProcessing(false)
          return
        }
        
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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
          disabled={isProcessing || !uploadedImage || !isImageValid}
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
          {/* 积分消耗标识 - 按钮内部右下角（根据图片分辨率动态显示，未上传时显示1K积分） */}
          {!isLoadingCost && repairCost !== null && (
            <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
              <span>
                {imageDimensions && isImageValid
                  ? calculateCost(imageDimensions.width, imageDimensions.height, repairCost)
                  : repairCost}
              </span>
            </div>
          )}
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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

  const renderUpscaleTab = () => {
    // 计算最大可用放大倍数
    const maxScale = upscaleImageDimensions 
      ? calculateMaxScale(upscaleImageDimensions.width, upscaleImageDimensions.height)
      : 3

    // 计算当前积分费用（使用防抖后的displayScaleBy进行计算）
    const currentCost = upscaleImageDimensions && upscaleCost !== null && isUpscaleImageValid
      ? calculateUpscaleCost(upscaleImageDimensions.width, upscaleImageDimensions.height, displayScaleBy, upscaleCost)
      : upscaleCost || 5

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-orange-200/40 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">图像放大</h2>
          <p className="text-sm text-gray-500 mt-1">
            基于 Supir Upscale 工作流对图片进行智能放大，放大后的分辨率不超过 2K 。
          </p>
        </div>

        <div
          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            upscalePreviewUrl ? 'border-orange-400/60 bg-orange-50/30' : 'border-orange-200/70 hover:bg-orange-50/30'
          }`}
          onClick={() => upscaleFileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleUpscaleDrop}
        >
          <input
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            className="hidden"
            ref={upscaleFileInputRef}
            onChange={handleUpscaleFileChange}
          />
          {upscalePreviewUrl ? (
            <div className="w-full space-y-4">
              <div className="relative w-full max-w-xl mx-auto aspect-video rounded-xl overflow-hidden shadow-lg border border-orange-200/60 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={upscalePreviewUrl}
                  alt="待放大图片预览"
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => upscaleFileInputRef.current?.click()}
                  className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                  disabled={isProcessing}
                >
                  更换图片
                </button>
                <button
                  type="button"
                  onClick={resetUpscaleState}
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

        {upscaleUploadError && <div className="text-sm text-red-500">{upscaleUploadError}</div>}

        {/* 放大倍数设置 */}
        {upscaleImageDimensions && isUpscaleImageValid ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              放大倍数：{scaleBy.toFixed(2)}x
              {upscaleImageDimensions && (
                <span className="ml-2 text-xs text-gray-500">
                  (最大 {maxScale.toFixed(2)}x，放大后尺寸: {Math.round(upscaleImageDimensions.width * scaleBy)} × {Math.round(upscaleImageDimensions.height * scaleBy)})
                </span>
              )}
            </label>
            <input
              type="range"
              min="1"
              max={maxScale.toFixed(2)}
              step="0.01"
              value={scaleBy}
              onChange={(e) => setScaleBy(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1x</span>
              <span>{maxScale.toFixed(2)}x</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">
            放大倍数范围：上传图片后将根据图片尺寸自动调整最大倍数
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleUpscale}
            disabled={isProcessing || !upscaleImage || !isUpscaleImageValid}
            className="relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            {isProcessing ? (
              <>
                <span className="h-4 w-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
                正在放大
              </>
            ) : (
              '开始放大'
            )}
            {/* 积分消耗标识 - 按钮内部右下角 */}
            {!isLoadingUpscaleCost && upscaleCost !== null && (
              <div className="absolute bottom-1 right-1 flex items-center gap-0.5 px-1.5 py-0.5 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                <span>{currentCost}</span>
              </div>
            )}
          </button>
          {upscaleError && <div className="text-sm text-red-500">{upscaleError}</div>}
        </div>

        {upscaleResultImage && (
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl border border-orange-400/40 p-4 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-orange-100/70 text-orange-600 border border-orange-200">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">放大结果</h3>
                    <p className="text-xs text-gray-500">点击图片可查看大图</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const link = document.createElement('a')
                    link.href = upscaleResultImage
                    link.download = `supir-upscale-${Date.now()}.png`
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upscaleResultImage}
                alt="放大后的图片"
                className="w-full h-full object-contain cursor-zoom-in transition-opacity duration-200 group-hover:opacity-90"
                onClick={() => {
                  if (upscaleResultImage) {
                    setZoomedImage({
                      original: upscalePreviewUrl || '',
                      repaired: upscaleResultImage
                    })
                    setIsShowingOriginal(false)
                  }
                }}
              />
              {upscaleTime !== null && (
                <div className="absolute bottom-0 left-0 right-0 p-3 text-center text-xs text-gray-900 backdrop-blur-md bg-white/40">
                  <span>耗时 {upscaleTime} 秒 | 放大倍数: {scaleBy.toFixed(2)}x</span>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  )
  }

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
              {/* eslint-disable-next-line @next/next/no-img-element */}
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

      {/* 未登录提示框 */}
      {showLoginTip && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 relative">
            <button
              aria-label="Close"
              onClick={() => setShowLoginTip(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900">该功能仅限登录用户使用</h3>
                <p className="text-sm text-gray-600">
                  请先登录后再使用工作流修复功能
                </p>
              </div>

              <button
                onClick={() => setShowLoginTip(false)}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
              >
                知道啦
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 积分不足提示框 */}
      {showPointsInsufficientTip && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 relative">
            <button
              aria-label="Close"
              onClick={() => setShowPointsInsufficientTip(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900">积分不足</h3>
                <p className="text-sm text-gray-600">
                  {requiredPoints !== null 
                    ? `需要 ${requiredPoints} 积分才能使用此功能，请先获取更多积分`
                    : '积分不足，请先获取更多积分'}
                </p>
              </div>

              <button
                onClick={() => setShowPointsInsufficientTip(false)}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
              >
                知道啦
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

