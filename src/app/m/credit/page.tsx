'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { CreditCard } from 'lucide-react';

// ============================================
// Credit Page — Placeholder for Sprint M5
// ============================================

export default function MobileCreditPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Công nợ', 'Credit')} />
      <main className="px-4 pb-4 pt-3">
        <div className="text-center py-12">
          <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">{t('Quản lý công nợ', 'Credit Management')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Sẽ có trong Sprint M5', 'Coming in Sprint M5')}
          </p>
        </div>
      </main>
    </div>
  );
}
