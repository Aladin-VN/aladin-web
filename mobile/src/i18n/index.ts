import vi from './vi.json';
import en from './en.json';

export type Locale = 'vi' | 'en';

export const translations: Record<Locale, Record<string, any>> = { vi, en };

export const defaultLocale: Locale = 'vi';

export function getTranslation(locale: Locale) {
  return translations[locale] ?? translations[defaultLocale];
}

/**
 * Simple lookup function: t('common.loading') => 'Đang tải...'
 * Supports dot-notation nested keys.
 */
export function t(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const dict = getTranslation(locale);
  const keys = key.split('.');
  let value: any = dict;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // fallback to Vietnamese, then return key
      let fallback: any = translations[defaultLocale];
      for (const fk of keys) {
        if (fallback && typeof fallback === 'object' && fk in fallback) {
          fallback = fallback[fk];
        } else {
          return key;
        }
      }
      value = typeof fallback === 'string' ? fallback : key;
      break;
    }
  }

  if (typeof value !== 'string') return key;

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value
    );
  }

  return value;
}
