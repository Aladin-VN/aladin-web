'use client';

import { useAppStore } from '@/stores/app.store';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================
// Offline Fallback Page
// ============================================

export default function MobileOfflinePage() {
  const locale = useAppStore((s) => s.locale);
  const isOnline = useAppStore((s) => s.isOnline);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const handleRetry = () => {
    window.location.href = '/m';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Icon */}
      <div className="h-20 w-20 rounded-full bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center mb-6">
        <WifiOff className="h-10 w-10 text-amber-500" />
      </div>

      {/* Title */}
      <h1 className="text-xl font-bold text-center mb-2">
        {t('Không có kết nối', 'No Connection')}
      </h1>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-8">
        {t(
          'Bạn hiện đang offline. Kiểm tra kết nối mạng và thử lại.',
          'You are currently offline. Check your internet connection and try again.'
        )}
      </p>

      {/* Connection status indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            isOnline ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {isOnline
            ? t('Đã kết nối lại!', 'Connected again!')
            : t('Vẫn đang offline', 'Still offline')}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={handleRetry} className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          {t('Thử lại', 'Try Again')}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.update());
              });
            }
            setTimeout(handleRetry, 1000);
          }}
          className="w-full"
        >
          {t('Làm mới bộ nhớ đệm', 'Refresh Cache')}
        </Button>
      </div>

      {/* Footer hint */}
      <p className="text-[11px] text-muted-foreground/60 mt-8 text-center">
        {t(
          'Một số trang đã truy cập có thể hoạt động offline',
          'Some previously visited pages may work offline'
        )}
      </p>
    </div>
  );
}
