import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';
import {locales, defaultLocale} from './config';

export default getRequestConfig(async ({locale}) => {
  const activeLocale = locale || defaultLocale;

  // Validate that the incoming `locale` parameter is valid
  if (!(locales as readonly string[]).includes(activeLocale)) {
    notFound();
  }

  return {
    messages: (await import(`@/messages/${activeLocale}.json`)).default,
    timeZone: 'Asia/Shanghai',
    now: new Date(),
    locale: activeLocale as string
  };
}); 