'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import Image from 'next/image'
import { useSession } from '@/lib/auth-client'
import { useAvatar } from '@/contexts/AvatarContext'
import { ExtendedUser } from '@/types/auth'
import { useState } from 'react'
import AvatarWithFrame from './AvatarWithFrame'

export default function AdminSidebar() {
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const pathname = usePathname()
  const { data: session } = useSession()
  const { avatar: globalAvatar, avatarFrameId } = useAvatar()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const isActive = (path: string) => {
    const fullPath = transferUrl(path, locale)
    if (path === '/admin') {
      // 精确匹配 /admin，不包括 /admin/analytics
      return pathname === fullPath || pathname === fullPath + '/'
    }
    return pathname === fullPath || pathname?.startsWith(fullPath + '/')
  }

  // 处理点击遮罩层关闭菜单
  const handleOverlayClick = () => {
    setIsMobileMenuOpen(false)
  }

  // 处理点击菜单按钮
  const handleMenuClick = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // 处理点击导航项（移动端点击后关闭菜单）
  const handleNavClick = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      {/* 移动端顶部导航栏 */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-100/80 backdrop-blur-md border-b border-orange-400/20 z-40 flex items-center px-4">
        <button
          onClick={handleMenuClick}
          className="p-2 text-gray-700 hover:text-gray-900 transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center ml-4">
          <Image
            src="/images/dreamifly-logo.jpg"
            alt="Dreamifly Logo"
            width={32}
            height={32}
            className="rounded-xl shadow-lg border border-orange-400/30"
          />
          <span className="ml-2 text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            后台管理
          </span>
        </div>
      </div>

      {/* 遮罩层 */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-gray-100/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={handleOverlayClick}
        />
      )}

      {/* 侧边栏 */}
      <div 
        className={`fixed left-0 top-0 bottom-0 w-64 bg-gray-100/80 backdrop-blur-md border-r border-orange-400/20 z-50 transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isMobileMenuOpen ? 'shadow-2xl' : ''}
        `}
        data-admin-sidebar="true"
      >
      <div className="flex flex-col h-full py-8">
        {/* Logo 部分 - 在移动端隐藏，因为已经在顶部栏显示 */}
        <div className="hidden lg:flex flex-col items-center mb-12 px-4">
          <Link 
            href={transferUrl('/', locale)} 
            className="relative transform transition-all duration-300 hover:scale-110 mb-3"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-orange-400 to-amber-400 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
            <Image
              src="/images/dreamifly-logo.jpg"
              alt="Dreamifly Logo"
              width={48}
              height={48}
              className="rounded-2xl shadow-xl border border-orange-400/30 relative z-10"
            />
          </Link>
          <span className="text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            后台管理
          </span>
        </div>

        {/* 导航菜单 */}
        <div className="flex-1 flex flex-col items-center space-y-4 w-full px-4 pt-8 lg:pt-0">
          <Link
            href={transferUrl('/admin', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin') && !isActive('/admin/analytics')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin') && !isActive('/admin/analytics')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin') && !isActive('/admin/analytics')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>用户管理</span>
          </Link>

          <Link
            href={transferUrl('/admin/analytics', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/analytics')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/analytics')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/analytics')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>数据统计</span>
          </Link>

          <Link
            href={transferUrl('/admin/points', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/points')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg
              className={`w-6 h-6 flex-shrink-0 ${
                isActive('/admin/points')
                  ? 'text-orange-600 group-hover:text-orange-700'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14m0-6c1.11 0 2.08.402 2.6 1M12 8V6m0 8v2m8-4a8 8 0 11-16 0 8 8 0 0116 0z"
              />
            </svg>
            <span
              className={`text-sm font-medium ${
                isActive('/admin/points')
                  ? 'text-orange-700 group-hover:text-orange-800'
                  : 'text-gray-900 group-hover:text-gray-800'
              }`}
            >
              积分管理
            </span>
          </Link>

          <Link
            href={transferUrl('/admin/cdk', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/cdk')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg
              className={`w-6 h-6 flex-shrink-0 ${
                isActive('/admin/cdk')
                  ? 'text-orange-600 group-hover:text-orange-700'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
              />
            </svg>
            <span
              className={`text-sm font-medium ${
                isActive('/admin/cdk')
                  ? 'text-orange-700 group-hover:text-orange-800'
                  : 'text-gray-900 group-hover:text-gray-800'
              }`}
            >
              CDK管理
            </span>
          </Link>

          <Link
            href={transferUrl('/admin/subscriptions', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/subscriptions')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg
              className={`w-6 h-6 flex-shrink-0 ${
                isActive('/admin/subscriptions')
                  ? 'text-orange-600 group-hover:text-orange-700'
                  : 'text-gray-700 group-hover:text-gray-900'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span
              className={`text-sm font-medium ${
                isActive('/admin/subscriptions')
                  ? 'text-orange-700 group-hover:text-orange-800'
                  : 'text-gray-900 group-hover:text-gray-800'
              }`}
            >
              订阅数据
            </span>
          </Link>

          <Link
            href={transferUrl('/admin/crawler-analysis', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/crawler-analysis')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/crawler-analysis')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/crawler-analysis')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>爬虫分析</span>
          </Link>

          <Link
            href={transferUrl('/admin/blacklist', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/blacklist')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/blacklist')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/blacklist')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>黑名单</span>
          </Link>

          <Link
            href={transferUrl('/admin/decorations', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/decorations')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/decorations')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/decorations')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>装饰管理</span>
          </Link>

          <Link
            href={transferUrl('/admin/email-domains', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/email-domains')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/email-domains')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/email-domains')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>邮箱域名</span>
          </Link>

          <Link
            href={transferUrl('/admin/god-eye', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/god-eye')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/god-eye')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/god-eye')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>上帝之眼</span>
          </Link>

          <Link
            href={transferUrl('/admin/settings', locale)}
            onClick={handleNavClick}
            className={`group w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-300 ${
              isActive('/admin/settings')
                ? 'bg-gradient-to-r from-orange-400/20 to-amber-400/20 border border-orange-400/40'
                : 'bg-gray-200/50 hover:bg-gray-300/50'
            }`}
          >
            <svg className={`w-6 h-6 flex-shrink-0 ${
              isActive('/admin/settings')
                ? 'text-orange-600 group-hover:text-orange-700'
                : 'text-gray-700 group-hover:text-gray-900'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className={`text-sm font-medium ${
              isActive('/admin/settings')
                ? 'text-orange-700 group-hover:text-orange-800'
                : 'text-gray-900 group-hover:text-gray-800'
            }`}>设置</span>
          </Link>
        </div>

        {/* 底部用户信息 */}
        <div className="mt-auto px-4 w-full">
          {session?.user && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50">
              <AvatarWithFrame
                avatar={globalAvatar || (session.user as ExtendedUser)?.avatar || session.user.image || '/images/default-avatar.svg'}
                avatarFrameId={avatarFrameId}
                size={32}
                className="border-2 border-orange-400/30 flex-shrink-0"
              />
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-xs text-gray-500">管理员</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

