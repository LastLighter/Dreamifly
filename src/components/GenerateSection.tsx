import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import GenerateForm from './GenerateForm'
import GeneratePreview from './GeneratePreview'
import StyleTransferForm from './StyleTransferForm'
import TabNavigation from './TabNavigation'
import PromptInput from './PromptInput'
import { optimizePrompt } from '../utils/promptOptimizer'
import { useSession } from '@/lib/auth-client'
import { generateDynamicTokenWithServerTime } from '@/utils/dynamicToken'
import { getModelThresholds, getAllModels } from '@/utils/modelConfig'
import { usePoints } from '@/contexts/PointsContext'
import { calculateEstimatedCost } from '@/utils/pointsClient'
import { transferUrl } from '@/utils/locale'

interface GenerateSectionProps {
  communityWorks: { prompt: string }[];
  initialPrompt?: string;
  initialModel?: string;
}

const GenerateSection = ({ communityWorks, initialPrompt, initialModel }: GenerateSectionProps) => {
  const t = useTranslations('home.generate')
  const tHome = useTranslations('home')
  const { data: session, isPending } = useSession()
  const { refreshPoints } = usePoints()
  const params = useParams()
  const locale = (params?.locale as string) || 'zh'
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  // 初始步数根据初始模型配置设置（如果提供了initialModel，使用它的配置；否则使用默认模型）
  const initialModelForSteps = initialModel || 'Z-Image-Turbo';
  const initialModelThresholds = getModelThresholds(initialModelForSteps);
  const [steps, setSteps] = useState(initialModelThresholds.normalSteps || 10);
  const [batch_size, setBatchSize] = useState(1);
  const [model, setModel] = useState(initialModel || 'Z-Image-Turbo');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [imageStatuses, setImageStatuses] = useState<Array<{
    status: 'pending' | 'success' | 'error';
    message: string;
    startTime?: number;
    endTime?: number;
  }>>([]);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'generate' | 'style-transfer'>('generate');
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [batchSizeError, setBatchSizeError] = useState<string | null>(null);
  const [imageCountError, setImageCountError] = useState<string | null>(null);
  const stepsRef = useRef<HTMLInputElement>(null);
  const batchSizeRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [concurrencyError, setConcurrencyError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorType, setErrorType] = useState<'concurrency' | 'daily_limit' | 'insufficient_points'>('concurrency');
  const [showLoginTip, setShowLoginTip] = useState(false);
  
  // 要设置为参考图片的生成图片 URL
  const [generatedImageToSetAsReference, setGeneratedImageToSetAsReference] = useState<string | null>(null);
  
  // 用户认证状态
  const authStatus = isPending ? 'loading' : (session?.user ? 'authenticated' : 'unauthenticated') as 'loading' | 'authenticated' | 'unauthenticated';

  // 当用户未登录时，强制将生成数量设置为1
  useEffect(() => {
    if (authStatus === 'unauthenticated' && batch_size > 1) {
      setBatchSize(1);
    }
  }, [authStatus, batch_size]);

  useEffect(() => {
    setPrompt(initialPrompt || '');
  }, [initialPrompt]);

  useEffect(() => {
    if (initialModel) {
      setModel(initialModel);
      // 同时更新步数到新模型的默认步数
      const modelThresholds = getModelThresholds(initialModel);
      if (modelThresholds.normalSteps !== null) {
        setSteps(modelThresholds.normalSteps);
      }
    }
  }, [initialModel]);

  // 处理设置生成的图片为参考图片
  const handleSetGeneratedImageAsReference = async (imageUrl: string) => {
    setGeneratedImageToSetAsReference(imageUrl);
  };

  // 清除 generatedImageToSetAsReference 状态，避免重复设置
  useEffect(() => {
    if (generatedImageToSetAsReference) {
      // 延迟清除，确保 GenerateForm 组件有时间处理
      const timer = setTimeout(() => {
        setGeneratedImageToSetAsReference(null);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [generatedImageToSetAsReference]);

  const handleGenerate = async () => {
    let hasError = false;
    setStepsError(null);
    setBatchSizeError(null);
    setImageCountError(null);
    setConcurrencyError(null);
    
    // 验证参考图片数量
    const models = [
      {
        id: "Qwen-Image-Edit",
        maxImages: 3,
        tags: ["chineseSupport", "fastGeneration"]
      },
      {
        id: "HiDream-full-fp8",
        maxImages: 0,
        tags: ["chineseSupport"]
      },
      {
        id: "Flux-Kontext",
        maxImages: 2,
        tags: []
      },
      {
        id: "Flux-Dev",
        maxImages: 1,
        tags: ["fastGeneration"]
      },
      {
        id: "Stable-Diffusion-3.5",
        maxImages: 0,
        tags: ["fastGeneration"]
      },
      {
        id: "Flux-Krea",
        maxImages: 0,
        tags: ["realisticStyle"]
      },
      {
        id: "Qwen-Image",
        maxImages: 0,
        tags: ["chineseSupport"]
      },
      {
        id: "Z-Image-Turbo",
        maxImages: 0,
        tags: ["chineseSupport", "fastGeneration"]
      }
    ];
    
    const currentModel = models.find(m => m.id === model);
    const maxImages = currentModel?.maxImages || 1;
    const supportsChinese = currentModel?.tags?.includes("chineseSupport") || false;
    
    // 首先检查图生图模型是否上传了图片（优先级最高，避免被后续逻辑覆盖）
    const allModels = getAllModels();
    const modelConfig = allModels.find(m => m.id === model);
    
    if (modelConfig) {
      // 如果模型只支持图生图（不支持文生图），必须上传图片
      if (modelConfig.use_i2i && !modelConfig.use_t2i && uploadedImages.length === 0) {
        setImageCountError(`${modelConfig.name} 需要上传图片才能生成`);
        hasError = true;
        
        // 滚动到错误位置
        window.setTimeout(() => {
          const uploadSection = document.querySelector('[data-image-upload-section]');
          if (uploadSection) {
            uploadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        
        // 直接返回，不继续后续验证，确保错误提示不被覆盖
        if (hasError) {
          return;
        }
      }
    }
    
    if (uploadedImages.length > maxImages) {
      setImageCountError(t('error.validation.imageCountLimit', { model, maxImages }));
      hasError = true;
    }
    
    // 验证步数：根据模型配置验证
    const thresholds = getModelThresholds(model);
    if (thresholds.normalSteps !== null && thresholds.highSteps !== null) {
      if (steps !== thresholds.normalSteps && steps !== thresholds.highSteps) {
        setStepsError(`步数只能选择${thresholds.normalSteps}或${thresholds.highSteps}`);
        stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasError = true;
      }
    }
    if (batch_size < 1 || batch_size > 2) {
      setBatchSizeError(t('error.validation.batchSizeRange'));
      batchSizeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasError = true;
    }
    if (width < 64 || width > 1440 || height < 64 || height > 1440) {
      widthRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      hasError = true;
    }
    if (hasError) return;

    // 检查是否为中文prompt
    const isChinesePrompt = /[\u4e00-\u9fa5]/.test(prompt);
    let finalPrompt = prompt;

    // 仅当prompt为中文且模型不支持中文时才进行优化
    if (isChinesePrompt && prompt.trim() && !supportsChinese) {
      setIsOptimizing(true);
      
      finalPrompt = await optimizePrompt(prompt);
      setPrompt(finalPrompt); // 更新UI显示优化后的prompt
      setIsOptimizing(false);
    } 
    
    if (selectedStyle) {
      finalPrompt = `${selectedStyle} style, ${finalPrompt}`;
    }

    setIsGenerating(true)
    setGeneratedImages([])
    setImageStatuses(Array(batch_size).fill({ status: 'pending', message: t('preview.generating') }))
    const images: string[] = Array(batch_size).fill('')

    // 判断是否需要间隔发送请求（登录用户且batch_size > 1）
    const shouldStaggerRequests = authStatus === 'authenticated' && batch_size > 1;
    
    const requests = Array(batch_size).fill(null).map((_, index) => {
      const startTime = Date.now();

      const makeRequest = async () => {
        try {
          // 如果是登录用户且需要间隔发送，第一个请求后等待0秒
          if (shouldStaggerRequests && index > 0) {
            await new Promise(resolve => setTimeout(resolve, 0 * index));
          }
          
          // 获取动态token（使用服务器时间）
          const token = await generateDynamicTokenWithServerTime()
          
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
              body: JSON.stringify({
              prompt: finalPrompt, // 使用优化后的prompt或原始prompt
              negative_prompt: negativePrompt.trim() || undefined, // 添加负面提示词
              width,
              height,
              steps,
              seed: Math.floor(Math.random() * 100000000),
              batch_size,
              model,
              images: uploadedImages,
            }),
          });

          // 检查是否是401未登录错误（图改图模型限制）
          if (res.status === 401) {
            const errorData = await res.json().catch(() => ({}));
            if (errorData.code === 'LOGIN_REQUIRED_FOR_I2I') {
              setShowLoginTip(true);
              setIsGenerating(false);
              setImageStatuses(prev => {
                const newStatuses = [...prev];
                newStatuses[index] = ({
                  status: 'error',
                  message: '需要登录'
                });
                return newStatuses;
              });
              return;
            }
          }

          // 处理402错误（积分不足）
          if (res.status === 402) {
            const errorData = await res.json();
            const errorMessage = errorData.error || '积分不足';
            setConcurrencyError(errorMessage);
            setErrorType('insufficient_points');
            setShowErrorModal(true);
            setIsGenerating(false);
            setImageStatuses(prev => {
              const newStatuses = [...prev];
              newStatuses[index] = ({
                status: 'error',
                message: '积分不足'
              });
              return newStatuses;
            });
            throw new Error('INSUFFICIENT_POINTS');
          }

          // 处理429错误（可能是并发限制或每日限额）
          if (res.status === 429) {
            const errorData = await res.json();
            const errorMessage = errorData.error || '请求过多，请稍后重试';
            const errorCode = errorData.code;
            
            // 根据错误代码区分错误类型
            // 支持 DAILY_LIMIT_EXCEEDED（登录用户）和 IP_DAILY_LIMIT_EXCEEDED（未登录用户）
            if (errorCode === 'DAILY_LIMIT_EXCEEDED' || errorCode === 'IP_DAILY_LIMIT_EXCEEDED') {
              setErrorType('daily_limit');
            } else {
              setErrorType('concurrency');
            }
            
            setConcurrencyError(errorMessage);
            setShowErrorModal(true);
            setIsGenerating(false);
            const isDailyLimit = errorCode === 'DAILY_LIMIT_EXCEEDED' || errorCode === 'IP_DAILY_LIMIT_EXCEEDED';
            throw new Error(isDailyLimit ? 'DAILY_LIMIT' : 'CONCURRENCY_LIMIT');
          }

          if (res.status !== 200) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }

          const data = await res.json();
          // Create a new promise to track image loading
          const imageLoadPromise = new Promise<void>((resolve) => {
            const img = new window.Image();
            img.onload = () => {
              const endTime = Date.now();
              const duration = ((endTime - startTime) / 1000).toFixed(1);
              images[index] = data.imageUrl;
              setGeneratedImages([...images]);
              setImageStatuses(prev => {
                const newStatuses = [...prev];
                newStatuses[index] = ({
                  status: 'success',
                  message: `${t('preview.completed')} (${duration}s)`,
                  startTime,
                  endTime
                });
                return newStatuses;
              });
              
              // 刷新积分显示和额度信息（如果用户已登录）
              if (session?.user) {
                refreshPoints().catch(err => {
                  console.error('Failed to refresh points:', err);
                });
                // 刷新额度信息
                const refreshQuota = async () => {
                  try {
                    const token = await generateDynamicTokenWithServerTime();
                    const response = await fetch(`/api/user/quota?t=${Date.now()}`, {
                      headers: {
                        'Authorization': `Bearer ${token}`
                      }
                    });
                    if (response.ok) {
                      const data = await response.json();
                      const quota = data.isAdmin ? true : (data.todayCount < (data.maxDailyRequests || 0));
                      setHasQuota(quota);
                    }
                  } catch (error) {
                    console.error('Failed to refresh quota:', error);
                  }
                };
                refreshQuota();
              }
              
              resolve();
            };
            img.src = data.imageUrl;
          });
          await imageLoadPromise;
        } catch (err) {
          console.error(`生成图片失败:`, err);

          // 如果是并发限制或每日限额错误，直接显示错误
          if (err instanceof Error && (err.message === 'CONCURRENCY_LIMIT' || err.message === 'DAILY_LIMIT')) {
            setImageStatuses(prev => {
              const newStatuses = [...prev];
              newStatuses[index] = ({
                status: 'error',
                message: err.message === 'DAILY_LIMIT' ? '每日限额已满' : '并发限制'
              });
              return newStatuses;
            });
            return;
          }

          // 直接显示错误，不进行重试
          setImageStatuses(prev => {
            const newStatuses = [...prev];
            newStatuses[index] = ({
              status: 'error',
              message: t('preview.error')
            });
            return newStatuses;
          });
        }
      };

      return makeRequest();
    });
    // 等待所有请求完成
    await Promise.allSettled(requests);
    setIsGenerating(false)
  }

  const handleRandomPrompt = () => {
    if (communityWorks.length === 0) return;
    const randomIndex = Math.floor(Math.random() * communityWorks.length);
    setPrompt(communityWorks[randomIndex].prompt);
  };

  const handleOptimizePrompt = async () => {
    console.log('优化提示词按钮被点击');
    console.log('当前提示词:', prompt);
    console.log('当前模型:', model);
    
    if (!prompt.trim()) {
      console.log('提示词为空，无法优化');
      // 如果没有提示词，可以显示提示信息
      return;
    }

    // 移除优化检查，允许用户随时优化提示词
    // 这样用户可以多次优化，尝试不同的效果
    console.log('开始优化提示词...');
    setIsOptimizing(true);
    try {
      const optimizedPrompt = await optimizePrompt(prompt, model);
      console.log('优化成功，结果:', optimizedPrompt);
      setPrompt(optimizedPrompt);
    } catch (error) {
      console.error('Failed to optimize prompt:', error);
      // 可以在这里添加错误提示
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleStyleTransfer = async (stylePrompt: string) => {
    if (uploadedImages.length === 0) return;
    
    setConcurrencyError(null);
    setIsGenerating(true);
    setGeneratedImages([]);
    setImageStatuses([{ status: 'pending', message: t('preview.generating') }]);
    
    try {
      const startTime = Date.now();
      
      // 获取动态token（使用服务器时间）
      const token = await generateDynamicTokenWithServerTime()
      
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: stylePrompt,
          negative_prompt: negativePrompt.trim() || undefined, // 添加负面提示词
          width: 1024,
          height: 1024,
          steps: 25,
          seed: Math.floor(Math.random() * 100000000),
          batch_size: 1,
          model: 'Qwen-Image-Edit',
          images: uploadedImages,
        }),
      });

      // 检查是否是401未登录错误（图改图模型限制）
      if (res.status === 401) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.code === 'LOGIN_REQUIRED_FOR_I2I') {
          setShowLoginTip(true);
          setIsGenerating(false);
          setImageStatuses([{
            status: 'error',
            message: '需要登录'
          }]);
          return;
        }
      }

      // 处理429错误（可能是并发限制或每日限额）
      if (res.status === 429) {
        const errorData = await res.json();
        const errorMessage = errorData.error || '请求过多，请稍后重试';
        const errorCode = errorData.code;
        
        // 根据错误代码区分错误类型
        // 支持 DAILY_LIMIT_EXCEEDED（登录用户）和 IP_DAILY_LIMIT_EXCEEDED（未登录用户）
        const isDailyLimit = errorCode === 'DAILY_LIMIT_EXCEEDED' || errorCode === 'IP_DAILY_LIMIT_EXCEEDED';
        if (isDailyLimit) {
          setErrorType('daily_limit');
        } else {
          setErrorType('concurrency');
        }
        
        setConcurrencyError(errorMessage);
        setShowErrorModal(true);
        setIsGenerating(false);
        setImageStatuses([{
          status: 'error',
          message: isDailyLimit ? '每日限额已满' : '并发限制'
        }]);
        return;
      }

      if (res.status !== 200) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      
      // 创建图片加载Promise来跟踪加载状态
      const imageLoadPromise = new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => {
          const endTime = Date.now();
          const duration = ((endTime - startTime) / 1000).toFixed(1);
          setGeneratedImages([data.imageUrl]);
          setImageStatuses([{
            status: 'success',
            message: `${t('preview.completed')} (${duration}s)`,
            startTime,
            endTime
          }]);
          
          // 刷新积分显示和额度信息（如果用户已登录）
          if (session?.user) {
            refreshPoints().catch(err => {
              console.error('Failed to refresh points:', err);
            });
            // 刷新额度信息
            const refreshQuota = async () => {
              try {
                const token = await generateDynamicTokenWithServerTime();
                const response = await fetch(`/api/user/quota?t=${Date.now()}`, {
                  headers: {
                    'Authorization': `Bearer ${token}`
                  }
                });
                if (response.ok) {
                  const data = await response.json();
                  const quota = data.isAdmin ? true : (data.todayCount < (data.maxDailyRequests || 0));
                  setHasQuota(quota);
                }
              } catch (error) {
                console.error('Failed to refresh quota:', error);
              }
            };
            refreshQuota();
          }
          
          resolve();
        };
        img.src = data.imageUrl;
      });
      
      await imageLoadPromise;
    } catch (err) {
      console.error('风格转换失败:', err);
      setImageStatuses([{
        status: 'error',
        message: t('preview.error')
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const [aspectRatio, setAspectRatio] = useState('1:1');

  const handleRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    const [wStr, hStr] = ratio.split(':');
    const w = parseInt(wStr);
    const h = parseInt(hStr);
    const area = 1024 * 1024;
    const ratioNum = w / h;
    let newWidth = Math.round(Math.sqrt(area * ratioNum) / 8) * 8;
    let newHeight = Math.round(newWidth / ratioNum / 8) * 8;
    // Adjust if necessary to better match area
    if (newWidth * newHeight < area * 0.9 || newWidth * newHeight > area * 1.1) {
      newHeight = Math.round(Math.sqrt(area / ratioNum) / 8) * 8;
      newWidth = Math.round(newHeight * ratioNum / 8) * 8;
    }
    
    // 确保尺寸在允许范围内（64-1440）
    const maxDimension = 1440;
    const minDimension = 64;
    
    // 如果宽度或高度超过限制，按比例缩放
    if (newWidth > maxDimension || newHeight > maxDimension) {
      const scale = Math.min(maxDimension / newWidth, maxDimension / newHeight);
      newWidth = Math.round(newWidth * scale / 8) * 8;
      newHeight = Math.round(newHeight * scale / 8) * 8;
    }
    
    // 确保最小尺寸，同时保持比例
    if (newWidth < minDimension || newHeight < minDimension) {
      // 根据比例确定哪个维度是限制因素
      if (ratioNum >= 1) {
        // 横向或正方形：宽度优先
        newWidth = Math.max(newWidth, Math.round(minDimension / 8) * 8);
        newHeight = Math.round(newWidth / ratioNum / 8) * 8;
        // 如果高度仍然太小，以高度为准
        if (newHeight < minDimension) {
          newHeight = Math.round(minDimension / 8) * 8;
          newWidth = Math.round(newHeight * ratioNum / 8) * 8;
        }
      } else {
        // 纵向：高度优先
        newHeight = Math.max(newHeight, Math.round(minDimension / 8) * 8);
        newWidth = Math.round(newHeight * ratioNum / 8) * 8;
        // 如果宽度仍然太小，以宽度为准
        if (newWidth < minDimension) {
          newWidth = Math.round(minDimension / 8) * 8;
          newHeight = Math.round(newWidth / ratioNum / 8) * 8;
        }
      }
    }
    
    // 最终确保不超过最大限制，同时保持比例
    if (newWidth > maxDimension || newHeight > maxDimension) {
      const scale = Math.min(maxDimension / newWidth, maxDimension / newHeight);
      newWidth = Math.round(newWidth * scale / 8) * 8;
      newHeight = Math.round(newHeight * scale / 8) * 8;
    }
    
    setWidth(newWidth);
    setHeight(newHeight);
  };

  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  
  // 计算预计积分消耗（仅对已登录用户）
  const [modelBaseCost, setModelBaseCost] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [hasQuota, setHasQuota] = useState<boolean | null>(null);
  const [extraCost, setExtraCost] = useState<number | null>(null);
  
  // 获取模型基础积分消耗（仅对已登录用户）
  useEffect(() => {
    // 如果用户未登录，不获取积分消耗
    if (authStatus !== 'authenticated') {
      setModelBaseCost(null);
      setEstimatedCost(null);
      setHasQuota(null);
      setExtraCost(null);
      return;
    }

    const fetchModelBaseCost = async () => {
      try {
        const response = await fetch(`/api/points/model-base-cost?modelId=${encodeURIComponent(model)}`);
        if (response.ok) {
          const data = await response.json();
          setModelBaseCost(data.baseCost);
        } else {
          setModelBaseCost(null);
        }
      } catch (error) {
        console.error('Failed to fetch model base cost:', error);
        setModelBaseCost(null);
      }
    };

    fetchModelBaseCost();
  }, [model, authStatus]);
  
  // 获取用户额度信息（仅对已登录用户）
  useEffect(() => {
    if (authStatus !== 'authenticated') {
      setHasQuota(null);
      return;
    }

    const fetchQuota = async () => {
      try {
        const token = await generateDynamicTokenWithServerTime();
        const response = await fetch(`/api/user/quota?t=${Date.now()}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          // 管理员不限次，视为有额度
          const quota = data.isAdmin ? true : (data.todayCount < (data.maxDailyRequests || 0));
          setHasQuota(quota);
        } else {
          setHasQuota(null);
        }
      } catch (error) {
        console.error('Failed to fetch quota:', error);
        setHasQuota(null);
      }
    };

    fetchQuota();
    
    // 定期刷新额度信息（每30秒）
    const interval = setInterval(() => {
      if (authStatus === 'authenticated') {
        fetchQuota();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [authStatus]);
  
  // 计算预计消耗和额外消耗（仅对已登录用户）
  useEffect(() => {
    // 如果用户未登录，不计算预计消耗
    if (authStatus !== 'authenticated') {
      setEstimatedCost(null);
      setExtraCost(null);
      return;
    }

    if (modelBaseCost !== null) {
      // 计算总消耗（不考虑额度）
      const totalCost = calculateEstimatedCost(modelBaseCost, model, steps, width, height);
      // 乘以批次大小
      const totalCostWithBatch = totalCost !== null ? totalCost * batch_size : null;
      
      // 计算有额度时需要扣除的积分（总消耗 - 基础消耗）
      if (totalCostWithBatch !== null && hasQuota !== null) {
        const baseCostWithBatch = modelBaseCost * batch_size;
        if (hasQuota) {
          // 有额度：显示额外消耗（总消耗 - 基础消耗）
          setEstimatedCost(Math.max(0, totalCostWithBatch - baseCostWithBatch));
        } else {
          // 无额度：显示全部消耗
          setEstimatedCost(totalCostWithBatch);
        }
      } else {
        setEstimatedCost(null);
      }
      
      // 计算额外消耗（无额度时的基础积分消耗）- 无论是否有额度都显示
      setExtraCost(modelBaseCost * batch_size);
    } else {
      setEstimatedCost(null);
      setExtraCost(null);
    }
  }, [modelBaseCost, model, steps, width, height, batch_size, authStatus, hasQuota]);

  return (
    <section id="generate-section" className="py-10 sm:py-12 lg:py-6 relative">
      <div className="w-full max-w-[1260px] mx-auto relative px-3 sm:px-5">
        {/* Tab Navigation */}
        <TabNavigation 
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Prompt Input Section - Only show for generate tab */}
        {activeTab === 'generate' && (
          <div className="mb-7 animate-fadeInUp z-[20] relative">
            <div className="relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl lg:p-5 p-3 border border-orange-400/40">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-100/10 to-amber-100/10 rounded-3xl"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(249,115,22,0.1),rgba(255,255,255,0))] shadow-orange-400/20"></div>
              
              <div className="relative">
                <PromptInput
                  prompt={prompt}
                  setPrompt={setPrompt}
                  negativePrompt={negativePrompt}
                  setNegativePrompt={setNegativePrompt}
                  onGenerate={handleGenerate}
                  onRandomPrompt={handleRandomPrompt}
                  onOptimizePrompt={handleOptimizePrompt}
                  isGenerating={isGenerating}
                  isOptimizing={isOptimizing}
                  communityWorks={communityWorks}
                  promptRef={promptRef}
                  aspectRatio={aspectRatio}
                  onRatioChange={handleRatioChange}
                  selectedStyle={selectedStyle}
                  onStyleChange={setSelectedStyle}
                  isQueuing={isQueuing}
                  estimatedCost={estimatedCost}
                  extraCost={extraCost}
                />
              </div>
            </div>
          </div>
        )}

        {/* Form and Preview Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12 items-start">
          {/* 左侧表单区域 */}
          <div className="order-1 lg:order-1 lg:col-span-2 animate-fadeInUp h-fit z-10">
            <div className="transition-all duration-500 ease-in-out">
              {activeTab === 'generate' ? (
                <div className="animate-fadeInUp">
                  <GenerateForm
                    width={width}
                    setWidth={setWidth}
                    height={height}
                    setHeight={setHeight}
                    steps={steps}
                    setSteps={setSteps}
                    batch_size={batch_size}
                    setBatchSize={setBatchSize}
                    model={model}
                    setModel={setModel}
                    status={authStatus}
                    onGenerate={handleGenerate}
                    isAdvancedOpen={isAdvancedOpen}
                    setIsAdvancedOpen={setIsAdvancedOpen}
                    promptRef={promptRef}
                    communityWorks={communityWorks}
                    isGenerating={isGenerating}
                    uploadedImages={uploadedImages}
                    setUploadedImages={setUploadedImages}
                    stepsError={stepsError}
                    batchSizeError={batchSizeError}
                    imageCountError={imageCountError}
                    batchSizeRef={batchSizeRef}
                    generatedImageToSetAsReference={generatedImageToSetAsReference}
                    setIsQueuing={setIsQueuing}
                  />
                </div>
              ) : (
                <div className="animate-fadeInUp">
                  <StyleTransferForm
                    uploadedImages={uploadedImages}
                    setUploadedImages={setUploadedImages}
                    onStyleTransfer={handleStyleTransfer}
                    isGenerating={isGenerating}
                    authStatus={authStatus}
                    setIsQueuing={setIsQueuing}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 右侧预览区域 */}
          <div className="order-2 lg:order-2 lg:col-span-3 animate-fadeInUp animation-delay-200">
            <GeneratePreview
              generatedImages={generatedImages}
              imageStatuses={imageStatuses}
              batch_size={activeTab === 'style-transfer' ? 1 : batch_size}
              isGenerating={isGenerating}
              setZoomedImage={setZoomedImage}
              onSetAsReference={handleSetGeneratedImageAsReference}
            />
          </div>
        </div>
      </div>

      {/* 错误模态框（并发限制或每日限额） */}
      {showErrorModal && concurrencyError && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeInUp"
          onClick={() => setShowErrorModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 错误图标 */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            {/* 标题 */}
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">
              {errorType === 'daily_limit' 
                ? '每日限额已满' 
                : errorType === 'insufficient_points'
                ? '积分不足'
                : '并发限制'}
            </h3>
            
            {/* 错误消息 */}
            <p className="text-gray-600 text-center mb-6">
              {concurrencyError}
            </p>
            
            {/* 提示信息 */}
            {errorType === 'daily_limit' ? (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-6 rounded">
                <p className="text-sm text-blue-800">
                  💡 提示：每日限额将在次日重置，请明天再试
                </p>
              </div>
            ) : errorType === 'insufficient_points' ? (
              <div className="bg-orange-50 border-l-4 border-orange-500 p-3 mb-6 rounded">
                <p className="text-sm text-orange-800">
                  💡 提示：订阅会员可享受更多积分和权益
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border-l-4 border-amber-500 p-3 mb-6 rounded">
                <p className="text-sm text-amber-800">
                  💡 提示：请等待其他标签页的生图任务完成后再试
                </p>
              </div>
            )}
            
            {/* 按钮区域 */}
            {errorType === 'insufficient_points' ? (
              <div className="flex flex-col gap-3">
                <Link
                  href={transferUrl('/pricing', locale)}
                  onClick={() => setShowErrorModal(false)}
                  className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-300 shadow-lg hover:shadow-xl text-center"
                >
                  前往订阅会员
                </Link>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="w-full px-6 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition-all duration-300"
                >
                  我知道了
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowErrorModal(false)}
                className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-amber-600 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                我知道了
              </button>
            )}
          </div>
        </div>
      )}

      {/* 未登录提示框 */}
      {showLoginTip && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 relative">
            <button
              aria-label="Close"
              onClick={() => setShowLoginTip(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex flex-col items-center gap-4 text-center">
              <div className="p-3 rounded-full bg-orange-100 text-orange-600">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900">该功能仅限登录用户使用</h3>
                <p className="text-sm text-gray-600">
                  请先登录后再使用图改图功能
                </p>
              </div>

              <button
                onClick={() => setShowLoginTip(false)}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
              >
                知道啦
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片放大模态框 */}
      {zoomedImage && (
        <div
                      className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-4 animate-fadeInUp"
          onClick={() => setZoomedImage(null)}
        >
          {/* 顶部控制栏 */}
          <div className="w-full max-w-[1400px] flex justify-end mb-4">
            <button
              className="p-2 text-orange-300 hover:text-orange-100 transition-colors hover:scale-110 transform duration-300 bg-orange-800/50 rounded-full hover:bg-orange-700/50"
              onClick={(e) => {
                e.stopPropagation();
                setZoomedImage(null);
              }}
              aria-label={tHome('banner.closeButton')}
            >
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 图片容器 */}
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-full max-w-[1400px] max-h-[calc(100vh-8rem)] flex items-center justify-center">
              <img
                src={zoomedImage}
                alt="Zoomed preview"
                className="max-w-full max-h-[calc(100vh-8rem)] w-auto h-auto object-contain rounded-lg shadow-2xl border border-orange-400/30 animate-scaleIn"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* 底部提示 */}
          <div className="w-full max-w-[1400px] mt-4 text-center text-sm text-orange-200/60">
            <p>{tHome('preview.closeHint')}</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default GenerateSection 