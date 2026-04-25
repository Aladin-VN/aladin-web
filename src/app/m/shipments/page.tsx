'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Truck } from 'lucide-react';

export default function MobileShipmentsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Vận chuyển', 'Shipments')} showBack showNotifications={false} />
      <main className="px-4 pb-4 pt-3">
        <div className="text-center py-12">
          <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">{t('Vận chuyển', 'Shipments')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Sẽ có trong Sprint M4', 'Coming in Sprint M4')}
          </p>
        </div>
      </main>
    </div>
  );
}
