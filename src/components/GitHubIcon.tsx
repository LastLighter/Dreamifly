'use client'

import Image from 'next/image'

export default function GitHubIcon() {
  const handleClick = () => {
    window.open('https://github.com/LastLighter/Dreamifly', '_blank')
  }

  return (
    <div className="relative group">
      <button 
        onClick={handleClick}
        className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
      >
        <div className="relative w-6 h-6 flex items-center justify-center">
          <Image
            src="/common/github.svg"
            alt="GitHub"
            width={24}
            height={24}
            className="relative z-10 filter brightness-0 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
          />
        </div>
      </button>

      {/* PC端悬浮效果 - 显示在右侧 */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 lg:block hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-gray-400/20 p-4 z-50">
        <div className="text-center">
          <p className="text-sm font-medium text-gray-900 mb-1">GitHub 仓库</p>
          <p className="text-xs text-gray-600">点击访问项目源码</p>
        </div>
      </div>
    </div>
  )
}
