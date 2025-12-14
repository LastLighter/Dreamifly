import { useTranslations } from 'next-intl'
import { useState, useRef, useEffect } from 'react';
import { styleOptions } from './StyleTransferForm';
import LoginHint from './LoginHint';

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  negativePrompt?: string;
  setNegativePrompt?: (prompt: string) => void;
  onGenerate: () => void;
  onRandomPrompt: () => void;
  onOptimizePrompt: () => void;
  isGenerating: boolean;
  isOptimizing: boolean;
  communityWorks: { prompt: string }[];
  promptRef: React.RefObject<HTMLTextAreaElement | null>;
  aspectRatio: string;
  onRatioChange: (ratio: string) => void;
  selectedStyle: string | null;
  onStyleChange: (style: string) => void;
  isQueuing?: boolean;
  estimatedCost?: number | null;
  extraCost?: number | null;
}

const PromptInput = ({
  prompt,
  setPrompt,
  negativePrompt = '',
  setNegativePrompt,
  onGenerate,
  onRandomPrompt,
  onOptimizePrompt,
  isGenerating,
  isOptimizing,
  promptRef,
  aspectRatio,
  onRatioChange,
  selectedStyle,
  onStyleChange,
  isQueuing = false,
  estimatedCost = null,
  extraCost = null
}: PromptInputProps) => {
  const t = useTranslations('home.generate')
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [isNegativePromptEnabled, setIsNegativePromptEnabled] = useState(false);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const ratioDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(event.target as Node)) {
        setIsStyleOpen(false);
      }
      if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(event.target as Node)) {
        setIsRatioOpen(false);
      }
    };

    if (isStyleOpen || isRatioOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStyleOpen, isRatioOpen]);

  const ratios = ['10:3', '16:9', '3:2', '1:1', '2:3', '9:16'];

  return (
    <div>
      <label htmlFor="prompt" className="flex items-center text-xs font-medium text-gray-800 mb-2.5">
        <img src="/form/prompt.svg" alt="Prompt" className="w-4 h-4 mr-1.5 text-gray-800 [&>path]:fill-current" />
        {t('form.prompt.label')}
      </label>
      <div className="flex flex-col gap-4">
        <textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full h-28 px-4 py-3 bg-white/95 backdrop-blur-sm border border-amber-400/40 rounded-2xl focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 resize-none shadow-inner transition-all duration-300 text-gray-900 placeholder-gray-500 text-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          placeholder={t('form.prompt.placeholder')}
          ref={promptRef}
        />

        {/* 负面提示词 Toggle Switch */}
        <div className="flex items-center justify-between py-2">
          <label htmlFor="negative-prompt-toggle" className="flex items-center text-xs font-medium text-gray-800">
            <img src="/form/prompt.svg" alt="Negative Prompt" className="w-4 h-4 mr-1.5 text-gray-800 [&>path]:fill-current" />
            负面提示词
          </label>
          <button
            type="button"
            id="negative-prompt-toggle"
            onClick={() => setIsNegativePromptEnabled(!isNegativePromptEnabled)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 ${
              isNegativePromptEnabled ? 'bg-amber-400' : 'bg-gray-200'
            }`}
            disabled={isGenerating}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isNegativePromptEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* 负面提示词输入表单 */}
        {isNegativePromptEnabled && (
          <div className="transition-all duration-300 ease-in-out">
            <textarea
              id="negative-prompt"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt?.(e.target.value)}
              className="w-full h-20 px-4 py-3 bg-white/95 backdrop-blur-sm border border-red-400/40 rounded-2xl focus:ring-2 focus:ring-red-400/50 focus:border-red-400/50 resize-none shadow-inner transition-all duration-300 text-gray-900 placeholder-gray-500 text-sm [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              placeholder="输入不希望出现在图像中的内容..."
            />
          </div>
        )}

        <div className="flex flex-col md:flex-row md:justify-between gap-3 items-stretch md:items-center">
          <div className="flex gap-2 md:gap-3">
            <button
              type="button"
              onClick={onRandomPrompt}
              className="px-2 py-1 text-xs md:px-3 md:py-2 md:text-sm rounded-xl bg-white/95 border border-amber-400/40 text-gray-900 hover:bg-amber-50/50 hover:border-amber-400/50 transition-all duration-300 shadow-md shadow-amber-400/10 hover:shadow-lg hover:shadow-amber-400/20 whitespace-nowrap flex items-center"
              disabled={isGenerating}
            >
              <svg className="w-3 h-3 mr-1 md:w-4 md:h-4 text-orange-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              {t('form.randomPrompt')}
            </button>
            <button
              type="button"
              onClick={() => setIsStyleOpen(!isStyleOpen)}
              className="px-3 py-1 text-xs md:px-4 md:py-2 md:text-sm rounded-xl bg-white/95 border border-amber-400/40 text-gray-900 hover:bg-amber-50/50 hover:border-amber-400/50 transition-all duration-300 shadow-md shadow-amber-400/10 hover:shadow-lg hover:shadow-amber-400/20 whitespace-nowrap flex items-center relative"
              disabled={isGenerating}
            >
              <svg className="w-3 h-3 mr-1 md:w-4 md:h-4 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path>
              </svg>
              {selectedStyle || t('form.styleButton')}
              {isStyleOpen && (
                <div ref={styleDropdownRef} className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white/95 border border-amber-400/40 rounded-xl shadow-xl p-4 grid grid-cols-3 gap-x-2 gap-y-4 min-w-[450px] z-50 justify-items-center">
                  {styleOptions.map(style => (
                    <div
                      key={style.id}
                      onClick={() => {
                        onStyleChange(style.name);
                        setIsStyleOpen(false);
                      }}
                      className="cursor-pointer relative w-24 h-24 hover:opacity-90 transition-opacity rounded-lg overflow-hidden"
                    >
                      <img src={style.previewImage} alt={style.name} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm py-1 text-center">
                        <p className="text-xs text-gray-900">{t(`form.styleTransfer.styles.${style.name}`)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </button>
            <div
              onClick={() => setIsRatioOpen(!isRatioOpen)}
              className="px-3 py-1 text-xs md:px-4 md:py-2 md:text-sm rounded-xl bg-white/95 border border-amber-400/40 text-gray-900 hover:bg-amber-50/50 hover:border-amber-400/50 transition-all duration-300 shadow-md shadow-amber-400/10 hover:shadow-lg hover:shadow-amber-400/20 whitespace-nowrap flex items-center relative cursor-pointer"
              tabIndex={0}
              role="button"
              aria-disabled={isGenerating}
            >
              <svg className="w-3 h-3 mr-1 md:w-4 md:h-4 text-orange-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5z"></path>
              </svg>
              {aspectRatio}
              {isRatioOpen && (
                <div ref={ratioDropdownRef} className="absolute top-full left-0 mt-2 bg-white/95 border border-amber-400/40 rounded-xl shadow-xl p-2 min-w-[150px]">
                  {ratios.map(r => {
                    const [rw, rh] = r.split(':').map(Number);
                    const isHorizontal = rw >= rh;
                    const rectWidth = 20;
                    const rectHeight = isHorizontal ? Math.round(rectWidth * rh / rw) : Math.round(rectWidth * rw / rh);
                    const rectStyle = isHorizontal ? {width: `${rectWidth}px`, height: `${rectHeight}px`} : {width: `${rectHeight}px`, height: `${rectWidth}px`};
                    return (
                      <div
                        key={r}
                        onClick={() => { onRatioChange(r); setIsRatioOpen(false); }}
                        className="flex items-center px-3 py-2 text-sm text-gray-900 hover:bg-gray-100/50 w-full rounded-lg cursor-pointer"
                      >
                        <div className="bg-amber-400/40 mr-2" style={rectStyle}></div>
                        {r}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onOptimizePrompt}
              className="px-2 py-1 text-xs md:px-3 md:py-2 md:text-sm rounded-xl bg-white/95 border border-amber-400/40 text-gray-900 hover:bg-amber-50/50 hover:border-amber-400/50 transition-all duration-300 shadow-md shadow-amber-400/10 hover:shadow-lg hover:shadow-amber-400/20 whitespace-nowrap flex items-center"
              disabled={isGenerating || isOptimizing || !prompt.trim()}
            >
              <svg className="w-3 h-3 mr-1 md:w-4 md:h-4 text-amber-900" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
              </svg>
              {isOptimizing ? t('form.optimizingPrompt') || 'Optimizing...' : t('form.optimizePrompt')}
            </button>
          </div>
          <div className="flex flex-col items-center gap-2 w-full md:w-auto md:min-w-[280px]">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating || isOptimizing}
              className="w-full px-4 py-2 text-sm md:px-6 md:py-3 md:text-base font-semibold rounded-2xl bg-white/95 text-gray-900 hover:bg-amber-50/95 transition-all duration-500 shadow-xl shadow-amber-400/20 hover:shadow-2xl hover:shadow-amber-400/30 hover:-translate-y-0.5 transform border border-amber-400/40 relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {/* 高级光效背景 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out"></div>
              
              {/* 微妙的发光效果 */}
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 via-transparent to-orange-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <span className="relative z-10 flex items-center justify-center font-bold">
                {isGenerating ? (
                  isQueuing ? (
                    <>
                      {/* 排队中 - 黄色时钟图标 */}
                      <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-amber-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
                        <path className="opacity-75" fill="currentColor" d="M12 6v6l4 2"></path>
                        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('form.progress.status.queuing')}
                    </>
                  ) : (
                    <>
                      {/* 生图中 - 绿色spinner */}
                      <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t('form.generateButton.loading')}
                    </>
                  )
                ) : isOptimizing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('form.optimizingPrompt') || 'Optimizing...'}
                  </>
                ) : (
                  <>
                    <svg className="mr-1.5 h-4 w-4 md:mr-2 md:h-5 md:w-5 text-orange-500" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
                      <path fill="currentColor" d="M640 224A138.666667 138.666667 0 0 0 778.666667 85.333333h64A138.666667 138.666667 0 0 0 981.333333 224v64A138.666667 138.666667 0 0 0 842.666667 426.666667h-64A138.666667 138.666667 0 0 0 640 288v-64zM170.666667 298.666667a85.333333 85.333333 0 0 1 85.333333-85.333334h298.666667V128H256a170.666667 170.666667 0 0 0-170.666667 170.666667v426.666666a170.666667 170.666667 0 0 0 170.666667 170.666667h512a170.666667 170.666667 0 0 0 170.666667-170.666667v-213.333333h-85.333334v213.333333a85.333333 85.333333 0 0 1-85.333333 85.333334H256a85.333333 85.333333 0 0 1-85.333333-85.333334V298.666667z"></path>
                    </svg>
                    {t('form.generateButton.default')}
                  </>
                )}
              </span>
              
              {/* 预计消耗积分数 - 显示在按钮右下角 */}
              {estimatedCost !== null && !isGenerating && !isOptimizing && (
                <div className="absolute bottom-1.5 right-2.5 flex items-center gap-0.5 bg-amber-100/90 px-1.5 py-0.5 rounded-full backdrop-blur-sm border border-amber-300/70 shadow-sm">
                  <svg className="w-2.5 h-2.5 text-amber-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  <span className="text-[10px] md:text-xs text-amber-700 font-semibold">{estimatedCost}</span>
                </div>
              )}
            </button>
            <LoginHint className="text-xs md:text-sm" />
            {/* 额外消耗提示 - 仅对已登录用户显示，无论是否有额度都显示 */}
            {extraCost !== null && extraCost > 0 && (
              <div className="flex items-center gap-2 text-xs md:text-sm text-gray-600 whitespace-nowrap">
                <svg
                  className="w-4 h-4 text-amber-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>若当前无额度将额外消耗{extraCost}积分</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PromptInput
