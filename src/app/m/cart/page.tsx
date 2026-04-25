'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { ShoppingCart } from 'lucide-react';

export default function MobileCartPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Giỏ hàng', 'Cart')} showBack showNotifications={false} />
      <main className="px-4 pb-4 pt-3">
        <div className="text-center py-12">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">{t('Giỏ hàng trống', 'Cart is empty')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Sẽ có trong Sprint M3', 'Coming in Sprint M3')}
          </p>
        </div>
      </main>
    </div>
  );
}
