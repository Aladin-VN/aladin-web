'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Package,
  ShoppingCart,
  CreditCard,
  User,
  Truck,
  HandCoins,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/stores/cart.store';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { ROLES } from '@/lib/security';

// ============================================
// Tab configuration with RBAC
// ============================================

interface NavTab {
  href: string;
  labelVi: string;
  labelEn: string;
  icon: React.ReactNode;
  badge?: () => number | null;
  roles?: string[]; // If set, only visible to these roles
}

const tabs: NavTab[] = [
  {
    href: '/m',
    labelVi: 'Trang chủ',
    labelEn: 'Home',
    icon: <Home className="h-5 w-5" />,
    // Visible to all roles
  },
  {
    href: '/m/products',
    labelVi: 'Sản phẩm',
    labelEn: 'Products',
    icon: <Package className="h-5 w-5" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP, ROLES.SHOP_OWNER],
  },
  {
    href: '/m/orders',
    labelVi: 'Đơn hàng',
    labelEn: 'Orders',
    icon: <ShoppingCart className="h-5 w-5" />,
    // Visible to all roles
  },
  {
    href: '/m/credit',
    labelVi: 'Công nợ',
    labelEn: 'Credit',
    icon: <CreditCard className="h-5 w-5" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP, ROLES.SHOP_OWNER],
  },
  {
    href: '/m/shipments',
    labelVi: 'Vận chuyển',
    labelEn: 'Shipments',
    icon: <Truck className="h-5 w-5" />,
    roles: [ROLES.ADMIN, ROLES.DRIVER],
  },
  {
    href: '/m/broker',
    labelVi: 'Hoa hồng',
    labelEn: 'Commission',
    icon: <HandCoins className="h-5 w-5" />,
    roles: [ROLES.ADMIN, ROLES.BROKER],
  },
  {
    href: '/m/profile',
    labelVi: 'Tài khoản',
    labelEn: 'Account',
    icon: <User className="h-5 w-5" />,
    // Visible to all roles
  },
];

// ============================================
// Bottom Navigation Component
// ============================================

interface MobileBottomNavProps {
  locale?: string;
}

export function MobileBottomNav({ locale = 'vi' }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const cartItemCount = useCartStore((s) => s.itemCount());
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role;

  // Filter tabs by role
  const visibleTabs = userRole
    ? tabs.filter((tab) => !tab.roles || tab.roles.includes(userRole))
    : tabs; // Show all during hydration

  // Exact or child route match
  const isActive = (href: string) => {
    if (href === '/m') return pathname === '/m';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {visibleTabs.map((tab) => {
          const active = isActive(tab.href);
          const badgeCount = tab.badge?.() || null;
          // Show cart count on orders tab if items exist
          const showBadge = tab.href === '/m/orders' && cartItemCount > 0;

          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {showBadge && (
                  <Badge className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground rounded-full">
                    {cartItemCount > 9 ? '9+' : cartItemCount}
                  </Badge>
                )}
                {badgeCount !== null && badgeCount > 0 && !showBadge && (
                  <Badge className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground rounded-full">
                    {badgeCount}
                  </Badge>
                )}
              </div>
              <span className={`text-[10px] leading-tight ${active ? 'font-semibold' : 'font-medium'}`}>
                {locale === 'vi' ? tab.labelVi : tab.labelEn}
              </span>
              {/* Active indicator bar */}
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}