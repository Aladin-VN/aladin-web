import type { Metadata, Viewport } from 'next';
import { MobileBottomNav } from '@/components/mobile/mobile-bottom-nav';
import { MobileShell } from './mobile-shell';

// ============================================
// Mobile PWA Metadata
// ============================================

export const metadata: Metadata = {
  title: 'ALADIN — B2B Thương mại',
  description: 'Đặt hàng trong 10 giây, không phải 10 phút',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ALADIN',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png' },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
};

// ============================================
// Mobile Layout
// ============================================

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Content area with bottom padding for nav */}
      <div className="flex-1 pb-16">
        {children}
      </div>

      {/* Bottom tab navigation */}
      <MobileBottomNav />

      {/* Mobile app shell (network status, install prompt, etc.) */}
      <MobileShell />
    </div>
  );
}
