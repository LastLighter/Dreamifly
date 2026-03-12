'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import { ModelConfig } from '@/utils/modelConfig'
import { WorkflowConfig } from '@/utils/workflowConfig'

interface AIPlazaCardProps {
  item: ModelConfig | WorkflowConfig
  type: 'model' | 'workflow'
}

export default function AIPlazaCard({ item, type }: AIPlazaCardProps) {
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'

  // 获取标签文本（仅用于模型）
  const getTagText = (tag: string) => {
    const tagMap: Record<string, string> = {
      'animeSpecialty': '动漫风格',
      'chineseSupport': '支持中文',
      'realisticStyle': '写实风格'
    }
    return tagMap[tag] || tag
  }

  // 获取标签颜色
  const getTagColor = (tag: string) => {
    const colorMap: Record<string, string> = {
      '支持中文': 'bg-pink-100 text-pink-700',
      '文生图':   'bg-sky-100 text-sky-700',
      '图生图':   'bg-teal-100 text-teal-700',
      '动漫风格': 'bg-purple-100 text-purple-700',
      '写实风格': 'bg-stone-100 text-stone-700',
      '图生视频': 'bg-indigo-100 text-indigo-700',
      '支持音频': 'bg-amber-100 text-amber-700',
    }
    return colorMap[tag] || 'bg-gray-100 text-gray-600'
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
    // 根据工作流ID添加tab参数
    const baseRoute = workflow.route || '/workflows'
    route = `${baseRoute}?tab=${workflow.id}`
    
    if (workflow.tags) {
      featureTags = [...workflow.tags]
    }
  }

  return (
    <div className="relative group">
      <Link
        href={transferUrl(route, locale)}
        className="block"
      >
        {/* 图片卡片 */}
        <div className="relative aspect-square rounded-2xl overflow-hidden shadow-xl border border-orange-400/30 mb-3">
          <div className="relative w-full h-full group-hover:scale-110 transition-transform duration-700 ease-out">
            <Image
              src={coverImage}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          </div>
        </div>

        {/* 底部标题区域（在图片外部） */}
        <div className="px-1">
          {/* 特征标签 - 位于标题上方 */}
          {featureTags.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-1.5">
              {featureTags.map((tag, index) => (
                <span
                  key={index}
                  className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium rounded whitespace-nowrap ${getTagColor(tag)}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
            {item.name}
          </h3>
        </div>
      </Link>
    </div>
  )
}

