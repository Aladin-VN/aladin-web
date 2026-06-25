'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAppStore } from '@/stores/app.store';

// ============================================
// Push Permission Prompt
// Shows a subtle, non-intrusive prompt to enable
// browser push notifications for real-time alerts.
// Only shows once per session, dismissible, and
// respects existing permission state.
// ============================================

interface PushPermissionPromptProps {
  /** Force show (e.g., from settings page) */
  forceShow?: boolean;
  /** Compact card variant */
  compact?: boolean;
  /** Auto-show after N seconds (default: 8) */
  delaySeconds?: number;
}

export function PushPermissionPrompt({
  forceShow = false,
  compact = false,
  delaySeconds = 8,
}: PushPermissionPromptProps) {
  const { supported, permission, loading, isActive, requestPermission } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const locale = useAppStore((s) => s.locale);

  // Check session storage for dismissal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const wasDismissed = sessionStorage.getItem('aladin-push-prompt-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }

    // Auto-show after delay (only if conditions are met)
    if (!forceShow) {
      const timer = setTimeout(() => {
        setVisible(true);
      }, delaySeconds * 1000);

      return () => clearTimeout(timer);
    }
  }, [forceShow, delaySeconds]);

  // Determine if prompt should be visible
  const shouldShow = forceShow
    ? supported && permission === 'default' && !isActive && !loading
    : supported && permission === 'default' && !isActive && !loading && visible && !dismissed;

  if (!shouldShow) return null;

  const handleEnable = async () => {
    await requestPermission();
    setVisible(false);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    sessionStorage.setItem('aladin-push-prompt-dismissed', '1');
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
        <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300 flex-1">
          {locale === 'vi'
            ? 'Bật thông báo đẩy để nhận cập nhật realtime'
            : 'Enable push notifications for real-time updates'}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="default"
            className="h-6 text-[10px] px-2"
            onClick={handleEnable}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : locale === 'vi' ? 'Bật' : 'Enable'}
          </Button>
          <button
            onClick={handleDismiss}
            className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/60"
          >
            <X className="h-3 w-3 text-blue-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[85] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg shadow-black/10">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
            <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {locale === 'vi'
                ? 'Nhận thông báo realtime'
                : 'Get real-time notifications'}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {locale === 'vi'
                ? 'Bật thông báo đẩy để nhận cập nhật đơn hàng, vận chuyển và khuyến mãi ngay lập tức — kể cả khi ứng dụng đang đóng.'
                : 'Enable push notifications to receive order updates, shipping alerts, and promotions instantly — even when the app is closed.'}
            </p>

            {/* Privacy note */}
            <div className="flex items-center gap-1 mt-2">
              <Shield className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                {locale === 'vi'
                  ? 'Bạn có thể tắt bất kỳ lúc nào trong cài đặt'
                  : 'You can turn off anytime in settings'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleEnable}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Bell className="h-3.5 w-3.5 mr-1" />
                )}
                {locale === 'vi' ? 'Bật thông báo' : 'Enable'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-muted-foreground"
                onClick={handleDismiss}
              >
                {locale === 'vi' ? 'Để sau' : 'Later'}
              </Button>
            </div>
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted shrink-0 -mt-1 -mr-1"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Push Status Badge (for settings)
// ============================================

export function PushStatusBadge() {
  const { supported, permission, isActive } = usePushNotifications();
  const locale = useAppStore((s) => s.locale);

  if (!supported) return null;

  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <Bell className="h-3.5 w-3.5" />
        {locale === 'vi' ? 'Đã bật' : 'Enabled'}
      </span>
    );
  }

  if (permission === 'denied') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
        <BellOff className="h-3.5 w-3.5" />
        {locale === 'vi' ? 'Đã chặn' : 'Blocked'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-500">
      <BellOff className="h-3.5 w-3.5" />
      {locale === 'vi' ? 'Chưa bật' : 'Not enabled'}
    </span>
  );
}