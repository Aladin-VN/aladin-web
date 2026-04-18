// ALADIN Zalo Bot — i18n Translation Utility
// Provides t() function for conversation engine to resolve zaloBot strings
// from vi.json / en.json message files

import viMessages from '@/messages/vi.json';
import enMessages from '@/messages/en.json';

type Locale = 'vi' | 'en';

const messages: Record<Locale, Record<string, unknown>> = {
  vi: viMessages as unknown as Record<string, unknown>,
  en: enMessages as unknown as Record<string, unknown>,
};

/**
 * Resolve a dot-notation key from the message bundle.
 * e.g. t('zaloBot.orderSuccess', 'vi') → resolves viMessages.zaloBot.orderSuccess
 *
 * Supports parameter interpolation with {param} placeholders.
 * e.g. t('zaloBot.outOfStock', 'vi', { name: 'Rice' })
 */
export function t(key: string, locale: Locale, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  let value: unknown = messages[locale];

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      // Fallback: try English, then return key
      if (locale !== 'en') {
        return t(key, 'en', params);
      }
      return key;
    }
  }

  if (typeof value !== 'string') {
    // Fallback to English if Vietnamese value missing or not a string
    if (locale !== 'en') {
      return t(key, 'en', params);
    }
    return key;
  }

  // Interpolate parameters: {param} → value
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_match, param: string) => {
      return params[param] !== undefined ? String(params[param]) : `{${param}}`;
    });
  }

  return value;
}

/**
 * Shorthand: create a locale-bound translator for a given language.
 * Useful inside handlers that already have `const vi = session.language === 'vi'`.
 *
 * Usage:
 *   const t = createTranslator(session.language);
 *   t('zaloBot.orderSuccess')  // automatically uses the session locale
 */
export function createTranslator(locale: Locale) {
  return (key: string, params?: Record<string, string | number>): string => {
    return t(key, locale, params);
  };
}
