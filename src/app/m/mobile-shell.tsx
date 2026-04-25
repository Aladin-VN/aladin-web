'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { X, WifiOff, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ============================================
// Mobile Shell — Network status, install prompt, hydration
// ============================================

export function MobileShell() {
  const initialized = useRef(false);
  const isOnline = useAppStore((s) => s.isOnline);
  const showInstallPrompt = useAppStore((s) => s.showInstallPrompt);
  const setOnline = useAppStore((s) => s.setOnline);
  const hydrate = useAuthStore((s) => s.hydrate);
  const dismissInstallPrompt = useAppStore((s) => s.dismissInstallPrompt);
  const locale = useAppStore((s) => s.locale);

  // Client-only rendering via useSyncExternalStore
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

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

    // Network status listeners
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      useAppStore.getState().setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [hydrate, setOnline]);

  if (!mounted) return null;

  return (
    <>
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-white text-center py-2 px-4 text-xs font-medium flex items-center justify-center gap-2">
          <WifiOff className="h-3.5 w-3.5" />
          {locale === 'vi' ? 'Mất kết nối mạng' : 'No internet connection'}
        </div>
      )}

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
