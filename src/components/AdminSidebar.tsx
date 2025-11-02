'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import Image from 'next/image'
import { useSession } from '@/lib/auth-client'
import { useAvatar } from '@/contexts/AvatarContext'
import { ExtendedUser } from '@/types/auth'

export default function AdminSidebar() {
  const params = useParams()
  const locale = params?.locale as string || 'zh'
  const pathname = usePathname()
  const { data: session } = useSession()
  const { avatar: globalAvatar } = useAvatar()

  const isActive = (path: string) => {
    const fullPath = transferUrl(path, locale)
    if (path === '/admin') {
      // 精确匹配 /admin，不包括 /admin/analytics
      return pathname === fullPath || pathname === fullPath + '/'
    }
    return pathname === fullPath || pathname?.startsWith(fullPath + '/')
  }

  return (
    <div className="fixed left-0 top-0 bottom-0 w-64 bg-gray-100/80 backdrop-blur-md border-r border-orange-400/20 z-40" data-admin-sidebar="true">
      <div className="flex flex-col h-full py-8">
        {/* Logo 部分 */}
        <div className="flex flex-col items-center mb-12 px-4">
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
        <div className="flex-1 flex flex-col items-center space-y-4 w-full px-4">
          <Link
            href={transferUrl('/admin', locale)}
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
        </div>

        {/* 底部用户信息 */}
        <div className="mt-auto px-4 w-full">
          {session?.user && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50">
              <Image
                src={globalAvatar || (session.user as ExtendedUser)?.avatar || session.user.image || '/images/default-avatar.svg'}
                alt="Avatar"
                width={32}
                height={32}
                className="rounded-full border-2 border-orange-400/30 flex-shrink-0"
                unoptimized={globalAvatar?.startsWith('http') || (session.user as ExtendedUser)?.avatar?.startsWith('http')}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.src = '/images/default-avatar.svg'
                }}
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
  )
}

