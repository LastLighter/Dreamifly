import base from './zh-TW.json'
import { termsMarkdownZhTW } from '@/content/terms/termsContent'

// 為繁體中文注入完整協議文本，目前與簡體內容一致，後續可獨立翻譯
const messages = {
  ...base,
  auth: {
    ...base.auth,
    terms: {
      ...base.auth.terms,
      fullText: termsMarkdownZhTW,
    },
  },
}

export default messages

