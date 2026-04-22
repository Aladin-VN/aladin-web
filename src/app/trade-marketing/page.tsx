'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Tag, Camera } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { useLocale } from '@/providers/app-provider';

// ============================================
// Trade Marketing Hub — Navigation Page
// ============================================

export default function TradeMarketingPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const cards = [
    {
      title: 'Promotions & Schemes',
      titleVi: 'Khuyen mai & Chuong trinh',
      description: 'Manage manufacturer-funded promotions, track redemptions and budgets',
      descriptionVi: 'Quan ly chuong trinh khuyen mai tu nha san xuat, theo doi ap dung va ngan sach',
      href: '/trade-marketing/promotions',
      icon: <Gift className="h-8 w-8" />,
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      title: 'Merchandising Audits',
      titleVi: 'Kiem tra Trung bay',
      description: 'Review shelf photos from shop owners for promotion compliance',
      descriptionVi: 'Duyet anh trung bay tu chu cua hang de dam bao tuan thu chuong trinh khuyen mai',
      href: '/trade-marketing/merchandising',
      icon: <Camera className="h-8 w-8" />,
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('Trade Marketing', 'Trade Marketing')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Manage promotions and merchandising audits', 'Quan ly chuong trinh khuyen mai va kiem tra trung bay')}
            </p>
          </div>

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cards.map((card) => (
              <Card
                key={card.href}
                className="cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group"
                onClick={() => router.push(card.href)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-14 w-14 rounded-xl ${card.color} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform`}>
                      {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold group-hover:text-emerald-700 transition-colors">
                        {card.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {card.titleVi}
                      </p>
                      <p className="text-sm text-muted-foreground mt-2">
                        {card.description}
                      </p>
                    </div>
                    <Tag className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Info Card */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Gift className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Trade Marketing Module</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Manage manufacturer-funded promotions and verify in-store merchandising compliance. The scheme engine automatically applies eligible promotions at checkout, guaranteeing 100% promo penetration across all shop orders.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </SidebarInset>
    </div>
  );
}
