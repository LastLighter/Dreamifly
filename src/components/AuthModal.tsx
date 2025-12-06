'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { signIn, sendVerificationEmail, forgetPassword } from '@/lib/auth-client'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: 'login' | 'register' | 'reset'
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<'login' | 'register' | 'reset' | 'verify'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!isOpen) return null

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return re.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (!email) {
      setError(t('error.emailRequired'))
      return
    }
    if (!validateEmail(email)) {
      setError(t('error.invalidEmail'))
      return
    }

    if (mode !== 'reset') {
      if (!password) {
        setError(t('error.passwordRequired'))
        return
      }
      if (password.length < 8) {
        setError(t('error.invalidPassword'))
        return
      }
    }

    if (mode === 'register') {
      if (!nickname) {
        setError(t('error.nicknameRequired'))
        return
      }
      if (password !== confirmPassword) {
        setError(t('error.passwordMismatch'))
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await signIn.email({
          email,
          password,
        })

        if (result.error) {
          // 检查是否是邮箱未验证的错误（支持多种错误格式）
          const isVerificationError = 
            result.error.message?.includes('verify') || 
            result.error.message?.includes('verification') ||
            result.error.message?.includes('未验证') ||
            result.error.message?.includes('not verified') ||
            result.error.code === 'EMAIL_NOT_VERIFIED' ||
            result.error.code === 'VERIFICATION_REQUIRED'

          if (isVerificationError) {
            // 切换到验证模式
            setMode('verify')
            setError(t('error.emailNotVerified'))
          } else {
            // 其他错误（密码错误等）
            setError(t('error.loginFailed'))
          }
        } else {
          setSuccess(t('success.login'))
          // 登录成功后刷新页面以更新session
          setTimeout(() => {
            onClose()
            window.location.reload()
          }, 500)
        }
      } else if (mode === 'register') {
        // 先验证邮箱域名
        try {
          // 获取动态token（使用服务器时间）
          const token = await generateDynamicTokenWithServerTime()
          
          const validateResponse = await fetch(`/api/auth/validate-email-domain?email=${encodeURIComponent(email)}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          const validateData = await validateResponse.json()
          
          if (!validateData.isValid) {
            setError(t('error.emailDomainNotAllowed'))
            return
          }
        } catch (err) {
          console.error('Email domain validation error:', err)
          setError(t('error.registerFailed'))
          return
        }

        // 获取动态token用于注册请求
        const registerToken = await generateDynamicTokenWithServerTime()
        
        // better-auth 的 signUp.email() 可能不支持自定义 headers
        // 使用原生 fetch 调用注册接口以确保可以添加动态 token
        try {
          const signUpResponse = await fetch('/api/auth/sign-up/email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${registerToken}`
            },
            body: JSON.stringify({
              email,
              password,
              name: nickname,
              image: '/images/default-avatar.svg',
              callbackURL: '/',
            }),
          })

          const signUpData = await signUpResponse.json()
          
          if (!signUpResponse.ok) {
            // 处理错误
            const errorMessage = signUpData.error?.message || ''
            const errorCode = signUpData.error?.code
            
            // 优先检查邮件发送失败的情况（因为用户可能已经创建成功）
            // 检查多种可能的邮件发送失败标识
            const isEmailSendFailed = 
              errorCode === 'EMAIL_SEND_FAILED' || 
              errorMessage === 'EMAIL_SEND_FAILED' ||
              errorMessage.includes('EMAIL_SEND_FAILED') ||
              errorMessage.includes('Failed to send email') ||
              errorMessage.includes('邮件发送失败') ||
              errorMessage.includes('发送邮件失败') ||
              (errorMessage.toLowerCase().includes('email') && 
               (errorMessage.toLowerCase().includes('send') || 
                errorMessage.toLowerCase().includes('fail')))
            
            if (isEmailSendFailed) {
              // 邮件发送失败，但用户可能已创建
              setError(t('error.emailSendFailed'))
              setMode('verify') // 切换到验证模式，用户可以重发验证邮件
            } else if (errorCode === 'IP_REGISTRATION_LIMIT_EXCEEDED' || 
                errorMessage.includes('24小时内最多只能注册') ||
                errorMessage.includes('最多只能注册') ||
                errorMessage.includes('24小時內最多只能註冊')) {
              // IP注册限制超出，优先显示后端返回的详细消息（包含重置时间）
              setError(errorMessage || t('error.ipRegistrationLimitExceeded'))
            } else if (errorCode === 'EMAIL_DOMAIN_NOT_ALLOWED' || 
                errorMessage === 'EMAIL_DOMAIN_NOT_ALLOWED' ||
                errorMessage.includes('EMAIL_DOMAIN_NOT_ALLOWED')) {
              setError(t('error.emailDomainNotAllowed'))
            } else if (errorCode === 'UNAUTHORIZED' || errorCode === 'INVALID_TOKEN') {
              setError(t('error.unauthorized'))
            } else {
              setError(t('error.registerFailed'))
            }
            return
          }

          // 注册成功，UID 和昵称已由后端自动设置
          setMode('verify')
          // 显示带限制提示的成功消息
          setSuccess(t('success.registerCheckEmailWithLimit'))
        } catch (signUpErr) {
          console.error('Sign up error:', signUpErr)
          setError(t('error.registerFailed'))
        }
      } else if (mode === 'reset') {
        const result = await forgetPassword({
          email,
          redirectTo: '/reset-password',
        })

        if (result.error) {
          setError(t('error.resetFailed'))
        } else {
          setSuccess(t('success.resetLinkSent'))
        }
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError(mode === 'login' ? t('error.loginFailed') : t('error.registerFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleResendVerification = async () => {
    if (!email) {
      setError(t('error.emailRequired'))
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await sendVerificationEmail({
        email,
        callbackURL: '/',
      })
      
      // better-auth 的方法返回 { data, error } 格式
      if (result.error) {
        // 根据错误码和错误消息区分不同的错误类型
        // 错误对象可能是嵌套的：result.error.error.code 或 result.error.code
        // 使用类型断言处理可能的嵌套错误结构
        const errorObj = result.error as any
        const errorMessage = errorObj.error?.message || errorObj.message || ''
        const errorMessageLower = errorMessage.toLowerCase()
        const errorCode = errorObj.error?.code || errorObj.code || ''
        
        // 优先检查配额限制错误（包括错误码和错误消息）
        const isQuotaError = 
          errorCode === 'daily_quota_exceeded' ||
          errorMessageLower.includes('quota') ||
          errorMessageLower.includes('配额') ||
          errorMessageLower.includes('daily email sending quota') ||
          errorMessageLower.includes('已达到每日发送配额') ||
          errorMessageLower.includes('you have reached your daily email sending quota') ||
          errorMessageLower.includes('daily sending quota limit')
        
        // 检查IP注册限制错误
        const isIPLimitError = 
          errorCode === 'IP_REGISTRATION_LIMIT_EXCEEDED' ||
          errorMessageLower.includes('24小时内最多只能注册') ||
          errorMessageLower.includes('最多只能注册') ||
          errorMessageLower.includes('24小時內最多只能註冊')
        
        // 检查其他邮件发送失败错误
        const isEmailSendFailed = 
          errorCode === 'EMAIL_SEND_FAILED' ||
          (errorMessageLower.includes('email') && (errorMessageLower.includes('send') || errorMessageLower.includes('fail'))) ||
          (errorMessageLower.includes('邮件') && (errorMessageLower.includes('发送') || errorMessageLower.includes('失败')))
        
        // 根据错误类型显示不同的提示（优先级：配额限制 > IP限制 > 邮件发送失败 > 其他）
        if (isQuotaError) {
          // 邮件发送配额限制（最高优先级）
          setError(t('error.emailQuotaExceeded'))
        } else if (isIPLimitError) {
          // IP注册限制超出
          setError(errorMessage || t('error.ipRegistrationLimitExceeded'))
        } else if (isEmailSendFailed) {
          // 其他邮件发送失败的错误
          setError(t('error.emailSendFailed'))
        } else {
          // 其他未知错误
          setError(t('error.resendFailed'))
        }
      } else {
        setSuccess(t('success.verificationEmailSent'))
      }
    } catch (err) {
      console.error('Resend verification error:', err)
      setError(t('error.resendFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          {mode === 'login' && t('login')}
          {mode === 'register' && t('register')}
          {mode === 'reset' && t('resetPassword')}
          {mode === 'verify' && t('verifyEmail')}
        </h2>

        {/* Error/Success messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
            {success}
          </div>
        )}

        {/* Verification mode */}
        {mode === 'verify' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">{t('checkYourEmail')}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    {t('verificationEmailSent')} <strong>{email}</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    {t('clickLinkToVerify')}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('sending') : t('resendVerificationEmail')}
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
                setSuccess('')
              }}
              className="w-full text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              {t('backToLogin')}
            </button>
          </div>
        )}

        {/* Form */}
        {mode !== 'verify' && <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nickname field (register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">
                {t('nickname')}
              </label>
              <input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder={t('nicknamePlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
              />
            </div>
          )}

          {/* Email field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Password field (not for reset) */}
          {mode !== 'reset' && (
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
              />
            </div>
          )}

          {/* Confirm password field (register only) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                {t('confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('confirmPasswordPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
              />
            </div>
          )}

          {/* Forgot password link (login only) */}
          {mode === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setMode('reset')}
                className="text-sm text-orange-500 hover:text-orange-600 transition-colors"
              >
                {t('forgotPassword')}
              </button>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {mode === 'login' && t('login')}
                {mode === 'register' && t('register')}
                {mode === 'reset' && t('sendResetLink')}
              </span>
            ) : (
              <>
                {mode === 'login' && t('login')}
                {mode === 'register' && t('register')}
                {mode === 'reset' && t('sendResetLink')}
              </>
            )}
          </button>
        </form>}

        {/* Mode switch */}
        {mode !== 'verify' && <div className="mt-6 text-center text-sm">
          {mode === 'login' && (
            <p className="text-gray-600">
              {t('noAccount')}{' '}
              <button
                onClick={() => setMode('register')}
                className="text-orange-500 hover:text-orange-600 font-semibold transition-colors"
              >
                {t('signUpNow')}
              </button>
            </p>
          )}
          {mode === 'register' && (
            <p className="text-gray-600">
              {t('hasAccount')}{' '}
              <button
                onClick={() => setMode('login')}
                className="text-orange-500 hover:text-orange-600 font-semibold transition-colors"
              >
                {t('signInNow')}
              </button>
            </p>
          )}
          {mode === 'reset' && (
            <button
              onClick={() => setMode('login')}
              className="text-orange-500 hover:text-orange-600 font-semibold transition-colors"
            >
              {t('backToLogin')}
            </button>
          )}
        </div>}
      </div>
    </div>
  )
}

