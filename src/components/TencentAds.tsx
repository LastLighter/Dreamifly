'use client'

import Script from 'next/script'
import { useEffect } from 'react'

// 扩展 Window 接口以支持 TencentGDT（队列与SDK对象的联合类型）
type TencentGDTNativeAPI = {
  renderAd: (ad: unknown, containerId: string) => void
  loadAd: (placementId: string) => void
}

type TencentGDTQueue = Array<unknown> & {
  // 数组 push 返回 number，更贴近真实行为
  push: (config: unknown) => number
  NATIVE?: TencentGDTNativeAPI
}

declare global {
  interface Window {
    TencentGDT?: TencentGDTQueue
  }
}

interface TencentAdsProps {
  appId?: string
  placementId: string
  containerId: string
  count?: number
}

export default function TencentAds({ appId = '1211628599', placementId, containerId, count = 1 }: TencentAdsProps) {
  useEffect(() => {
    // H5 SDK 在线文档地址：http://developers.adnet.qq.com/doc/web/js_develop
    // 全局命名空间申明TencentGDT对象
    if (typeof window !== 'undefined') {
      const queue: TencentGDTQueue = (window.TencentGDT as TencentGDTQueue) || ([] as unknown as TencentGDTQueue)
      window.TencentGDT = queue

      // 广告初始化
      window.TencentGDT.push({
        app_id: appId, // {String} - appid - 必填
        placement_id: placementId, // {String} - 广告位id - 必填
        type: 'native', // {String} - 原生广告类型 - 必填
        muid_type: '1', // {String} - 移动终端标识类型，1：imei，2：idfa，3：mac号 - 选填
        muid: '******', // {String} - 加密终端标识，详细加密算法见API说明 -  选填
        count, // {Number} - 拉取广告的数量，默认是3，最高支持10 - 选填
        onComplete: function(res: unknown) {
          if (Array.isArray(res)) {
            // 原生模板广告位调用 window.TencentGDT.NATIVE.renderAd(res[0], 'containerId') 进行模板广告的渲染
            // res[0] 代表取广告数组第一个数据
            // containerId：广告容器ID
            if (window.TencentGDT?.NATIVE) {
              window.TencentGDT.NATIVE.renderAd(res[0], containerId)
            }
          } else {
            // 加载广告API，如广告回调无广告，可使用loadAd再次拉取广告
            // 注意：拉取广告频率每分钟不要超过20次，否则会被广告接口过滤，影响广告位填充率
            setTimeout(() => {
              if (window.TencentGDT?.NATIVE) {
                window.TencentGDT.NATIVE.loadAd(placementId)
              }
            }, 3000)
          }
        }
      })
    }
  }, [])

  return (
    <Script
      src="//qzs.gdtimg.com/union/res/union_sdk/page/h5_sdk/i.js"
      strategy="afterInteractive"
      async
    />
  )
}

