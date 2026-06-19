'use client';
import { useLocale } from '@/providers/app-provider';

import { useState } from 'react';
import { Factory, Warehouse, ArrowRight, Link2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function SupplyChainPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const sections = [
    {
      title: t('Manufacturers', 'Nha san xuat'),
      titleEn: 'Manufacturers',
      description: t(
        'Manage product manufacturers, commission rates, and supplier relationships',
        'Quan ly nha san xuat, ty le hoa hong va moi quan he nha cung ung'
      ),
      href: '/supply-chain/manufacturers',
      icon: Factory,
      color: 'bg-yellow-50 text-red-600',
      count: t('View details', 'Xem chi tiet'),
    },
    {
      title: t('Distributors', 'Nha phan phoi'),
      titleEn: 'Distributors',
      description: t(
        'Manage distribution network, delivery coordinates, and smart sourcing',
        'Quan ly mang phan phoi, toa do giao hang va tim nguon thong minh'
      ),
      href: '/supply-chain/distributors',
      icon: Warehouse,
      color: 'bg-blue-100 text-blue-600',
      count: t('View details', 'Xem chi tiet'),
    },
  ];

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('Supply Chain', 'Chuoi cung ung')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                'Manage manufacturers, distributors, and the entire supply chain network',
                'Quan ly nha san xuat, nha phan phoi va toan bo mang chuoi cung ung'
              )}
            </p>
          </div>

          <Separator />

          {/* Info Banner */}
          <div className="rounded-lg border border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/20 p-4">
            <div className="flex items-start gap-3">
              <Link2 className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-yellow-400">
                  {t('Supply Chain Management', 'Quan ly chuoi cung ung')}
                </p>
                <p className="text-xs text-red-700/80 dark:text-yellow-500/80 mt-1">
                  {t(
                    'Track manufacturers, distributors, and product sourcing. Manage commission rates and delivery logistics.',
                    'Theo doi nha san xuat, nha phan phoi va nguon cung cap san pham. Quan ly hoa hong va van chuyen.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Section Cards */}
          <div className="grid gap-4 sm:grid-cols-2 max-w-3xl">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <Card
                  key={section.href}
                  className="group hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => window.location.href = section.href}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-lg ${section.color} flex items-center justify-center shrink-0`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold">{section.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {section.description}
                        </p>
                        <Button variant="ghost" size="sm" className="mt-3 h-8 text-xs text-red-600 hover:text-red-700 p-0">
                          {section.count}
                          <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </main>
      </SidebarInset>
    </div>
  );
}
