export const locales = ['en', 'zh', 'zh-TW'] as const;
export type Locale = typeof locales[number];

export const defaultLocale: Locale = 'zh'; 