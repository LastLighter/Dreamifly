import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './src/config';

export default createMiddleware({
  // 支持的语言列表
  locales,
  // 默认语言
  defaultLocale,
  // 本地化路由配置
  localePrefix: 'as-needed'
});

export const config = {
  // 匹配所有路径，但排除api路由和静态文件
  matcher: ['/((?!api|_next|.*\\..*).*)']
}; 