'use client'

import Link from 'next/link'
import Image from 'next/image'
import LanguageSwitch from './LanguageSwitch'
import WeChatIcon from './WeChatIcon'
import GitHubIcon from './GitHubIcon'
import AuthModal from './AuthModal'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { transferUrl } from '@/utils/locale'
import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useSession, signOut } from '@/lib/auth-client'
import { useAvatar } from '@/contexts/AvatarContext'
import AvatarWithFrame from './AvatarWithFrame'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

export default function Navbar() {
  const { locale } = useParams()
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const { data: session } = useSession()
  const { avatar: globalAvatar, nickname: globalNickname, avatarFrameId } = useAvatar()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  // 检查管理员和优质用户状态
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!session?.user) {
        setIsAdmin(false)
        setIsPremium(false)
        return
      }

      try {
        // 获取动态 token
        const token = await generateDynamicTokenWithServerTime()
        
        const response = await fetch('/api/admin/check', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        const data = await response.json()
        setIsAdmin(data.isAdmin || false)
        setIsPremium(data.isPremium || false)
      } catch (error) {
        console.error('Failed to check user status:', error)
        setIsAdmin(false)
        setIsPremium(false)
      }
    }

    checkUserStatus()
  }, [session?.user])

  // 处理点击遮罩层关闭菜单
  const handleOverlayClick = () => {
    setIsMobileMenuOpen(false)
  }

  // 处理点击菜单按钮
  const handleMenuClick = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const handleQuickGenerateClick = () => {
    setIsMobileMenuOpen(false)
    router.push(transferUrl('/create', locale))
  }

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleLogoClick = (event?: ReactMouseEvent<HTMLAnchorElement | HTMLDivElement>) => {
    event?.preventDefault()
    setIsMobileMenuOpen(false)
    const homePath = transferUrl('/', locale)
    const isHome = pathname === `/${locale}` || pathname === `/${locale}/`

    if (isHome) {
      scrollToTop()
      return
    }

    router.push(homePath)
    setTimeout(() => {
      scrollToTop()
    }, 200)
  }

  // 处理点击导航项
  const handleNavItemClick = (sectionId: string) => {
    const isHome = pathname === `/${locale}` || pathname === `/${locale}/`
    setIsMobileMenuOpen(false)
    if (!isHome) {
      router.push(transferUrl('/', locale))
    }
    scrollToSection(sectionId)
  }

  // 在主页平滑滚动到指定部分
  const scrollToSection = (sectionId: string,delayms:number = 500) => {
   setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
    }, delayms)
  }

  // 处理登出
  const handleLogout = async () => {
    await signOut()
    setShowUserMenu(false)
    // 强制刷新页面确保session状态更新
    window.location.reload()
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
        <div className="flex items-center ml-4 cursor-pointer" onClick={() => handleLogoClick()}>
          <Image
            src="/images/dreamifly-logo.jpg"
            alt="Dreamifly Logo"
            width={32}
            height={32}
            className="rounded-xl shadow-lg border border-orange-400/30"
          />
          <span className="ml-2 text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
            {t('siteName')}
          </span>
        </div>
        
        {/* 移动端图标和用户菜单 */}
        <div className="ml-auto flex items-center gap-2">
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-200/50 transition-colors"
              >
                <AvatarWithFrame
                  avatar={globalAvatar}
                  avatarFrameId={avatarFrameId}
                  size={32}
                  className="border-2 border-orange-400/30"
                />
              </button>
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                  <Link
                    href={transferUrl('/profile', locale)}
                    onClick={() => setShowUserMenu(false)}
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {tAuth('profile')}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors"
                  >
                    {tAuth('logout')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1.5 text-sm bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
            >
              {tAuth('login')}
            </button>
          )}
          <GitHubIcon />
          <WeChatIcon />
        </div>
      </div>

      {/* 遮罩层 */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-gray-100/50 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={handleOverlayClick}
        />
      )}

      {/* 侧边导航栏 */}
      <div 
        id="main-nav"
        className={`fixed left-0 top-0 bottom-0 w-48 bg-gray-100/80 backdrop-blur-md border-r border-orange-400/20 z-50 transition-transform duration-300
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${isMobileMenuOpen ? 'shadow-2xl' : ''}
        `}
      >
        <div className="flex flex-col items-center h-full py-8">
          {/* Logo 部分 - 在移动端隐藏，因为已经在顶部栏显示 */}
          <div className="hidden lg:flex flex-col items-center mb-12">
            <Link 
              href={transferUrl('/', locale)} 
              onClick={handleLogoClick}
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
              {t('siteName')}
            </span>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 flex flex-col items-center space-y-8 w-full px-4">
            <button
              onClick={handleQuickGenerateClick}
              className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
            >
              <svg className="w-6 h-6 text-gray-700 group-hover:text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm text-gray-900 group-hover:text-gray-800">{t('quickGenerate')}</span>
            </button>

            <button
              onClick={() => handleNavItemClick('community-showcase')}
              className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
            >
              <svg className="w-6 h-6 text-gray-700 group-hover:text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="text-sm text-gray-900 group-hover:text-gray-800">{t('community')}</span>
            </button>
            <button
              onClick={() => handleNavItemClick('faq-section')}
              className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
            >
              <svg className="w-6 h-6 text-gray-700 group-hover:text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-gray-900 group-hover:text-gray-800">{t('faq')}</span>
            </button>
                   <button
         onClick={() => handleNavItemClick('friends-section')}
         className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
       >
         <svg className="w-6 h-6 text-gray-700 group-hover:text-gray-900 flex-shrink-0" fill="currentColor" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
           <path d="M546.9184 665.4976a187.9552 187.9552 0 0 1-133.3248-55.1424 25.6 25.6 0 0 1 36.1984-36.1984 137.472 137.472 0 0 0 194.2016 0l186.1632-186.1632c53.5552-53.5552 53.5552-140.6464 0-194.2016s-140.6464-53.5552-194.2016 0L478.8736 350.8736a25.6 25.6 0 0 1-36.1984-36.1984l157.0816-157.0816c73.5232-73.5232 193.1264-73.5232 266.5984 0s73.5232 193.1264 0 266.5984l-186.1632 186.1632a187.9552 187.9552 0 0 1-133.3248 55.1424z" />
           <path d="M239.7184 972.6976a187.9552 187.9552 0 0 1-133.3248-55.1424 188.672 188.672 0 0 1 0-266.5984l186.1632-186.1632a188.672 188.672 0 0 1 266.5984 0 25.6 25.6 0 0 1-36.1984 36.1984 137.472 137.472 0 0 0-194.2016 0l-186.1632 186.1632c-53.5552 53.5552-53.5552 140.6464 0 194.2016s140.6464 53.5552 194.2016 0l157.0816-157.0816a25.6 25.6 0 0 1 36.1984 36.1984l-157.0816 157.0816a187.9552 187.9552 0 0 1-133.3248 55.1424z" />
         </svg>
         <span className="text-sm text-gray-900 group-hover:text-gray-800">{t('friends')}</span>
       </button>

            {/* 工作流菜单 - 仅优质用户和管理员可见 */}
            {session?.user && (isAdmin || isPremium) && (
              <Link
                href={transferUrl('/workflows', locale)}
                onClick={() => setIsMobileMenuOpen(false)}
                className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
              >
                <svg className="w-6 h-6 text-gray-700 group-hover:text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h10m-6 5h6" />
                </svg>
                <span className="text-sm text-gray-900 group-hover:text-gray-800">{t('workflows')}</span>
              </Link>
            )}

            {/* 管理员菜单 - 仅管理员可见 */}
            {session?.user && isAdmin && (
              <Link
                href={transferUrl('/admin', locale)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMobileMenuOpen(false)}
                className="group w-full flex items-center gap-3 p-3 rounded-2xl bg-gradient-to-r from-orange-400/20 to-amber-400/20 hover:from-orange-400/30 hover:to-amber-400/30 border border-orange-400/40 transition-all duration-300"
              >
                <svg className="w-6 h-6 text-orange-600 group-hover:text-orange-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span className="text-sm font-medium text-orange-700 group-hover:text-orange-800">后台管理</span>
              </Link>
            )}
          </nav>

          {/* 语言切换和图标 */}
          <div className="mt-auto px-4 w-full">
            <div className="flex flex-col items-center gap-4 relative">
              {/* 用户信息 */}
              {session?.user && (
                <div className="w-full">
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="w-full flex items-center gap-3 p-3 rounded-2xl bg-gray-200/50 hover:bg-gray-300/50 transition-all duration-300"
                    >
                      <AvatarWithFrame
                        avatar={globalAvatar}
                        avatarFrameId={avatarFrameId}
                        size={40}
                        className="border-2 border-orange-400/30 flex-shrink-0"
                      />
                      <div className="flex-1 text-left overflow-hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {globalNickname || session.user.name}
                        </p>
                      </div>
                    </button>
                    {showUserMenu && (
                      <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
                        <Link
                          href={transferUrl('/profile', locale)}
                          onClick={() => setShowUserMenu(false)}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          {tAuth('profile')}
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 transition-colors"
                        >
                          {tAuth('logout')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 语言切换 */}
              <div className="flex flex-col items-center gap-2 relative">
                <span className="text-sm text-gray-700">{t('switchLanguage')}</span>
                <div className="relative">
                  <LanguageSwitch />
                </div>
              </div>

              {/* 登录按钮（移动至语言切换下方） */}
              {!session?.user && (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-2.5 rounded-xl hover:from-orange-500 hover:to-amber-500 transition-all"
                >
                  {tAuth('login')}
                </button>
              )}

              {/* 图标区域（无文字） */}
              <div className="flex items-center justify-center gap-4">
                <GitHubIcon />
                <WeChatIcon />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </>
  )
} 