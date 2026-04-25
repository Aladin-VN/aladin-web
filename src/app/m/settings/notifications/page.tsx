'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { Bell, ShoppingBag, Truck, CreditCard, Tag, MessageCircle, Info } from 'lucide-react';

// ============================================
// Notification Preferences Page
// ============================================

interface NotifPref {
  type: string;
  icon: React.ReactNode;
  labelVi: string;
  labelEn: string;
  descVi: string;
  descEn: string;
  enabled: boolean;
}

export default function NotificationSettingsPage() {
  const locale = useAppStore((s) => s.locale);
  const [prefs, setPrefs] = useNotificationPrefs();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const togglePref = (type: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.type === type ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const enabledCount = prefs.filter((p) => p.enabled).length;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Thông báo', 'Notifications')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Summary */}
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            {t(
              `${enabledCount} / ${prefs.length} loại thông báo`,
              `${enabledCount} / ${prefs.length} notification types`
            )}
          </p>
        </div>

        {/* Notification categories */}
        <Card>
          <CardContent className="p-0">
            {prefs.map((pref, index) => (
              <div key={pref.type}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    {pref.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {locale === 'vi' ? pref.labelVi : pref.labelEn}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {locale === 'vi' ? pref.descVi : pref.descEn}
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={pref.enabled}
                    onToggle={() => togglePref(pref.type)}
                  />
                </div>
                {index < prefs.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Push notification note */}
        <div className="px-1 py-2">
          <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
            {t(
              'Thông báo đẩy (push) sẽ yêu cầu quyền truy cập thông báo từ trình duyệt khi tính năng sẵn sàng.',
              'Push notifications will require notification permission from the browser when the feature becomes available.'
            )}
          </p>
        </div>
      </main>
    </div>
  );
}

// ============================================
// Toggle Switch Component
// ============================================

function ToggleSwitch({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
        enabled ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ============================================
// Notification Preferences Hook (persisted)
// ============================================

const PREFS_KEY = 'aladin-notif-prefs';
const DEFAULT_PREFS: NotifPref[] = [
  {
    type: 'order',
    icon: <ShoppingBag className="h-4 w-4 text-blue-500" />,
    labelVi: 'Đơn hàng',
    labelEn: 'Orders',
    descVi: 'Xác nhận, cập nhật trạng thái đơn hàng',
    descEn: 'Order confirmations, status updates',
    enabled: true,
  },
  {
    type: 'shipment',
    icon: <Truck className="h-4 w-4 text-emerald-500" />,
    labelVi: 'Vận chuyển',
    labelEn: 'Shipments',
    descVi: 'Cập nhật vận đơn, giao hàng',
    descEn: 'Shipping updates, delivery status',
    enabled: true,
  },
  {
    type: 'credit',
    icon: <CreditCard className="h-4 w-4 text-amber-500" />,
    labelVi: 'Công nợ',
    labelEn: 'Credit',
    descVi: 'Hạn mức, thanh toán, nhắc nợ',
    descEn: 'Credit limits, payments, reminders',
    enabled: true,
  },
  {
    type: 'promotion',
    icon: <Tag className="h-4 w-4 text-pink-500" />,
    labelVi: 'Khuyến mãi',
    labelEn: 'Promotions',
    descVi: 'Ưu đãi, giảm giá, mua chung',
    descEn: 'Deals, discounts, group buy',
    enabled: true,
  },
  {
    type: 'chat',
    icon: <MessageCircle className="h-4 w-4 text-violet-500" />,
    labelVi: 'Tin nhắn',
    labelEn: 'Messages',
    descVi: 'Hỗ trợ, tin nhắn từ hệ thống',
    descEn: 'Support, system messages',
    enabled: true,
  },
  {
    type: 'system',
    icon: <Info className="h-4 w-4 text-gray-500" />,
    labelVi: 'Hệ thống',
    labelEn: 'System',
    descVi: 'Bảo trì, cập nhật ứng dụng',
    descEn: 'Maintenance, app updates',
    enabled: true,
  },
];

function useNotificationPrefs() {
  const loadPrefs = (): NotifPref[] => {
    if (typeof window === 'undefined') return DEFAULT_PREFS;
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        return DEFAULT_PREFS.map((p) => ({
          ...p,
          enabled: parsed[p.type] !== undefined ? parsed[p.type] : p.enabled,
        }));
      }
    } catch {}
    return DEFAULT_PREFS;
  };

  const [prefs, setPrefsState] = useState<NotifPref[]>(loadPrefs);

  const setPrefs = (updater: (prev: NotifPref[]) => NotifPref[]) => {
    setPrefsState((prev) => {
      const next = updater(prev);
      try {
        const map: Record<string, boolean> = {};
        next.forEach((p) => { map[p.type] = p.enabled; });
        localStorage.setItem(PREFS_KEY, JSON.stringify(map));
      } catch {}
      return next;
    });
  };

  return [prefs, setPrefs] as const;
}
