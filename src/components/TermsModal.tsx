'use client'

import { useTranslations } from 'next-intl'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function TermsModal({ isOpen, onClose }: TermsModalProps) {
  const t = useTranslations('auth.terms')

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
            <p className="text-sm text-gray-600 mb-6">{t('effectiveDate')}</p>

            {/* 一、引言 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section1.title')}</h3>
              <p className="text-gray-700 mb-3">{t('section1.content')}</p>
              <p className="text-gray-700">{t('section1.note')}</p>
            </section>

            {/* 二、用户行为规范 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section2.title')}</h3>
              <p className="text-gray-700 mb-3">{t('section2.intro')}</p>
              
              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">{t('section2.subsection1.title')}</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>{t('section2.subsection1.item1')}</li>
                <li>{t('section2.subsection1.item2')}</li>
                <li>{t('section2.subsection1.item3')}</li>
                <li>{t('section2.subsection1.item4')}</li>
              </ul>

              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">{t('section2.subsection2.title')}</h4>
              <p className="text-gray-700 mb-2">{t('section2.subsection2.intro')}</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-2">
                <li>{t('section2.subsection2.item1')}</li>
                <li>{t('section2.subsection2.item2')}</li>
                <li>{t('section2.subsection2.item3')}</li>
                <li>{t('section2.subsection2.item4')}</li>
              </ul>
              <p className="text-gray-700 text-sm italic">{t('section2.subsection2.note')}</p>
            </section>

            {/* 三、数据收集与使用 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section3.title')}</h3>
              
              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">{t('section3.subsection1.title')}</h4>
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border border-gray-300 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">{t('section3.subsection1.table.header1')}</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">{t('section3.subsection1.table.header2')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row1.col1')}</td>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row1.col2')}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row2.col1')}</td>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row2.col2')}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row3.col1')}</td>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row3.col2')}</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row4.col1')}</td>
                      <td className="border border-gray-300 px-4 py-2">{t('section3.subsection1.table.row4.col2')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">{t('section3.subsection2.title')}</h4>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
                <li>{t('section3.subsection2.item1')}</li>
                <li>{t('section3.subsection2.item2')}</li>
                <li>{t('section3.subsection2.item3')}</li>
              </ul>

              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">{t('section3.subsection3.title')}</h4>
              <p className="text-gray-700 mb-2">{t('section3.subsection3.intro')}</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-2">
                <li>{t('section3.subsection3.item1')}</li>
                <li>{t('section3.subsection3.item2')}</li>
                <li>{t('section3.subsection3.item3')}</li>
              </ul>

              <h4 className="text-base font-semibold text-gray-800 mt-4 mb-2">{t('section3.subsection4.title')}</h4>
              <p className="text-gray-700 mb-2">{t('section3.subsection4.intro')}</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{t('section3.subsection4.item1')}</li>
                <li>{t('section3.subsection4.item2')}</li>
                <li>{t('section3.subsection4.item3')}</li>
              </ul>
            </section>

            {/* 四、隐私保护措施 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section4.title')}</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{t('section4.item1')}</li>
                <li>{t('section4.item2')}</li>
                <li>{t('section4.item3')}</li>
              </ul>
            </section>

            {/* 五、免责声明 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section5.title')}</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-2">
                <li>{t('section5.item1')}</li>
                <li>{t('section5.item2')}</li>
                <li>{t('section5.item3')}</li>
              </ul>
            </section>

            {/* 六、协议更新 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section6.title')}</h3>
              <p className="text-gray-700 mb-2">{t('section6.content')}</p>
              <ul className="list-disc list-inside text-gray-700 space-y-2 mb-2">
                <li>{t('section6.item1')}</li>
                <li>{t('section6.item2')}</li>
              </ul>
              <p className="text-gray-700">{t('section6.note')}</p>
            </section>

            {/* 七、联系我们 */}
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('section7.title')}</h3>
              <p className="text-gray-700">
                {t('section7.content')}: <a href="mailto:lastlighters@gmail.com" className="text-orange-500 hover:text-orange-600">lastlighters@gmail.com</a>
              </p>
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




