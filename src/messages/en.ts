import base from './en.json'
import { termsMarkdownEn } from '@/content/terms/termsContent'

// For English locale, inject the full agreement text.
// Currently reuses the Chinese source; you can replace `termsMarkdownEn`
// with a fully translated version later without改動其他程式碼.
const messages = {
  ...base,
  auth: {
    ...base.auth,
    terms: {
      ...base.auth.terms,
      fullText: termsMarkdownEn,
    },
  },
}

export default messages

