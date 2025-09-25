import { useTranslations } from 'next-intl'

interface GeneratePreviewProps {
  generatedImages: string[];
  imageStatuses: Array<{
    status: 'pending' | 'success' | 'error';
    message: string;
  }>;
  batch_size: number;
  isGenerating: boolean;
  setZoomedImage: (image: string) => void;
  onSetAsReference?: (image: string) => void;
  onDownloadImage?: (image: string, index: number) => void;
}

export default function GeneratePreview({
  generatedImages,
  imageStatuses,
  batch_size,
  isGenerating,
  setZoomedImage,
  onSetAsReference,
  onDownloadImage
}: GeneratePreviewProps) {
  const t = useTranslations('home.generate')

  const handleDownloadImage = (image: string, index: number) => {
    if (onDownloadImage) {
      onDownloadImage(image, index);
    } else {
      // 默认下载行为
      const link = document.createElement('a');
      link.href = image;
      link.download = `generated-image-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSetAsReference = (image: string) => {
    if (onSetAsReference) {
      onSetAsReference(image);
    }
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-xl sm:shadow-2xl p-4 sm:p-8 border border-orange-400/40 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <img src="/common/preview.svg" alt="Preview" className="w-6 h-6 text-gray-900" />
          <h2 className="text-xl font-semibold text-gray-900">{t('preview.title')}</h2>
        </div>
        {generatedImages && generatedImages.length > 0 && (
          <button
            onClick={() => {
              generatedImages.forEach((image, index) => {
                const link = document.createElement('a');
                link.href = image;
                link.download = `generated-image-${index + 1}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              });
            }}
            className="group px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 text-white rounded-xl hover:from-amber-300 hover:to-yellow-300 transition-all duration-300 shadow-lg shadow-orange-400/20 hover:shadow-xl hover:shadow-orange-400/30 hover:-translate-y-0.5 relative overflow-hidden"
          >
            <span className="relative z-10">{t('preview.download')}</span>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>
        )}
      </div>
      <div
        className={
          batch_size === 1
            ? 'grid grid-cols-1 grid-rows-1 flex-grow'
            : batch_size === 2
            ? 'grid grid-cols-1 grid-rows-2 gap-4 sm:gap-8 flex-grow'
            : 'grid grid-cols-2 grid-rows-2 gap-4 sm:gap-8 flex-grow'
        }
      >
        {Array.from({ length: batch_size }).map((_, index) => (
          <div
            key={index}
            className={
              batch_size === 1
                ? 'aspect-square relative rounded-2xl bg-white/80 backdrop-blur-sm border border-orange-400/40 transform hover:scale-[1.02] transition-transform duration-300 col-span-1 row-span-1 group'
                : batch_size === 2
                ? 'aspect-[1/0.5] relative rounded-2xl bg-white/80 backdrop-blur-sm border border-orange-400/40 transform hover:scale-[1.02] transition-transform duration-300 col-span-1 row-span-1 group'
                : 'aspect-square relative rounded-2xl bg-white/80 backdrop-blur-sm border border-orange-400/40 transform hover:scale-[1.02] transition-transform duration-300 group'
            }
          >
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              {generatedImages[index] && (
                <img
                  src={generatedImages[index]}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-full object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
                  onClick={() => setZoomedImage(generatedImages[index])}
                />
              )}
              <div className={`absolute bottom-0 left-0 right-0 p-4 text-center text-sm backdrop-blur-md ${imageStatuses[index]?.status === 'error'
                  ? 'bg-red-500/20 text-red-900'
                  : imageStatuses[index]?.status === 'success'
                    ? 'bg-white/40 text-gray-900'
                    : 'bg-green-500/20 text-green-900'
                }`}>
                <div className="flex items-center justify-center gap-2">
                  {imageStatuses[index]?.status === 'pending' && (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span className={`font-medium ${imageStatuses[index]?.status === 'error' ? 'text-red-900' : imageStatuses[index]?.status === 'success' ? 'text-yellow-700' : 'text-green-900'}`}>
                    {imageStatuses[index]?.message}
                  </span>
                </div>
              </div>
              {isGenerating && !imageStatuses[index]?.status && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-700/50 backdrop-blur-sm">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-400 border-t-transparent"></div>
                </div>
              )}
              {!isGenerating && !imageStatuses[index]?.status && !generatedImages[index] && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="text-gray-600/50">{t('preview.placeholder')}</div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Hover Menu - 在 overflow-hidden 容器外部 */}
            {generatedImages[index] && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                <div className="bg-white/90 backdrop-blur-md rounded-xl border border-orange-400/40 shadow-xl p-3 flex gap-2">
                  {/* Set as Reference Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetAsReference(generatedImages[index]);
                    }}
                    className="relative p-2.5 bg-white/80 hover:bg-yellow-100/80 rounded-lg transition-colors duration-200 group/btn"
                    title="设置为参考图片"
                  >
                    <svg className="w-4 h-4 text-yellow-500 group-hover/btn:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-white/95 text-gray-900 text-xs rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-20">
                      设置为参考图片
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900/95"></div>
                    </div>
                  </button>
                  
                  {/* Download Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadImage(generatedImages[index], index);
                    }}
                    className="relative p-2.5 bg-white/80 hover:bg-yellow-100/80 rounded-lg transition-colors duration-200 group/btn"
                    title="下载图片"
                  >
                    <svg className="w-4 h-4 text-yellow-500 group-hover/btn:text-yellow-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-white/95 text-gray-900 text-xs rounded-lg opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-20">
                      下载图片
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900/95"></div>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 text-center text-sm text-gray-600/80">
        {t('preview.hint')}
      </div>
      {imageStatuses.length > 0 && (
        <div className="mt-4 text-center text-sm">
          <span className="text-yellow-800 font-medium">
            {imageStatuses.filter(status => status.status === 'pending').length}
          </span>
          <span className="text-gray-900">
            {t('preview.status.generating')}
          </span>
          <span className="text-yellow-800 font-medium mx-2">
            {imageStatuses.filter(status => status.status === 'success').length}
          </span>
          <span className="text-gray-900">
            {t('preview.status.success')}
          </span>
          <span className="text-red-900 font-medium mx-2">
            {imageStatuses.filter(status => status.status === 'error').length}
          </span>
          <span className="text-gray-900">
            {t('preview.status.failed')}
          </span>
        </div>
      )}
    </div>
  )
} 