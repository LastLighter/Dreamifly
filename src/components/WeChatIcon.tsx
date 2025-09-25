'use client'

import Image from 'next/image'
import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function WeChatIcon() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleClick = () => {
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      <div className="relative group">
        <button 
          onClick={handleClick}
          className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
        >
          <div className="relative w-6 h-6 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 rounded-full blur-sm opacity-50"></div>
            <Image
              src="/common/wechat.svg"
              alt="WeChat"
              width={24}
              height={24}
              className="relative z-10 filter brightness-0 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
            />
          </div>
        </button>

        {/* PC端悬浮效果 - 显示在右侧 */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 lg:block hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 bg-white/90 backdrop-blur-md rounded-xl shadow-xl border border-green-400/20 p-6 z-50">
          <div className="w-[360px] h-[160px] flex items-center justify-center">
            <Image
              src="/common/WeChatOfficialAccount.png"
              alt="WeChat Official Account QR Code"
              width={360}
              height={160}
              className="rounded-2xl max-w-full max-h-full object-contain"
              priority
            />
          </div>
        </div>
      </div>

      {/* 移动端模态框 - 使用Portal渲染到body */}
      {isModalOpen && typeof window !== 'undefined' && createPortal(
        <>
          {/* 黑色蒙版 */}
          <div 
            className="lg:hidden fixed top-0 left-0 w-screen h-screen bg-black bg-opacity-80 z-[9999]"
            onClick={handleCloseModal}
          />
          
          {/* 模态框内容 */}
          <div className="lg:hidden fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[10000] w-80 max-w-[90vw]">
            <div 
              className="bg-white rounded-2xl p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">关注微信公众号</h3>
                <button 
                  onClick={handleCloseModal}
                  className="text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex justify-center">
                <Image
                  src="/common/WeChatOfficialAccount.png"
                  alt="WeChat Official Account QR Code"
                  width={280}
                  height={125}
                  className="rounded-xl"
                  priority
                />
              </div>
              <p className="text-center text-gray-600 mt-4 text-sm">
                扫码关注我们的微信公众号
              </p>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}