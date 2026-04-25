'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================
// Products Page — Placeholder for Sprint M3
// ============================================

export default function MobileProductsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Sản phẩm', 'Products')}
        showSearch
      />
      <main className="px-4 pb-4 pt-3">
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('Tìm sản phẩm...', 'Search products...')}
            className="pl-10 h-10"
          />
        </div>

        {/* Placeholder content */}
        <div className="text-center py-12">
          <Skeleton className="h-20 w-20 rounded-2xl mx-auto mb-4" />
          <h3 className="text-lg font-semibold">{t('Danh sách sản phẩm', 'Product Catalog')}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t('Sẽ có trong Sprint M3', 'Coming in Sprint M3')}
          </p>
        </div>
      </main>
    </div>
  );
}
