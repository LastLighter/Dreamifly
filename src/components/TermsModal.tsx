'use client'

import { useTranslations } from 'next-intl'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const t = useTranslations('auth.terms')
  const effectiveDate = t('effectiveDate')

  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="prose max-w-none">
            {effectiveDate && effectiveDate.trim() && (
              <p className="text-sm text-gray-600 mb-6">{effectiveDate}</p>
            )}

            {/* 一、导言 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section1.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section1.item1')}</p></li>
                <li><p>{t('section1.item2')}</p></li>
                <li><p>{t('section1.item3')}</p></li>
                <li><p>{t('section1.item4')}</p></li>
                <li><p>{t('section1.item5')}</p></li>
              </ul>
            </section>

            {/* 二、服务与许可 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section2.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section2.item1')}</p></li>
                <li><p>{t('section2.item2')}</p></li>
                <li><p>{t('section2.item3')}</p></li>
              </ul>
            </section>

            {/* 三、用户账户 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section3.title')}
              </h3>
              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">
                {t('section3.subsection1.title')}
              </h4>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6 mb-4">
                <li><p>{t('section3.subsection1.item1')}</p></li>
                <li><p>{t('section3.subsection1.item2')}</p></li>
                <li><p>{t('section3.subsection1.item3')}</p></li>
                <li><p>{t('section3.subsection1.item4')}</p></li>
                <li><p>{t('section3.subsection1.item5')}</p></li>
                <li><p>{t('section3.subsection1.item6')}</p></li>
                <li><p>{t('section3.subsection1.item7')}</p></li>
                <li><p>{t('section3.subsection1.item8')}</p></li>
              </ul>
              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">
                {t('section3.subsection2.title')}
              </h4>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6 mb-4">
                <li><p>{t('section3.subsection2.item1')}</p></li>
                <li><p>{t('section3.subsection2.item2')}</p></li>
                <li><p>{t('section3.subsection2.item3')}</p></li>
                <li><p>{t('section3.subsection2.item4')}</p></li>
                <li><p>{t('section3.subsection2.item5')}</p></li>
              </ul>
              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">
                {t('section3.subsection3.title')}
              </h4>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section3.subsection3.item1')}</p></li>
              </ul>
            </section>

            {/* 四、用户个人信息保护及隐私政策 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section4.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section4.item1')}</p></li>
                <li><p>{t('section4.item2')}</p></li>
                <li><p>{t('section4.item3')}</p></li>
                <li><p>{t('section4.item4')}</p></li>
              </ul>
            </section>

            {/* 五、服务费用 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section5.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section5.item1')}</p></li>
                <li><p>{t('section5.item2')}</p></li>
                <li><p>{t('section5.item3')}</p></li>
              </ul>
            </section>

            {/* 六、内容标识 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section6.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section6.item1')}</p></li>
                <li><p>{t('section6.item2')}</p></li>
                <li><p>{t('section6.item3')}</p></li>
                <li><p>{t('section6.item4')}</p></li>
              </ul>
            </section>

            {/* 七、知识产权 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section7.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section7.item1')}</p></li>
                <li><p>{t('section7.item2')}</p></li>
                <li><p>{t('section7.item3')}</p></li>
                <li><p>{t('section7.item4')}</p></li>
              </ul>
            </section>

            {/* 八、网络安全保护与合规声明 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section8.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section8.item1')}</p></li>
                <li><p>{t('section8.item2')}</p></li>
                <li><p>{t('section8.item3')}</p></li>
                <li><p>{t('section8.item4')}</p></li>
                <li><p>{t('section8.item5')}</p></li>
                <li><p>{t('section8.item6')}</p></li>
              </ul>
            </section>

            {/* 九、投诉举报 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section9.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section9.item1')}</p></li>
                <li><p>{t('section9.item2')}</p></li>
              </ul>
            </section>

            {/* 十、违约责任与处理 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section10.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section10.item1')}</p></li>
                <li><p>{t('section10.item2')}</p></li>
                <li><p>{t('section10.item3')}</p></li>
                <li><p>{t('section10.item4')}</p></li>
              </ul>
            </section>

            {/* 十一、未成年人使用规则 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section11.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section11.item1')}</p></li>
                <li><p>{t('section11.item2')}</p></li>
                <li><p>{t('section11.item3')}</p></li>
                <li><p>{t('section11.item4')}</p></li>
                <li><p>{t('section11.item5')}</p></li>
              </ul>
            </section>

            {/* 十二、功能局限性声明与责任限制 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section12.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section12.item1')}</p></li>
                <li><p>{t('section12.item2')}</p></li>
                <li><p>{t('section12.item3')}</p></li>
                <li><p>{t('section12.item4')}</p></li>
                <li><p>{t('section12.item5')}</p></li>
                <li><p>{t('section12.item6')}</p></li>
                <li><p>{t('section12.item7')}</p></li>
              </ul>
            </section>

            {/* 十三、协议的生效、终止与争议解决 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section13.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section13.item1')}</p></li>
                <li><p>{t('section13.item2')}</p></li>
                <li><p>{t('section13.item3')}</p></li>
                <li><p>{t('section13.item4')}</p></li>
                <li><p>{t('section13.item5')}</p></li>
              </ul>
            </section>

            {/* 十四、其他 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {t('section14.title')}
              </h3>
              <ul className="list-none space-y-3 text-gray-700 text-sm leading-6">
                <li><p>{t('section14.item1')}</p></li>
                <li><p>{t('section14.item2')}</p></li>
                <li><p>{t('section14.item3')}</p></li>
              </ul>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 text-white font-semibold py-3 rounded-lg hover:from-orange-500 hover:to-amber-500 transition-all"
          >
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  )
}




