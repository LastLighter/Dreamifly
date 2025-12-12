'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import { ModelConfig } from '@/utils/modelConfig'
import { WorkflowConfig } from '@/utils/workflowConfig'

interface AIPlazaCardProps {
  item: ModelConfig | WorkflowConfig
  type: 'model' | 'workflow'
}

export default function AIPlazaCard({ item, type }: AIPlazaCardProps) {
  const [showNameModal, setShowNameModal] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  // 点击外部关闭模态框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowNameModal(false)
      }
    }

    if (showNameModal) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNameModal])

  // 获取标签文本（仅用于模型）
  const getTagText = (tag: string) => {
    const tagMap: Record<string, string> = {
      'fastGeneration': '快速生成',
      'animeSpecialty': '动漫风格',
      'chineseSupport': '支持中文',
      'realisticStyle': '写实风格'
    }
    return tagMap[tag] || tag
  }

  // 生成特征标签
  let featureTags: string[] = []
  let coverImage = ''
  let route = ''

  if (type === 'model') {
    const model = item as ModelConfig
    coverImage = model.homepageCover || '/models/homepageModelCover/demo.jpg'
    route = `/create?model=${encodeURIComponent(model.id)}`
    
    if (model.use_t2i) featureTags.push('文生图')
    if (model.use_i2i) featureTags.push('图生图')
    if (model.tags) {
      model.tags.forEach(tag => {
        const tagText = getTagText(tag)
        if (!featureTags.includes(tagText)) {
          featureTags.push(tagText)
        }
      })
    }
  } else {
    const workflow = item as WorkflowConfig
    coverImage = workflow.homepageCover || '/workflows/homepageWorkflowCover/demo.jpg'
    route = workflow.route || '/workflows'
    
    if (workflow.tags) {
      featureTags = [...workflow.tags]
    }
  }

  // 获取描述文本
  const description = type === 'model' 
    ? (item as ModelConfig).description 
    : (item as WorkflowConfig).description

  return (
    <div className="relative group">
      <Link
        href={transferUrl(route, locale)}
        className="block"
      >
        {/* 图片卡片 */}
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border border-orange-400/30 mb-3">
          <div className="relative w-full h-full group-hover:scale-110 transition-transform duration-700 ease-out">
            <Image
              src={coverImage}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
          
          {/* 左上角类型标签 */}
          <div 
            className="absolute top-3 left-3 z-10"
            ref={modalRef}
          >
            <div className="relative">
              <button
                className="px-1.5 py-0.5 bg-gray-500/40 backdrop-blur-sm text-white text-[10px] font-medium rounded whitespace-nowrap hover:bg-gray-500/60 transition-all duration-300"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowNameModal(!showNameModal)
                }}
              >
                {type === 'model' ? '模型' : '工作流'}
              </button>
              {showNameModal && (
                <div className="absolute top-full left-0 mt-2 px-4 py-3 bg-black/90 backdrop-blur-md text-white text-sm rounded-lg shadow-2xl min-w-[200px] z-20">
                  <p className="font-semibold mb-1">{item.name}</p>
                  {description && (
                    <p className="text-xs text-gray-300 mt-2 mb-2">{description}</p>
                  )}
                  {type === 'model' && (item as ModelConfig).tags && (item as ModelConfig).tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(item as ModelConfig).tags!.map((tag, index) => (
                        <span key={index} className="px-2 py-0.5 bg-orange-500/30 rounded text-xs">
                          {getTagText(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                  {type === 'workflow' && (item as WorkflowConfig).tags && (item as WorkflowConfig).tags!.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(item as WorkflowConfig).tags!.map((tag, index) => (
                        <span key={index} className="px-2 py-0.5 bg-orange-500/30 rounded text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 右下角特征标签 - 单行显示 */}
          {featureTags.length > 0 && (
            <div className="absolute bottom-3 right-3 z-10 flex gap-1 justify-end max-w-[calc(100%-1.5rem)]">
              {featureTags.map((tag, index) => (
                <span
                  key={index}
                  className="px-1.5 py-0.5 bg-gray-500/40 backdrop-blur-sm text-white text-[10px] font-medium rounded whitespace-nowrap flex-shrink-0"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 底部标题区域（在图片外部） */}
        <div className="px-1">
          <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
            {item.name}
          </h3>
        </div>
      </Link>
    </div>
  )
}

