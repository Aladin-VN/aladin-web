'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// ============================================
// Notifications Page — Placeholder for Sprint M5
// ============================================

export default function MobileNotificationsPage() {
  const locale = useAppStore((s) => s.locale);
  const notifications = useAppStore((s) => s.notifications);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Thông báo', 'Notifications')}
        showBack
        showNotifications={false}
      />
      <main className="px-4 pb-4 pt-3">
        {notifications.length > 0 ? (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Card
                key={n.id}
                className={n.read ? 'opacity-60' : ''}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {locale === 'vi' && n.titleVi ? n.titleVi : n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {locale === 'vi' && n.bodyVi ? n.bodyVi : n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold">{t('Chưa có thông báo', 'No notifications')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Thông báo mới sẽ xuất hiện ở đây', 'New notifications will appear here')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
