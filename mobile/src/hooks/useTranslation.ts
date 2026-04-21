import { useCallback } from 'react';
import { useLocaleStore } from '@/src/hooks/useLocale';
import { t, type Locale } from '@/src/i18n';

/**
 * useTranslation hook – provides a translation function scoped to the
 * current locale from the Zustand store.
 *
 * Usage:
 *   const { t, locale } = useTranslation();
 *   <Text>{t('common.loading')}</Text>
 *   <Text>{t('stats.revenue', { value: 1000 })}</Text>
 */
export function useTranslation() {
  const locale: Locale = useLocaleStore((s) => s.locale);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      t(locale, key, params),
    [locale]
  );

  return { t: translate, locale };
}
