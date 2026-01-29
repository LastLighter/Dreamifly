import base from './zh.json'
import { termsMarkdownZh } from '@/content/terms/termsContent'

// 通过代码方式为 auth.terms 注入完整协议文本，避免在 JSON 中手工转义长 Markdown
const messages = {
  ...base,
  auth: {
    ...base.auth,
    terms: {
      ...base.auth.terms,
      fullText: termsMarkdownZh,
    },
  },
}

export default messages

