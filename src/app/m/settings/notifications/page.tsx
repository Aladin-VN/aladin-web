'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState, useEffect, useCallback } from 'react';
import {
  Bell, ShoppingBag, Truck, CreditCard, Tag, MessageCircle, Info,
  Smartphone, Radio, Moon, Loader2, CheckCircle2, XCircle, Zap,
} from 'lucide-react';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useRealtime } from '@/hooks/use-realtime';
import { api, type ApiResponse } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';

// ============================================
// Server-synced preference type
// ============================================

interface ServerPrefs {
  id: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  zaloEnabled: boolean;
  orderUpdates: boolean;
  shipmentUpdates: boolean;
  creditAlerts: boolean;
  promotions: boolean;
  systemAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  pushSupported: boolean;
  zaloLinked: boolean;
}

// ============================================
// Notification Settings Page (Enhanced Wave 4)
// ============================================

export default function NotificationSettingsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  // Push notifications
  const { supported: pushSupported, permission, loading: pushLoading, isActive: pushActive, requestPermission, unsubscribe } = usePushNotifications();

  // Real-time status
  const { connected: wsConnected } = useRealtime();

  // Server preferences
  const [serverPrefs, setServerPrefs] = useState<ServerPrefs | null>(null);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch server prefs
  useEffect(() => {
    api.get<ServerPrefs>('/notifications/preferences').then((res) => {
      if (res.success && res.data) {
        setServerPrefs(res.data);
      }
    }).catch(() => {}).finally(() => setLoadingPrefs(false));
  }, []);

  // Save prefs to server
  const savePrefs = useCallback(async (updates: Record<string, unknown>) => {
    if (!serverPrefs) return;
    setSaving(true);
    try {
      const res = await api.put<ServerPrefs>('/notifications/preferences', updates);
      if (res.success && res.data) {
        setServerPrefs(res.data);
      }
    } catch {}
    setSaving(false);
  }, [serverPrefs]);

  const toggleChannel = (field: keyof ServerPrefs) => {
    if (!serverPrefs) return;
    savePrefs({ [field]: !serverPrefs[field] });
  };

  const toggleType = (field: keyof ServerPrefs) => {
    if (!serverPrefs) return;
    savePrefs({ [field]: !serverPrefs[field] });
  };

  // Local notification type prefs (for display, synced with server)
  const typePrefs = serverPrefs ? [
    { key: 'orderUpdates' as const, icon: <ShoppingBag className="h-4 w-4 text-blue-500" />, labelVi: 'Đơn hàng', labelEn: 'Orders', descVi: 'Xác nhận, cập nhật trạng thái đơn hàng', descEn: 'Order confirmations, status updates', enabled: serverPrefs.orderUpdates },
    { key: 'shipmentUpdates' as const, icon: <Truck className="h-4 w-4 text-cyan-500" />, labelVi: 'Vận chuyển', labelEn: 'Shipments', descVi: 'Cập nhật vận đơn, giao hàng', descEn: 'Shipping updates, delivery status', enabled: serverPrefs.shipmentUpdates },
    { key: 'creditAlerts' as const, icon: <CreditCard className="h-4 w-4 text-amber-500" />, labelVi: 'Công nợ', labelEn: 'Credit', descVi: 'Hạn mức, thanh toán, nhắc nợ', descEn: 'Credit limits, payments, reminders', enabled: serverPrefs.creditAlerts },
    { key: 'promotions' as const, icon: <Tag className="h-4 w-4 text-pink-500" />, labelVi: 'Khuyến mãi', labelEn: 'Promotions', descVi: 'Ưu đãi, giảm giá, mua chung', descEn: 'Deals, discounts, group buy', enabled: serverPrefs.promotions },
    { key: 'systemAlerts' as const, icon: <Info className="h-4 w-4 text-gray-500" />, labelVi: 'Hệ thống', labelEn: 'System', descVi: 'Cảnh báo tồn kho, bảo trì', descEn: 'Stock alerts, maintenance', enabled: serverPrefs.systemAlerts },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Thông báo', 'Notifications')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Real-time connection status */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                wsConnected ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-amber-100 dark:bg-amber-900/40'
              )}>
                <Radio className={cn('h-4 w-4', wsConnected ? 'text-emerald-600' : 'text-amber-600')} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {t('Kết nối thời gian thực', 'Real-time Connection')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {wsConnected
                    ? t('Đã kết nối — nhận thông báo tức thì', 'Connected — receiving instant notifications')
                    : t('Chờ kết nối...', 'Reconnecting...')}
                </p>
              </div>
              <span className={cn(
                'h-2.5 w-2.5 rounded-full',
                wsConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
              )} />
            </div>
          </CardContent>
        </Card>

        {/* Delivery channels */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold">
              {t('Kênh thông báo', 'Notification Channels')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* In-app */}
            {serverPrefs && (
              <ChannelRow
                icon={<Bell className="h-4 w-4 text-blue-500" />}
                labelVi="Trong ứng dụng"
                labelEn="In-App"
                descVi="Thông báo trên trang thông báo"
                descEn="Show in notification center"
                enabled={serverPrefs.inAppEnabled}
                onToggle={() => toggleChannel('inAppEnabled')}
                disabled={saving}
              />
            )}

            {/* Push */}
            <ChannelRow
              icon={<Smartphone className="h-4 w-4 text-violet-500" />}
              labelVi="Thông báo đẩy"
              labelEn="Push Notifications"
              descVi={pushActive ? t('Đã bật', 'Active') : pushSupported ? t('Nhấn để bật', 'Tap to enable') : t('Trình duyệt không hỗ trợ', 'Not supported')}
              descEn={pushActive ? t('Đã bật', 'Active') : pushSupported ? t('Nhấn để bật', 'Tap to enable') : t('Trình duyệt không hỗ trợ', 'Not supported')}
              enabled={pushActive && (serverPrefs?.pushEnabled ?? true)}
              onToggle={pushActive ? () => {
                unsubscribe();
                if (serverPrefs) savePrefs({ pushEnabled: false });
              } : async () => {
                const granted = await requestPermission();
                if (granted && serverPrefs) savePrefs({ pushEnabled: true });
              }}
              disabled={!pushSupported || pushLoading || saving}
              loading={pushLoading}
              statusIcon={permission === 'granted' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                : permission === 'denied' ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                : null}
            />

            {/* Zalo */}
            {serverPrefs && (
              <ChannelRow
                icon={<Zap className="h-4 w-4 text-blue-600" />}
                labelVi="Zalo OA"
                labelEn="Zalo OA"
                descVi={serverPrefs.zaloLinked ? t('Đã liên kết', 'Linked') : t('Chưa liên kết tài khoản Zalo', 'Zalo account not linked')}
                descEn={serverPrefs.zaloLinked ? t('Đã liên kết', 'Linked') : t('Chưa liên kết tài khoản Zalo', 'Zalo account not linked')}
                enabled={serverPrefs.zaloEnabled && serverPrefs.zaloLinked}
                onToggle={() => toggleChannel('zaloEnabled')}
                disabled={!serverPrefs.zaloLinked || saving}
                statusIcon={serverPrefs.zaloLinked ? <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" /> : null}
              />
            )}
          </CardContent>
        </Card>

        {/* Notification types */}
        <Card>
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold">
              {t('Loại thông báo', 'Notification Types')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {typePrefs.map((pref, index) => (
              <div key={pref.key}>
                <ChannelRow
                  icon={pref.icon}
                  labelVi={pref.labelVi}
                  labelEn={pref.labelEn}
                  descVi={pref.descVi}
                  descEn={pref.descEn}
                  enabled={pref.enabled}
                  onToggle={() => toggleType(pref.key)}
                  disabled={saving}
                />
                {index < typePrefs.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Quiet hours */}
        {serverPrefs && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                  <Moon className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {t('Giờ im lặng', 'Quiet Hours')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {serverPrefs.quietHoursEnabled
                      ? t(`${serverPrefs.quietHoursStart} — ${serverPrefs.quietHoursEnd}`, `${serverPrefs.quietHoursStart} — ${serverPrefs.quietHoursEnd}`)
                      : t('Tắt — nhận thông báo 24/7', 'Off — receive notifications 24/7')}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={serverPrefs.quietHoursEnabled}
                  onToggle={() => toggleChannel('quietHoursEnabled')}
                  disabled={saving}
                />
              </div>

              {/* Time picker row */}
              {serverPrefs.quietHoursEnabled && (
                <div className="flex items-center gap-3 mt-3 pl-12">
                  <input
                    type="time"
                    value={serverPrefs.quietHoursStart}
                    onChange={(e) => savePrefs({ quietHoursStart: e.target.value })}
                    className="h-8 w-24 rounded-md border border-border bg-background px-2 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">→</span>
                  <input
                    type="time"
                    value={serverPrefs.quietHoursEnd}
                    onChange={(e) => savePrefs({ quietHoursEnd: e.target.value })}
                    className="h-8 w-24 rounded-md border border-border bg-background px-2 text-xs"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {loadingPrefs && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================
// Channel Row Component
// ============================================

function ChannelRow({
  icon,
  labelVi,
  labelEn,
  descVi,
  descEn,
  enabled,
  onToggle,
  disabled = false,
  loading = false,
  statusIcon,
}: {
  icon: React.ReactNode;
  labelVi: string;
  labelEn: string;
  descVi: string;
  descEn: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  loading?: boolean;
  statusIcon?: React.ReactNode;
}) {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">
            {locale === 'vi' ? labelVi : labelEn}
          </p>
          {statusIcon}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {locale === 'vi' ? descVi : descEn}
        </p>
      </div>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <ToggleSwitch enabled={enabled} onToggle={onToggle} disabled={disabled} />
      )}
    </div>
  );
}

// ============================================
// Toggle Switch Component
// ============================================

function ToggleSwitch({
  enabled,
  onToggle,
  disabled = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors shrink-0',
        enabled ? 'bg-primary' : 'bg-muted',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
          enabled ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </button>
  );
}