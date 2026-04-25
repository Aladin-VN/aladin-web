'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  HardDrive,
  Trash2,
  RefreshCw,
  Download,
  ChevronRight,
  AlertTriangle,
  Check,
  LogOut,
  Loader2,
  Shield,
} from 'lucide-react';

// ============================================
// Data & Storage Page
// ============================================

interface StorageInfo {
  appData: number;
  cacheData: number;
  totalEstimate: number;
}

export default function DataStoragePage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const clearNotifications = useAppStore((s) => s.clearNotifications);
  const logout = useAuthStore((s) => s.logout);
  const clearCart = useCartStore((s) => s.clearCart);
  const { clearCache } = useServiceWorker();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    appData: 0,
    cacheData: 0,
    totalEstimate: 0,
  });
  const [isInstalled, setIsInstalled] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Calculate storage usage
  useEffect(() => {
    calculateStorage();
    checkIfInstalled();
  }, []);

  const calculateStorage = useCallback(async () => {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const totalEstimate = estimate.quota ? estimate.quota / (1024 * 1024) : 0;
        const cacheData = estimate.usage ? estimate.usage / (1024 * 1024) : 0;
        setStorageInfo({
          appData: Math.round(cacheData * 100) / 100,
          cacheData: Math.round(cacheData * 100) / 100,
          totalEstimate: Math.round(totalEstimate * 100) / 100,
        });
      } else {
        // Fallback: estimate from localStorage
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            total += (localStorage.getItem(key) || '').length * 2; // UTF-16 = 2 bytes/char
          }
        }
        const kb = total / 1024;
        setStorageInfo({
          appData: Math.round(kb * 100) / 100,
          cacheData: 0,
          totalEstimate: Math.round(kb * 100) / 100,
        });
      }
    } catch {
      // Privacy mode might block this
    }
  }, []);

  const checkIfInstalled = () => {
    // Check if running as standalone PWA
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches || (window.navigator as unknown as { standalone: boolean }).standalone === true);
  };

  const handleClearCache = async () => {
    setClearing(true);
    try {
      // Clear SW cache
      await clearCache();

      // Clear notifications
      clearNotifications();

      // Clear cart
      clearCart();

      // Force refresh
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch {
      setClearing(false);
    }
  };

  const handleFullReset = () => {
    // Clear all localStorage
    localStorage.clear();

    // Clear caches
    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => caches.delete(key));
      });
    }

    // Logout and redirect
    logout();
    router.replace('/m/login');
  };

  const handleLogout = () => {
    logout();
    router.replace('/m/login');
  };

  const formatBytes = (mb: number) => {
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${(mb * 1024).toFixed(0)} KB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Dữ liệu & Bộ nhớ', 'Data & Storage')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Installation status */}
        <Card className={isInstalled ? 'border-emerald-200 dark:border-emerald-800' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                isInstalled
                  ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30'
                  : 'bg-muted text-muted-foreground'
              }`}>
                <Download className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {isInstalled
                    ? t('Đã cài đặt như ứng dụng', 'Installed as App')
                    : t('Chưa cài đặt', 'Not Installed')}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {isInstalled
                    ? t('ALADIN đang chạy ở chế độ standalone', 'Running in standalone mode')
                    : t('Cài đặt để trải nghiệm tốt hơn', 'Install for better experience')}
                </p>
              </div>
              {isInstalled && (
                <Shield className="h-4 w-4 text-emerald-500" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Storage info */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('Bộ nhớ', 'Storage')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {/* App data */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t('Dữ liệu ứng dụng', 'App Data')}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">
                {formatBytes(storageInfo.appData)}
              </span>
            </div>

            <Separator />

            {/* Cache */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t('Bộ nhớ đệm', 'Cache')}</span>
              </div>
              <span className="text-sm font-mono text-muted-foreground">
                {formatBytes(storageInfo.cacheData)}
              </span>
            </div>

            {storageInfo.totalEstimate > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t('Tổng quota', 'Total Quota')}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatBytes(storageInfo.totalEstimate)}
                  </span>
                </div>
              </>
            )}

            {/* Storage bar */}
            {storageInfo.totalEstimate > 0 && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((storageInfo.appData / storageInfo.totalEstimate) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right">
                  {((storageInfo.appData / storageInfo.totalEstimate) * 100).toFixed(1)}% {t('đã sử dụng', 'used')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('Quản lý dữ liệu', 'Manage Data')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Clear cache */}
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 text-left">
                {t('Xóa bộ nhớ đệm', 'Clear Cache')}
              </span>
              {clearing ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              )}
            </button>
            <Separator />
            {/* Clear notifications */}
            <button
              onClick={() => {
                clearNotifications();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1 text-left">
                {t('Xóa thông báo', 'Clear Notifications')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>
          </CardContent>
        </Card>

        {/* Danger zone */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-destructive">
              {t('Vùng nguy hiểm', 'Danger Zone')}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-2 space-y-3">
            {/* Warning */}
            <div className="flex items-start gap-2 px-1">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                {t(
                  'Các hành động dưới đây không thể hoàn tác.',
                  'These actions cannot be undone.'
                )}
              </p>
            </div>

            {/* Full reset */}
            <Button
              variant="outline"
              className="w-full h-11 border-destructive/40 text-destructive hover:text-destructive hover:bg-destructive/5"
              onClick={handleFullReset}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('Đặt lại tất cả dữ liệu', 'Reset All Data')}
            </Button>

            {/* Logout */}
            {!showLogoutConfirm ? (
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOut className="mr-2 h-4 w-4" />
                {t('Đăng xuất', 'Sign Out')}
              </Button>
            ) : (
              <div className="space-y-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-xs text-sm text-destructive">
                  {t('Bạn chắc chắn muốn đăng xuất?', 'Are you sure you want to sign out?')}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={handleLogout}
                  >
                    {t('Đăng xuất', 'Sign Out')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    {t('Hủy', 'Cancel')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
