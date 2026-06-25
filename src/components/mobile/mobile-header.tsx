'use client';

import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, Search, ArrowLeft, Menu } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// ============================================
// Mobile Header Component
// ============================================

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  showMenu?: boolean;
  transparent?: boolean;
  onBack?: () => void;
  onSearch?: () => void;
  rightAction?: React.ReactNode;
}

export function MobileHeader({
  title,
  showBack = false,
  showSearch = false,
  showNotifications = true,
  showMenu = false,
  transparent = false,
  onBack,
  onSearch,
  rightAction,
}: MobileHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const unreadCount = useAppStore((s) => s.unreadCount());
  const locale = useAppStore((s) => s.locale);

  // Auto-title from pathname
  const autoTitle = !title ? getAutoTitle(pathname, locale) : null;
  const displayTitle = title || autoTitle || 'ALADIN';

  return (
    <header
      className={`sticky top-0 z-50 flex items-center justify-between px-4 h-14 border-b backdrop-blur-md ${
        transparent
          ? 'bg-transparent border-transparent'
          : 'bg-background/95 border-border'
      }`}
    >
      {/* Left section */}
      <div className="flex items-center gap-2 min-w-0">
        {showBack ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={onBack || (() => router.back())}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : showMenu ? (
          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
            <Menu className="h-5 w-5" />
          </Button>
        ) : null}

        {/* Title */}
        <h1 className="text-base font-semibold truncate">{displayTitle}</h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {rightAction}
        {showSearch && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={onSearch}
          >
            <Search className="h-5 w-5" />
          </Button>
        )}

        {showNotifications && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 relative"
            onClick={() => router.push('/m/notifications')}
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground rounded-full border border-background">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        )}

        {/* User avatar */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => router.push('/m/profile')}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
              {user?.name?.slice(0, 2)?.toUpperCase() || 'A'}
            </AvatarFallback>
          </Avatar>
        </Button>
      </div>
    </header>
  );
}

// ============================================
// Helpers
// ============================================

function getAutoTitle(pathname: string, locale: string): string | null {
  const titles: Record<string, { vi: string; en: string }> = {
    '/m': { vi: 'ALADIN', en: 'ALADIN' },
    '/m/orders': { vi: 'Đơn hàng', en: 'Orders' },
    '/m/products': { vi: 'Sản phẩm', en: 'Products' },
    '/m/cart': { vi: 'Giỏ hàng', en: 'Cart' },
    '/m/credit': { vi: 'Công nợ', en: 'Credit' },
    '/m/profile': { vi: 'Tài khoản', en: 'Profile' },
    '/m/notifications': { vi: 'Thông báo', en: 'Notifications' },
    '/m/settings': { vi: 'Cài đặt', en: 'Settings' },
    '/m/shipments': { vi: 'Vận chuyển', en: 'Shipments' },
    '/m/group-buy': { vi: 'Mua chung', en: 'Group Buy' },
    '/m/promotions': { vi: 'Khuyến mãi', en: 'Promotions' },
    '/m/merchandising': { vi: 'Trung bay', en: 'Merchandising' },
    '/m/login': { vi: 'Đăng nhập', en: 'Login' },
    '/m/register': { vi: 'Đăng ký', en: 'Register' },
    '/m/sales-rep': { vi: 'Sales Rep', en: 'Sales Rep' },
    '/m/sales-rep/route': { vi: 'Tuyến hôm nay', en: "Today's Route" },
    '/m/sales-rep/visit': { vi: 'Thăm khách hàng', en: 'Visit Shop' },
    '/m/sales-rep/history': { vi: 'Lịch sử thăm', en: 'Visit History' },
    '/m/sales-rep/performance': { vi: 'Hiệu suất', en: 'Performance' },
    '/m/driver': { vi: 'Tài xế', en: 'Driver' },
    '/m/driver/deliveries': { vi: 'Giao hàng', en: 'Deliveries' },
    '/m/driver/earnings': { vi: 'Doanh thu', en: 'Earnings' },
    '/m/distributor': { vi: 'Kho hàng', en: 'Warehouse' },
    '/m/distributor/customers': { vi: 'Khách hàng', en: 'Customers' },
    '/m/distributor/group-buy': { vi: 'Mua chung', en: 'Group Buy' },
    '/m/distributor/margins': { vi: 'Phân tích GVM', en: 'GVM Analytics' },
    '/m/distributor/price-tiers': { vi: 'Bảng giá', en: 'Price Tiers' },
    '/m/distributor/daily-report': { vi: 'Báo cáo ngày', en: 'Daily Report' },
  };
  const t = titles[pathname];
  return t ? (locale === 'vi' ? t.vi : t.en) : null;
}
