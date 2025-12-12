'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import { WorkflowConfig } from '@/utils/workflowConfig'

interface HomepageWorkflowCardProps {
  workflow: WorkflowConfig
}

export default function HomepageWorkflowCard({ workflow }: HomepageWorkflowCardProps) {
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
  
  const coverImage = workflow.homepageCover || '/workflows/homepageWorkflowCover/demo.jpg'
  const route = workflow.route || '/workflows'

  return (
    <div className="relative group">
      <Link
        href={transferUrl(route, locale)}
        className="block relative aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border border-orange-400/30 transform hover:scale-[1.02] transition-transform duration-300"
      >
        <Image
          src={coverImage}
          alt={workflow.name}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
        
        {/* 左上角名称模态框 */}
        <div 
          className="absolute top-3 left-3 z-10"
          ref={modalRef}
        >
          <div className="relative">
            <button
              className="px-3 py-1.5 bg-black/60 backdrop-blur-md text-white text-sm font-medium rounded-lg hover:bg-black/80 transition-all duration-300"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowNameModal(!showNameModal)
              }}
            >
              {workflow.name}
            </button>
            {showNameModal && (
              <div className="absolute top-full left-0 mt-2 px-4 py-3 bg-black/90 backdrop-blur-md text-white text-sm rounded-lg shadow-2xl min-w-[200px] z-20">
                <p className="font-semibold mb-1">{workflow.name}</p>
                {workflow.description && (
                  <p className="text-xs text-gray-300 mt-2">{workflow.description}</p>
                )}
                {workflow.tags && workflow.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {workflow.tags.map((tag, index) => (
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

        {/* 右下角特征标签 */}
        {workflow.tags && workflow.tags.length > 0 && (
          <div className="absolute bottom-3 right-3 z-10 flex flex-wrap gap-1.5 justify-end max-w-[60%]">
            {workflow.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-medium rounded-lg whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </div>
  )
}

