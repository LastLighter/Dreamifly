'use client'

import { useSession } from '@/lib/auth-client'
import { ExtendedUser } from '@/types/auth'
import { useRouter, useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import AdminSidebar from '@/components/AdminSidebar'
import { transferUrl } from '@/utils/locale'
import { useAvatar } from '@/contexts/AvatarContext'
import AvatarWithFrame from '@/components/AvatarWithFrame'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'

interface AvatarFrame {
  id: number
  category: string
  imageUrl: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

export default function DecorationsPage() {
  const { data: session, isPending: sessionLoading } = useSession()
  const { avatar: globalAvatar, avatarFrameId } = useAvatar()
  const router = useRouter()
  const params = useParams()
  const locale = params?.locale as string || 'zh'

  const [frames, setFrames] = useState<AvatarFrame[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)

  // 对话框状态
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [editingFrame, setEditingFrame] = useState<AvatarFrame | null>(null)
  const [deletingFrame, setDeletingFrame] = useState<AvatarFrame | null>(null)

  // 表单状态
  const [formData, setFormData] = useState({
    category: '',
    imageUrl: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // 上传方式：'file' | 'url' | 'url-download'
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url' | 'url-download'>('file')
  const [urlToDownload, setUrlToDownload] = useState('')

  // 筛选状态
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // 检查管理员权限
  useEffect(() => {
    const checkAdminStatus = async () => {
      // 等待 session 加载完成
      if (sessionLoading) {
        return
      }

      // 如果 session 加载完成但没有用户，重定向
      if (!session?.user) {
        setIsAdmin(false)
        setCheckingAdmin(false)
        // 延迟重定向，避免闪烁
        setTimeout(() => {
          router.push(transferUrl('/', locale))
        }, 100)
        return
      }

      try {
        // 获取动态token
        const token = await generateDynamicTokenWithServerTime()
        
        const response = await fetch(`/api/admin/check?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        
        // 检查响应状态
        if (!response.ok) {
          // 如果是401或403，说明权限不足，重定向
          if (response.status === 401 || response.status === 403) {
            setIsAdmin(false)
            setTimeout(() => {
              router.push(transferUrl('/', locale))
            }, 100)
            return
          }
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        const isAdminUser = data.isAdmin || false
        setIsAdmin(isAdminUser)
        
        // 如果不是管理员，延迟重定向
        if (!isAdminUser) {
          setTimeout(() => {
            router.push(transferUrl('/', locale))
          }, 100)
        }
      } catch (error) {
        console.error('Failed to check admin status:', error)
        // 只有在确认不是管理员时才重定向，网络错误不重定向
        // 如果已经有session，可能是网络问题，不立即重定向
        if (!session?.user) {
          setIsAdmin(false)
          setTimeout(() => {
            router.push(transferUrl('/', locale))
          }, 100)
        } else {
          // 有session但检查失败，可能是临时网络问题，不重定向
          setIsAdmin(false)
        }
      } finally {
        setCheckingAdmin(false)
      }
    }

    checkAdminStatus()
  }, [session, sessionLoading, router, locale])

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      const timestamp = Date.now()
      
      // 并行加载头像框和分类
      const [framesResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/admin/avatar-frames?t=${timestamp}`),
        fetch(`/api/admin/avatar-frames/categories?t=${timestamp}`)
      ])

      if (!framesResponse.ok || !categoriesResponse.ok) {
        throw new Error('加载数据失败')
      }

      const framesData = await framesResponse.json()
      const categoriesData = await categoriesResponse.json()

      setFrames(framesData.frames || [])
      setCategories(categoriesData.categories || [])
    } catch (err) {
      console.error('Error loading data:', err)
      setError('加载数据失败，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin && !checkingAdmin) {
      loadData()
    }
  }, [isAdmin, checkingAdmin])

  // 隐藏父级 layout 的 Navbar 和 Footer
  useEffect(() => {
    const navbar = document.getElementById('main-nav')
    const footer = document.querySelector('footer')
    const mobileNavbar = document.querySelector('nav')
    
    if (navbar) navbar.style.display = 'none'
    if (footer) footer.style.display = 'none'
    if (mobileNavbar && mobileNavbar.id !== 'main-nav') {
      const parent = mobileNavbar.closest('.lg\\:hidden') as HTMLElement | null
      if (parent) parent.style.display = 'none'
    }

    return () => {
      if (navbar) navbar.style.display = ''
      if (footer) footer.style.display = ''
      if (mobileNavbar && mobileNavbar.id !== 'main-nav') {
        const parent = mobileNavbar.closest('.lg\\:hidden') as HTMLElement | null
        if (parent) parent.style.display = ''
      }
    }
  }, [])

  // 如果 session 还在加载或权限还在检查中，显示加载状态
  if (sessionLoading || checkingAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  // 如果权限检查完成但不是管理员，不渲染内容（已在 useEffect 中重定向）
  if (!isAdmin) {
    return null
  }

  // 处理添加
  const handleAdd = () => {
    setFormData({ category: '', imageUrl: '' })
    setFormError('')
    setPendingFile(null)
    setFilePreview(null)
    setUploadMethod('file')
    setUrlToDownload('')
    setShowAddModal(true)
  }

  // 处理编辑
  const handleEdit = (frame: AvatarFrame) => {
    setEditingFrame(frame)
    setFormData({
      category: frame.category,
      imageUrl: frame.imageUrl || '',
    })
    setFormError('')
    setPendingFile(null)
    setFilePreview(null)
    setUploadMethod('url')
    setUrlToDownload('')
    setShowEditModal(true)
  }

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setFormError('请选择图片文件')
      return
    }

    // 验证文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      setFormError('文件大小不能超过 10MB')
      return
    }

    setFormError('')
    setPendingFile(file)

    // 创建预览
    const previewUrl = URL.createObjectURL(file)
    setFilePreview(previewUrl)
  }

  // 清除文件选择
  const handleClearFile = () => {
    if (filePreview) {
      URL.revokeObjectURL(filePreview)
    }
    setPendingFile(null)
    setFilePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 处理删除
  const handleDelete = (frame: AvatarFrame) => {
    setDeletingFrame(frame)
    setShowDeleteModal(true)
  }

  // 提交表单
  const handleSubmit = async () => {
    if (!formData.category.trim()) {
      setFormError('分类不能为空')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      let imageUrlToSave = formData.imageUrl.trim() || null

      // 根据上传方式处理
      if (uploadMethod === 'file' && pendingFile) {
        // 方式1：上传文件
        setUploading(true)
        const uploadFormData = new FormData()
        uploadFormData.append('file', pendingFile)
        
        const uploadResponse = await fetch('/api/admin/upload-avatar-frame', {
          method: 'POST',
          body: uploadFormData,
        })

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || '上传失败')
        }

        const uploadData = await uploadResponse.json()
        imageUrlToSave = uploadData.url
      } else if (uploadMethod === 'url-download' && urlToDownload.trim()) {
        // 方式3：从URL下载并上传
        setUploading(true)
        const downloadResponse = await fetch('/api/admin/upload-avatar-frame-from-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: urlToDownload.trim() }),
        })

        if (!downloadResponse.ok) {
          const errorData = await downloadResponse.json().catch(() => ({}))
          throw new Error(errorData.error || '下载并上传失败')
        }

        const downloadData = await downloadResponse.json()
        imageUrlToSave = downloadData.url
      }
      // 方式2：直接使用URL（uploadMethod === 'url'），imageUrlToSave 已经设置为 formData.imageUrl

      const timestamp = Date.now()
      const url = editingFrame
        ? `/api/admin/avatar-frames/${editingFrame.id}?t=${timestamp}`
        : `/api/admin/avatar-frames?t=${timestamp}`
      
      const method = editingFrame ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: formData.category.trim(),
          imageUrl: imageUrlToSave,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '操作失败')
      }

      // 清理预览
      if (filePreview) {
        URL.revokeObjectURL(filePreview)
      }

      // 重新加载数据
      await loadData()
      
      // 关闭对话框
      setShowAddModal(false)
      setShowEditModal(false)
      setEditingFrame(null)
      setFormData({ category: '', imageUrl: '' })
      setPendingFile(null)
      setFilePreview(null)
      setUploadMethod('file')
      setUrlToDownload('')
    } catch (err) {
      console.error('Error submitting form:', err)
      setFormError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deletingFrame) return

    setSubmitting(true)
    setFormError('')

    try {
      const timestamp = Date.now()
      const response = await fetch(`/api/admin/avatar-frames/${deletingFrame.id}?t=${timestamp}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '删除失败')
      }

      // 重新加载数据
      await loadData()
      
      // 关闭对话框
      setShowDeleteModal(false)
      setDeletingFrame(null)
    } catch (err) {
      console.error('Error deleting frame:', err)
      setFormError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setSubmitting(false)
    }
  }

  // 筛选后的头像框列表
  const filteredFrames = selectedCategory === 'all'
    ? frames
    : frames.filter(frame => frame.category === selectedCategory)

  // 按分类分组头像框
  const groupedFrames = filteredFrames.reduce((acc, frame) => {
    const category = frame.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(frame)
    return acc
  }, {} as Record<string, typeof frames>)

  // 获取分类列表（按字母顺序排序）
  const sortedCategories = Object.keys(groupedFrames).sort()

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />

      <div className="lg:pl-64 pt-16 lg:pt-0">
        {/* 固定页眉 */}
        <header className="fixed top-0 left-0 right-0 lg:left-64 bg-white border-b border-orange-200/50 shadow-sm z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* 顶部导航栏 */}
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-orange-400/10 to-amber-400/10 rounded-lg">
                  <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">装饰管理</h1>
                  <p className="text-xs text-gray-500 -mt-0.5">管理头像框和分类</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAdd}
                  className="px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
                >
                  + 添加头像框
                </button>
                <AvatarWithFrame
                  avatar={globalAvatar || (session?.user as ExtendedUser)?.avatar || session?.user?.image || '/images/default-avatar.svg'}
                  avatarFrameId={avatarFrameId}
                  size={36}
                  className="border-2 border-orange-400/40"
                />
              </div>
            </div>

            {/* 筛选和统计 */}
            <div className="pb-4 flex items-center justify-between border-b border-gray-200">
              <div className="flex items-center gap-4 relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none appearance-none bg-white pr-10 relative z-40"
                >
                  <option value="all">全部分类 ({frames.length})</option>
                  {categories.map(cat => {
                    const count = frames.filter(f => f.category === cat).length
                    return (
                      <option key={cat} value={cat}>
                        {cat} ({count})
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="text-sm text-gray-600">
                共 {filteredFrames.length} 个头像框
              </div>
            </div>
          </div>
        </header>

        {/* 主内容 */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-[8.5rem] pb-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* 头像框列表 */}
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : filteredFrames.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500">暂无头像框</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedCategories.map((category) => (
                <div key={category} className="space-y-4">
                  {/* 分类标题 */}
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-200 first:border-t-0 first:pt-0">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {category}
                    </h2>
                    <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {groupedFrames[category].length} 个
                    </span>
                  </div>

                  {/* 该分类下的头像框 */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
                    {groupedFrames[category].map((frame) => (
                      <div
                        key={frame.id}
                        className="bg-white rounded-lg border border-gray-200 p-2 hover:shadow-lg transition-shadow"
                      >
                        {/* 头像框预览 */}
                        <div className="relative w-full aspect-square mb-2 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                          {frame.imageUrl ? (
                            <Image
                              src={frame.imageUrl}
                              alt={`Avatar Frame ${frame.id}`}
                              fill
                              className="object-contain"
                              unoptimized={frame.imageUrl.startsWith('http')}
                            />
                          ) : (
                            <div className="text-gray-400 text-xs">无图片</div>
                          )}
                        </div>

                        {/* 信息 */}
                        <div className="mb-2">
                          <div className="text-xs font-medium text-gray-900 mb-0.5">
                            ID: {frame.id}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleEdit(frame)}
                            className="flex-1 px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors text-xs font-medium"
                          >
                            编辑
                          </button>
                          <button
                            onClick={() => handleDelete(frame)}
                            className="flex-1 px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* 添加/编辑对话框 */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">
              {editingFrame ? '编辑头像框' : '添加头像框'}
            </h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分类 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="category-list"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="选择现有分类或输入新分类名称"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
                <datalist id="category-list">
                  {categories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                {categories.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    现有分类: {categories.join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  头像框图片
                </label>
                
                {/* 上传方式切换 */}
                <div className="mb-4">
                  <div className="flex gap-2 border-b border-gray-200">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMethod('file')
                        setPendingFile(null)
                        setFilePreview(null)
                        setUrlToDownload('')
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        uploadMethod === 'file'
                          ? 'border-b-2 border-orange-500 text-orange-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      上传文件
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMethod('url')
                        setPendingFile(null)
                        setFilePreview(null)
                        setUrlToDownload('')
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        uploadMethod === 'url'
                          ? 'border-b-2 border-orange-500 text-orange-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      输入URL
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadMethod('url-download')
                        setPendingFile(null)
                        setFilePreview(null)
                        setFormData({ ...formData, imageUrl: '' })
                        if (fileInputRef.current) {
                          fileInputRef.current.value = ''
                        }
                      }}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        uploadMethod === 'url-download'
                          ? 'border-b-2 border-orange-500 text-orange-600'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      链接下载上传
                    </button>
                  </div>
                </div>

                {/* 根据选择的方式显示不同的输入 */}
                <div className="space-y-3">
                  {uploadMethod === 'file' && (
                    <>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading || submitting}
                          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {pendingFile ? '更换文件' : '选择文件'}
                        </button>
                        {pendingFile && (
                          <button
                            type="button"
                            onClick={handleClearFile}
                            disabled={uploading || submitting}
                            className="px-3 py-2 text-sm text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                          >
                            清除
                          </button>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          disabled={uploading || submitting}
                        />
                        {uploading && (
                          <span className="text-sm text-gray-500">上传中...</span>
                        )}
                      </div>

                      {/* 文件预览 */}
                      {filePreview && (
                        <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <Image
                            src={filePreview}
                            alt="Preview"
                            fill
                            className="object-contain"
                            unoptimized={filePreview.startsWith('http')}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {uploadMethod === 'url' && (
                    <>
                      <input
                        type="text"
                        value={formData.imageUrl}
                        onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                        placeholder="输入图片URL（直接使用，不上传到OSS）"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        disabled={uploading || submitting}
                      />
                      {editingFrame && editingFrame.imageUrl && !formData.imageUrl && (
                        <div className="text-xs text-gray-500">
                          当前URL: {editingFrame.imageUrl}
                        </div>
                      )}
                      {formData.imageUrl && (
                        <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <Image
                            src={formData.imageUrl}
                            alt="Preview"
                            fill
                            className="object-contain"
                            unoptimized={formData.imageUrl.startsWith('http')}
                            onError={() => setFormError('无法加载图片，请检查URL是否正确')}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {uploadMethod === 'url-download' && (
                    <>
                      <input
                        type="text"
                        value={urlToDownload}
                        onChange={(e) => setUrlToDownload(e.target.value)}
                        placeholder="输入图片链接（将自动下载并上传到OSS）"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                        disabled={uploading || submitting}
                      />
                      {uploading && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                          <span>正在下载并上传...</span>
                        </div>
                      )}
                      {urlToDownload && !uploading && (
                        <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                          <Image
                            src={urlToDownload}
                            alt="Preview"
                            fill
                            className="object-contain"
                            unoptimized={urlToDownload.startsWith('http')}
                            onError={() => setFormError('无法加载图片，请检查URL是否正确')}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* 编辑时显示当前图片预览 */}
                  {editingFrame && editingFrame.imageUrl && uploadMethod !== 'url' && !pendingFile && !filePreview && !urlToDownload && (
                    <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                      <Image
                        src={editingFrame.imageUrl}
                        alt="Current"
                        fill
                        className="object-contain"
                        unoptimized={editingFrame.imageUrl.startsWith('http')}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  if (filePreview) {
                    URL.revokeObjectURL(filePreview)
                  }
                  setShowAddModal(false)
                  setShowEditModal(false)
                  setEditingFrame(null)
                  setFormData({ category: '', imageUrl: '' })
                  setFormError('')
                  setPendingFile(null)
                  setFilePreview(null)
                  setUploadMethod('file')
                  setUrlToDownload('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '提交中...' : '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {showDeleteModal && deletingFrame && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4 text-red-600">确认删除</h2>
            <p className="mb-6 text-gray-700">
              确定要删除头像框 ID {deletingFrame.id}（分类：{deletingFrame.category}）吗？此操作不可恢复。
            </p>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {formError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setDeletingFrame(null)
                  setFormError('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

