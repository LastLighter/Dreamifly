'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession, changePassword, signOut } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import { ExtendedUser } from '@/types/auth'
import { useAvatar } from '@/contexts/AvatarContext'
import AvatarCropper from '@/components/AvatarCropper'
import AvatarWithFrame from '@/components/AvatarWithFrame'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

export default function ProfilePage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { avatar: globalAvatar, nickname: globalNickname, avatarFrameId, updateProfile, setAvatarFrameId } = useAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nickname, setNickname] = useState('')
  const [avatar, setAvatar] = useState('/images/default-avatar.svg')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Local avatar selection state
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [showCropper, setShowCropper] = useState(false)
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null)
  const [isGifFile, setIsGifFile] = useState(false)

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

  // Quota state
  const [quota, setQuota] = useState<{
    todayCount: number
    maxDailyRequests: number | null
    isAdmin: boolean
    isPremium: boolean
    isOldUser: boolean
    isActive: boolean
  } | null>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)

  const [subscription, setSubscription] = useState<{
    isSubscribed: boolean
    planType: string | null
    expiresAt: string | null
  } | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)

  // Avatar frame selection state
  const [showAvatarFrameSelector, setShowAvatarFrameSelector] = useState(false)
  const [availableFrames, setAvailableFrames] = useState<Array<{ id: number; category: string; imageUrl: string | null }>>([])
  const [selectedFrameId, setSelectedFrameId] = useState<number | null>(null)
  const [previewFrameId, setPreviewFrameId] = useState<number | null>(null)
  const [framesLoading, setFramesLoading] = useState(false)


  // 监听session变化，更新用户数据
  useEffect(() => {
    if (session?.user) {
      const user = session.user as ExtendedUser
      setNickname(user.nickname || '')
      setAvatar(user.avatar || '/images/default-avatar.svg')
      setSelectedFrameId(user.avatarFrameId ?? null)
      setPreviewFrameId(user.avatarFrameId ?? null)
    }
  }, [session])

  // 获取用户可用的头像框列表
  useEffect(() => {
    const fetchAvailableFrames = async () => {
      if (!session?.user) return

      setFramesLoading(true)
      try {
        const user = session.user as ExtendedUser
        const availableFrameIds = user.availableAvatarFrameIds
          ? user.availableAvatarFrameIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id))
          : []

        // 如果用户没有可用头像框ID列表，则不显示任何头像框选项
        if (availableFrameIds.length === 0) {
          setAvailableFrames([])
          setFramesLoading(false)
          return
        }

        // 获取所有头像框
        const response = await fetch(`/api/avatar-frames?t=${Date.now()}`)
        if (response.ok) {
          const data = await response.json()
          const allFrames = data.frames || []
          
          // 只显示available_avatar_frame_ids字段中允许的头像框
          const frames = allFrames.filter((frame: { id: number }) => availableFrameIds.includes(frame.id))
          
          setAvailableFrames(frames)
        }
      } catch (error) {
        console.error('Error fetching available frames:', error)
      } finally {
        setFramesLoading(false)
      }
    }

    fetchAvailableFrames()
  }, [session])

  // 同步全局头像和昵称状态到本地状态
  useEffect(() => {
    setAvatar(globalAvatar)
  }, [globalAvatar])

  useEffect(() => {
    setNickname(globalNickname)
  }, [globalNickname])

  // 获取今日额度信息
  useEffect(() => {
    const fetchQuota = async () => {
      if (!session?.user) return
      
      setQuotaLoading(true)
      try {
        // 获取动态token（使用服务器时间）
        const token = await generateDynamicTokenWithServerTime()
        
        // 添加时间戳参数以避免缓存
        const response = await fetch(`/api/user/quota?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setQuota(data)
        }
      } catch (error) {
        console.error('Error fetching quota:', error)
      } finally {
        setQuotaLoading(false)
      }
    }

    fetchQuota()
  }, [session])

  // 获取订阅状态
  useEffect(() => {
    const fetchSubscription = async () => {
      if (!session?.user) return

      setSubscriptionLoading(true)
      try {
        const res = await fetch(`/api/subscription/status?t=${Date.now()}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setSubscription({
            isSubscribed: Boolean(data.isSubscribed),
            planType: data.subscription?.planType ?? null,
            expiresAt: data.expiresAt ?? null,
          })
        }
      } catch (error) {
        console.error('Error fetching subscription status:', error)
      } finally {
        setSubscriptionLoading(false)
      }
    }

    fetchSubscription()
  }, [session])


  // 仅在保存成功时通过 updateProfile 同步全局昵称，输入时不实时同步

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400"></div>
      </div>
    )
  }

  if (!session?.user) {
    router.push('/')
    return null
  }

  const user = session.user as ExtendedUser
  const quotaProgress =
    quota?.maxDailyRequests && quota.maxDailyRequests > 0
      ? Math.min(100, Math.round((quota.todayCount / quota.maxDailyRequests) * 100))
      : quota?.maxDailyRequests === 0
        ? 100
        : null

  const userTypeBadge = quota
    ? quota.isAdmin
      ? { label: '管理员', className: 'border-red-200 bg-red-50 text-red-600' }
      : quota.isPremium
        ? { label: '优质用户', className: 'border-amber-200 bg-amber-50 text-amber-700' }
        : quota.isOldUser
          ? { label: '首批用户', className: 'border-blue-200 bg-blue-50 text-blue-700' }
          : { label: '普通用户', className: 'border-gray-200 bg-gray-50 text-gray-600' }
    : null

  const membershipBadge = subscription
    ? subscription.isSubscribed
      ? { label: '会员', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
      : { label: '未订阅', className: 'border-gray-200 bg-gray-50 text-gray-600' }
    : { label: '加载中', className: 'border-white/20 bg-white/10 text-white/80' }

  const showUserTypeBadge =
    userTypeBadge && !(membershipBadge?.label === '会员' && userTypeBadge.label === '普通用户')

  const uidBadge =
    user.uid !== undefined && user.uid !== null
      ? { label: `UID #${user.uid}`, className: 'border-orange-200 bg-orange-50 text-orange-700' }
      : null

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError(t('error.invalidFileType'))
      return
    }

    // Validate file size (10MB for original file, will be compressed after crop)
    if (file.size > 10 * 1024 * 1024) {
      setError(t('error.fileTooLarge'))
      return
    }

    setError('')
    setSuccess('')

    // Check if it's a GIF file
    const isGif = file.type === 'image/gif'
    setIsGifFile(isGif)

    // Revoke previous preview URL if exists
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    if (cropperImageSrc) URL.revokeObjectURL(cropperImageSrc)

    // Create object URL for cropper
    const objectUrl = URL.createObjectURL(file)
    setCropperImageSrc(objectUrl)
    setShowCropper(true)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropComplete = (croppedBlob: Blob) => {
    // Create a File from the Blob
    const fileExtension = isGifFile ? 'gif' : 'jpg'
    const croppedFile = new File([croppedBlob], `avatar.${fileExtension}`, { type: croppedBlob.type })
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(croppedBlob)
    
    // Update states
    setPendingAvatarFile(croppedFile)
    setAvatarPreview(previewUrl)
    setShowCropper(false)
    
    // Clean up cropper image URL
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc)
      setCropperImageSrc(null)
    }
  }

  const handleCropCancel = () => {
    setShowCropper(false)
    
    // Clean up cropper image URL
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc)
      setCropperImageSrc(null)
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSaveProfile = async () => {
    setError('')
    setSuccess('')
    setSaving(true)

    try {
      let avatarUrlToSave = avatar

      // If user selected a new avatar, upload it now
      if (pendingAvatarFile) {
        setUploading(true)
        const formData = new FormData()
        formData.append('file', pendingAvatarFile)
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })
        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          const errorMessage = errorData.error || 'Upload failed'
          throw new Error(errorMessage)
        }
        const uploadData = await uploadResponse.json()
        avatarUrlToSave = uploadData.url
      }

      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nickname,
          avatar: avatarUrlToSave,
          avatarFrameId: previewFrameId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update profile')
      }

      // Apply new avatar state and clear pending preview
      setAvatar(avatarUrlToSave)
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setAvatarPreview(null)
      setPendingAvatarFile(null)
      
      // 立即更新全局头像和昵称状态
      updateProfile(avatarUrlToSave, nickname)
      
      // 更新选中的头像框ID和全局头像框ID
      setSelectedFrameId(previewFrameId)
      setAvatarFrameId(previewFrameId)
      
      setSuccess(t('success.profileUpdated'))
      setTimeout(() => {
        router.refresh()
      }, 1000)
    } catch (err) {
      console.error('Update error:', err)
      // 显示具体错误消息，如果是审核失败等，会显示服务器返回的具体消息
      const errorMessage = err instanceof Error ? err.message : t('error.updateFailed')
      setError(errorMessage)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setError(t('error.passwordRequired'))
      return
    }

    if (newPassword.length < 8) {
      setError(t('error.invalidPassword'))
      return
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('error.passwordMismatch'))
      return
    }

    setPasswordLoading(true)

    try {
      await changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      })

      setSuccess(t('success.passwordChanged'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setShowPasswordForm(false)
    } catch (err) {
      console.error('Password change error:', err)
      setError(t('error.passwordChangeFailed'))
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-white">
      <div className="max-w-6xl mx-auto px-4 pb-16 pt-10 lg:pl-48">
        <section className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-2xl ring-1 ring-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,200,150,0.25),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(255,255,255,0.05),transparent_40%)]" />
          <div className="relative flex flex-col gap-8 p-8 pt-14 lg:p-10 lg:pt-16 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-6 lg:flex-nowrap">
              <div className="relative">
                <AvatarWithFrame
                  avatar={avatarPreview || avatar}
                  avatarFrameId={previewFrameId !== null ? previewFrameId : avatarFrameId}
                  size={112}
                  className="ring-4 ring-white/10 shadow-xl shadow-orange-500/20 rounded-full"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                  </div>
                )}
                <button
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  className="absolute -right-2 -bottom-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/80 text-slate-900 shadow-lg backdrop-blur transition hover:bg-white disabled:opacity-50"
                  aria-label={t('changeAvatar')}
                >
                  <img src="/common/edit.svg" alt="" className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <div className="space-y-2 w-full max-w-4xl">
                <h1 className="flex flex-wrap items-center gap-2 text-3xl font-semibold leading-tight text-white">
                  <span>{nickname || user.name || user.email}</span>
                  {membershipBadge && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${membershipBadge.className}`}>
                      <img src="/common/crown.svg" alt="" className="h-3 w-3" />
                      {membershipBadge.label}
                    </span>
                  )}
                  {showUserTypeBadge && userTypeBadge && (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${quota && !quota.isActive ? 'text-gray-400 line-through border-gray-300 bg-gray-100' : userTypeBadge.className}`}>
                      {userTypeBadge.label}
                    </span>
                  )}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-white/70">
                  <span>{user.email}</span>
                  {uidBadge && (
                    <>
                      <span className="h-4 w-px bg-white/20" aria-hidden="true" />
                      <span className="text-sm text-white/80">{uidBadge.label}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
            >
              <span className="h-2 w-2 rounded-full bg-red-300 shadow shadow-red-500/50" />
              {t('logout')}
            </button>
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
            {success}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
          <section className="rounded-2xl border border-orange-100/70 bg-white p-6 shadow-xl shadow-orange-500/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-500">资料</p>
                <h2 className="text-xl font-semibold text-gray-900">基础信息</h2>
                <p className="text-sm text-gray-500">保持公开资料简洁又有态度。</p>
              </div>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                即时保存
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500">{t('name')}</p>
                <p className="font-semibold text-gray-800">{user.name}</p>
                <p className="text-xs text-gray-400">系统账户名</p>
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('nickname')}
              </label>
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-inner shadow-gray-100/40">
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={t('nicknamePlaceholder')}
                  className="w-full rounded-lg border border-transparent bg-gray-100 text-gray-900 outline-none placeholder:text-gray-400 focus:border-transparent focus:ring-2 focus:ring-orange-200"
                />
                <p className="mt-2 text-xs text-gray-500">昵称将展示在社区与作品页。</p>
              </div>
            </div>

            {/* 更换头像框折叠框 - 仅当用户有可用头像框ID列表时显示 */}
            {(() => {
              const user = session?.user as ExtendedUser | undefined
              const hasAvailableFrames = user?.availableAvatarFrameIds && user.availableAvatarFrameIds.trim() !== ''
              
              if (!hasAvailableFrames) {
                return null
              }

              return (
                <div className="mt-6 rounded-xl border border-gray-200 bg-white">
                  <button
                    onClick={() => setShowAvatarFrameSelector(!showAvatarFrameSelector)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">更换头像框</p>
                      <p className="text-xs text-gray-500">选择你喜欢的头像框样式</p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-500 transform transition-transform duration-200 ${showAvatarFrameSelector ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showAvatarFrameSelector && (
                    <div className="border-t border-gray-200 p-4">
                      {framesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-orange-400"></div>
                        </div>
                      ) : availableFrames.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">暂无可用头像框</p>
                      ) : (
                        <div className="space-y-4">
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {/* 无头像框选项 */}
                        <button
                          onClick={() => setPreviewFrameId(null)}
                          className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                            previewFrameId === null
                              ? 'border-orange-400 bg-orange-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2">
                            <AvatarWithFrame
                              avatar={avatarPreview || avatar}
                              avatarFrameId={null}
                              size={64}
                            />
                          </div>
                          <span className="text-xs text-gray-600">无头像框</span>
                          {previewFrameId === null && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </button>

                        {/* 头像框选项 */}
                        {availableFrames.map((frame) => (
                          <button
                            key={frame.id}
                            onClick={() => setPreviewFrameId(frame.id)}
                            className={`relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                              previewFrameId === frame.id
                                ? 'border-orange-400 bg-orange-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2 overflow-hidden">
                              {frame.imageUrl ? (
                                <AvatarWithFrame
                                  avatar={avatarPreview || avatar}
                                  avatarFrameId={frame.id}
                                  size={64}
                                />
                              ) : (
                                <AvatarWithFrame
                                  avatar={avatarPreview || avatar}
                                  avatarFrameId={null}
                                  size={64}
                                />
                              )}
                            </div>
                            <span className="text-xs text-gray-600 truncate w-full text-center">ID: {frame.id}</span>
                            {previewFrameId === frame.id && (
                              <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 text-center">
                        当前预览：{previewFrameId === null ? '无头像框' : `头像框 ID ${previewFrameId}`}
                      </p>
                      </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-400/30 transition hover:from-orange-500 hover:to-amber-500 disabled:opacity-50"
              >
                {saving && (
                  <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {t('saveChanges')}
              </button>
              <button
                onClick={() => setShowPasswordForm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
              >
                🔒 {t('changePassword')}
              </button>
              <p className="text-xs text-gray-500">头像和头像框更换后记得点击保存同步。</p>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-orange-500/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">会员订阅</p>
                  <h3 className="text-lg font-semibold text-gray-900">权益状态</h3>
                  <p className="text-sm text-gray-500">查看你的当前方案与到期时间。</p>
                </div>
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${membershipBadge.className}`}>
                  {membershipBadge.label}
                </span>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                {subscriptionLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    加载订阅信息...
                  </div>
                ) : subscription ? (
                  <div className="space-y-1 text-gray-800">
                    <p className="text-base font-semibold">
                      {subscription.isSubscribed ? '已开通 · ' : '未开通'}
                      {subscription.planType || '默认方案'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {subscription.isSubscribed
                        ? subscription.expiresAt
                          ? `到期时间：${new Date(subscription.expiresAt).toLocaleString()}`
                          : '有效期：暂未获取到到期时间'
                        : '订阅后获得更高算力额度与商用无忧'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">无法加载订阅信息</p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-orange-500/5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">今日免费额度</p>
                  <h3 className="text-lg font-semibold text-gray-900">调用统计</h3>
                  <p className="text-sm text-gray-500">关注上限，合理分配创作节奏。</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {quota && !quota.isActive && (
                    <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                      账号已封禁
                    </span>
                  )}
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {quotaLoading ? '加载中' : quota ? '已同步' : '未获取'}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
                {quotaLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    正在读取额度...
                  </div>
                ) : quota ? (
                  <div className="space-y-2 text-gray-800">
                    {!quota.isActive && (
                      <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="text-sm font-semibold text-red-800">账号已被封禁</p>
                            <p className="text-xs text-red-600">您的账号已被封禁，无法使用生图服务和签到功能。如有疑问，请加群联系管理员。</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className={`text-base font-semibold ${!quota.isActive ? 'text-gray-400 line-through' : ''}`}>
                        {quota.todayCount} / {quota.maxDailyRequests === null ? '∞' : quota.maxDailyRequests}
                      </p>
                      {/* 如果用户是会员，显示会员标识；否则显示用户类型标识 */}
                      {subscription?.isSubscribed ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          <img src="/common/crown.svg" alt="" className="h-3 w-3" />
                          会员
                        </span>
                      ) : (
                        userTypeBadge && (
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${!quota.isActive ? 'text-gray-400 line-through border-gray-300 bg-gray-100' : userTypeBadge.className}`}>
                            {userTypeBadge.label}
                          </span>
                        )
                      )}
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className={`h-full rounded-full transition-all ${!quota.isActive ? 'bg-gray-300' : 'bg-gradient-to-r from-orange-400 to-amber-400'}`}
                        style={{
                          width: `${quotaProgress ?? 8}%`,
                          opacity: quotaProgress === null ? 0.3 : 1,
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      {quota.maxDailyRequests === null
                        ? '当前为无限制模式，请合理使用算力资源。'
                        : '免费额度达到上限后需等次日刷新，积分可替代额度。'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">无法加载额度信息</p>
                )}
              </div>
            </div>
          </section>
        </div>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-orange-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">安全中心</p>
                <h3 className="text-lg font-semibold text-gray-900">{t('changePassword')}</h3>
                <p className="text-sm text-gray-500">定期更换密码，保障账户安全。</p>
              </div>
              <button
                onClick={() => setShowPasswordForm(!showPasswordForm)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100"
              >
                {showPasswordForm ? '收起' : '展开'}
              </button>
            </div>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('currentPassword')}</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={showCurrentPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showCurrentPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('newPassword')}</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showNewPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">{t('confirmNewPassword')}</label>
                  <div className="relative">
                    <input
                      type={showConfirmNewPassword ? 'text' : 'password'}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                      aria-label={showConfirmNewPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showConfirmNewPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-400 to-amber-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-400/30 transition hover:from-orange-500 hover:to-amber-500 disabled:opacity-50"
                  >
                    {passwordLoading && (
                      <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    {t('changePassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-orange-50 via-white to-white p-6 shadow-xl shadow-orange-500/5">
            <h3 className="text-lg font-semibold text-gray-900">使用提醒</h3>
            <p className="mt-2 text-sm text-gray-600">
              更换头像支持 JPG、PNG、GIF，建议先裁剪为正方形；保存资料后会即时同步到全局。
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-700">
              <li>· 若上传失败，请检查网络或稍后重试。</li>
              <li>· 遇到额度紧张，可考虑升级会员或次日再用。</li>
              <li>· 任何异常请携带 UID 联系管理员。</li>
            </ul>
          </div>
        </section>
      </div>

      {/* 头像裁剪器 */}
      {showCropper && cropperImageSrc && (
        <AvatarCropper
          imageSrc={cropperImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          isGif={isGifFile}
        />
      )}
    </div>
  )
}

