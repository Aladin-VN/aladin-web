'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Settings } from 'lucide-react';

// ============================================
// Settings Page — Placeholder for Sprint M8
// ============================================

export default function MobileSettingsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Cài đặt', 'Settings')} showBack showNotifications={false} />
      <main className="px-4 pb-4 pt-3">
        <div className="text-center py-12">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">{t('Cài đặt', 'Settings')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Sẽ có trong Sprint M8', 'Coming in Sprint M8')}
          </p>
        </div>
      </main>
    </div>
  );
}
