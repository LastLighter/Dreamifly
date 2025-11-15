'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useSession, changePassword, signOut } from '@/lib/auth-client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ExtendedUser } from '@/types/auth'
import { useAvatar } from '@/contexts/AvatarContext'
import AvatarCropper from '@/components/AvatarCropper'

export default function ProfilePage() {
  const t = useTranslations('auth')
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const { avatar: globalAvatar, nickname: globalNickname, updateProfile } = useAvatar()
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

  // 监听session变化，更新用户数据
  useEffect(() => {
    if (session?.user) {
      const user = session.user as ExtendedUser
      setNickname(user.nickname || '')
      setAvatar(user.avatar || '/images/default-avatar.svg')
    }
  }, [session])

  // 同步全局头像和昵称状态到本地状态
  useEffect(() => {
    setAvatar(globalAvatar)
  }, [globalAvatar])

  useEffect(() => {
    setNickname(globalNickname)
  }, [globalNickname])

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
    <div className="min-h-screen bg-gray-50 py-12 px-4 lg:pl-48">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
              {t('profile')}
            </h1>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
            >
              {t('logout')}
            </button>
          </div>

          {/* Error/Success messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
              {success}
            </div>
          )}

          {/* Avatar section */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              {t('avatar')}
            </label>
            <div className="flex items-center gap-6">
              <div className="relative">
                <Image
                  src={avatarPreview || avatar}
                  alt="Avatar"
                  width={100}
                  height={100}
                  className="rounded-full object-cover border-4 border-orange-200"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <div>
                <button
                  onClick={handleAvatarClick}
                  disabled={uploading}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('changeAvatar')}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  {t('error.invalidFileType')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* UID (read-only) */}
          {(session.user as ExtendedUser).uid && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户 ID (UID)
              </label>
              <input
                type="text"
                value={`#${(session.user as ExtendedUser).uid}`}
                disabled
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed font-mono"
              />
            </div>
          )}

          {/* Email (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('email')}
            </label>
            <input
              type="email"
              value={session.user.email}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Name (read-only) */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('name')}
            </label>
            <input
              type="text"
              value={session.user.name}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {/* Nickname */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('nickname')}
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('nicknamePlaceholder')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mb-8"
          >
            {saving ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {t('saveChanges')}
              </span>
            ) : (
              t('saveChanges')
            )}
          </button>

          {/* Password change section */}
          <div className="border-t pt-8">
            <button
              onClick={() => setShowPasswordForm(!showPasswordForm)}
              className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium transition-colors mb-4"
            >
              <svg className={`w-5 h-5 transition-transform ${showPasswordForm ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {t('changePassword')}
            </button>

            {showPasswordForm && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('currentPassword')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('newPassword')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('confirmNewPassword')}
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="flex-1 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-2 rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {passwordLoading ? t('changePassword') : t('changePassword')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmNewPassword('')
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
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

