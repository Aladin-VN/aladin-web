'use client';

import { useEffect, useRef, useSyncExternalStore, useState } from 'react';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useRealtime } from '@/hooks/use-realtime';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { X, WifiOff, Download, RefreshCw, CloudOff, CheckCircle2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectionStatus } from '@/components/mobile/connection-status';
import { PushPermissionPrompt } from '@/components/mobile/push-permission-prompt';

// ============================================
// Mobile Shell — Network status, install prompt, hydration, SW registration,
//               real-time WS, offline sync, push notifications
// ============================================

export function MobileShell() {
  const initialized = useRef(false);
  const isOnline = useAppStore((s) => s.isOnline);
  const showInstallPrompt = useAppStore((s) => s.showInstallPrompt);
  const setOnline = useAppStore((s) => s.setOnline);
  const hydrate = useAuthStore((s) => s.hydrate);
  const dismissInstallPrompt = useAppStore((s) => s.dismissInstallPrompt);
  const locale = useAppStore((s) => s.locale);
  const { registerSW } = useServiceWorker();
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [syncBanner, setSyncBanner] = useState<{ synced: number; failed: number } | null>(null);

  // Real-time WebSocket connection
  const { connected: wsConnected } = useRealtime();

  // Offline sync
  const { queueCount, syncing, lastSyncResult, syncNow } = useOfflineSync();

  // Auth state for conditional push prompt
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Client-only rendering via useSyncExternalStore
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Show sync result banner
  useEffect(() => {
    if (lastSyncResult && lastSyncResult.synced > 0) {
      setSyncBanner({ synced: lastSyncResult.synced, failed: lastSyncResult.failed });
      const timer = setTimeout(() => setSyncBanner(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Hydrate auth state from localStorage
    hydrate();

    // Set initial locale
    const savedLocale = localStorage.getItem('aladin-locale');
    if (savedLocale === 'vi' || savedLocale === 'en') {
      useAppStore.getState().setLocale(savedLocale);
    }

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      useAppStore.getState().setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register service worker
    registerSW();

    // Listen for SW updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [hydrate, setOnline, registerSW]);

  if (!mounted) return null;

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <WifiOff className="h-3.5 w-3.5" />
          {locale === 'vi' ? 'Mất kết nối mạng' : 'No internet connection'}
          {queueCount > 0 && (
            <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-white/20">
              <CloudOff className="h-3 w-3" />
              {queueCount} {locale === 'vi' ? 'chờ gửi' : 'pending'}
            </span>
          )}
        </div>
      )}

      {/* Sync complete banner */}
      {syncBanner && isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-600 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {locale === 'vi'
            ? `Đã đồng bộ ${syncBanner.synced} mục${syncBanner.failed > 0 ? `, ${syncBanner.failed} lỗi` : ''}`
            : `Synced ${syncBanner.synced} items${syncBanner.failed > 0 ? `, ${syncBanner.failed} failed` : ''}`
          }
          <button onClick={() => setSyncBanner(null)} className="ml-2">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Update available banner */}
      {updateAvailable && !syncBanner && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          {locale === 'vi' ? 'Cập nhật mới sẵn sàng' : 'Update available'}
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline font-semibold"
          >
            {locale === 'vi' ? 'Tải lại' : 'Reload'}
          </button>
          <button onClick={() => setUpdateAvailable(false)} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Connection status indicator in offline banner */}
      {!isOnline && (
        <div className="fixed top-8 left-2 z-[101]">
          <ConnectionStatus
            wsConnected={false}
            isOnline={false}
            offlineQueueCount={queueCount}
            syncing={syncing}
            compact
          />
        </div>
      )}

      {/* WS reconnection indicator when online but WS disconnected */}
      {isOnline && !wsConnected && (
        <div className="fixed top-2 right-2 z-[95]">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
            <Radio className="h-3 w-3 text-amber-500 animate-pulse" />
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              {locale === 'vi' ? 'Đang kết nối...' : 'Reconnecting...'}
            </span>
          </span>
        </div>
      )}

      {/* Push notification permission prompt (auto-shows after 8s for authenticated users) */}
      {isAuthenticated && <PushPermissionPrompt delaySeconds={8} />}

      {/* PWA install prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-20 left-4 right-4 z-[90] bg-card border border-border rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {locale === 'vi' ? 'Cài đặt ALADIN' : 'Install ALADIN'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === 'vi'
                  ? 'Truy cập nhanh từ màn hình chính'
                  : 'Quick access from home screen'}
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-8 text-xs" onClick={handleInstall}>
                  {locale === 'vi' ? 'Cài đặt' : 'Install'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  onClick={dismissInstallPrompt}
                >
                  {locale === 'vi' ? 'Để sau' : 'Later'}
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 -mt-1 -mr-1"
              onClick={dismissInstallPrompt}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// PWA Install Handler
// ============================================

async function handleInstall() {
  const { deferredPrompt, dismissInstallPrompt } = useAppStore.getState();
  if (deferredPrompt) {
    try {
      const promptEvent = deferredPrompt as { prompt: () => Promise<void> };
      await promptEvent.prompt();
    } catch {}
    dismissInstallPrompt();
  }
}
