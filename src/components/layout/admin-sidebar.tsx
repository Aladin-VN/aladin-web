'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useLocale } from '@/providers/app-provider';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Store,
  Users,
  Truck,
  CreditCard,
  Wallet,
  Tag,
  Gift,
  Warehouse,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Monitor,
  Calculator,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ROLES } from '@/lib/security';

interface NavItem {
  title: string;
  titleVi: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  children?: { title: string; titleVi: string; href: string }[];
  /** Which roles can see this item. Empty = all roles */
  roles?: string[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    titleVi: 'Tong quan',
    href: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP, ROLES.SHOP_OWNER, ROLES.BROKER],
  },
  // Distributor-specific pages
  {
    title: 'Distributor Dashboard',
    titleVi: 'Tong quan NPP',
    href: '/distributor',
    icon: <Warehouse className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'Orders',
    titleVi: 'Don hang NPP',
    href: '/distributor/orders',
    icon: <ShoppingCart className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'Inventory',
    titleVi: 'Kho hang',
    href: '/distributor/inventory',
    icon: <Package className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'Analytics',
    titleVi: 'Phan tich',
    href: '/distributor/analytics',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'AR Ledger',
    titleVi: 'Cong no',
    href: '/distributor/ar-ledger',
    icon: <CreditCard className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'POS Terminal',
    titleVi: 'Ban hang',
    href: '/distributor/pos',
    icon: <Monitor className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'Shift Recon',
    titleVi: 'Doi so ca',
    href: '/distributor/pos/reconciliation',
    icon: <Calculator className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'AI Assistant',
    titleVi: 'Tro ly AI',
    href: '/distributor/ai-assistant',
    icon: <Brain className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'Settlements',
    titleVi: 'Quyet toan',
    href: '/distributor/settlements',
    icon: <Wallet className="h-4 w-4" />,
    roles: [ROLES.DISTRIBUTOR],
  },
  {
    title: 'Orders',
    titleVi: 'Don hang',
    href: '/orders',
    icon: <ShoppingCart className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP, ROLES.SHOP_OWNER, ROLES.DRIVER, ROLES.BROKER],
  },
  {
    title: 'Products',
    titleVi: 'San pham',
    href: '/products',
    icon: <Package className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP],
    children: [
      { title: 'Product Catalog', titleVi: 'Danh muc SP', href: '/products' },
      { title: 'Categories', titleVi: 'Danh muc', href: '/products/categories' },
    ],
  },
  {
    title: 'Shops',
    titleVi: 'Cua hang',
    href: '/shops',
    icon: <Store className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP, ROLES.BROKER],
  },
  {
    title: 'Group Buy',
    titleVi: 'Mua chung',
    href: '/group-buy',
    icon: <Tag className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SHOP_OWNER],
  },
  {
    title: 'Credit & Finance',
    titleVi: 'Cong no',
    href: '/credit',
    icon: <CreditCard className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP, ROLES.SHOP_OWNER],
  },
  {
    title: 'Logistics',
    titleVi: 'Van chuyen',
    href: '/shipments',
    icon: <Truck className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.DRIVER, ROLES.SHOP_OWNER],
  },
  {
    title: 'Settlements',
    titleVi: 'Quyết toán',
    href: '/settlements',
    icon: <Wallet className="h-4 w-4" />,
    roles: [ROLES.ADMIN],
  },
  {
    title: 'Supply Chain',
    titleVi: 'Chuoi cung ung',
    href: '/supply-chain',
    icon: <Warehouse className="h-4 w-4" />,
    roles: [ROLES.ADMIN],
    children: [
      { title: 'Manufacturers', titleVi: 'Nha SX', href: '/supply-chain/manufacturers' },
      { title: 'Distributors', titleVi: 'Nha PP', href: '/supply-chain/distributors' },
    ],
  },
  {
    title: 'Trade Marketing',
    titleVi: 'Trade Marketing',
    href: '/trade-marketing',
    icon: <Gift className="h-4 w-4" />,
    roles: [ROLES.ADMIN],
    children: [
      { title: 'Promotions', titleVi: 'Khuyen mai', href: '/trade-marketing/promotions' },
      { title: 'Merchandising', titleVi: 'Trung bay', href: '/trade-marketing/merchandising' },
    ],
  },
  {
    title: 'Broker Network',
    titleVi: 'Dai ly',
    href: '/brokers',
    icon: <Users className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.BROKER],
    children: [
      { title: 'All Brokers', titleVi: 'Dai ly', href: '/brokers' },
      { title: 'Commissions', titleVi: 'Hoa hong', href: '/brokers/commissions' },
      { title: 'Territories', titleVi: 'Khu vuc', href: '/brokers/territories' },
    ],
  },
  {
    title: 'Reports',
    titleVi: 'Bao cao',
    href: '/reports',
    icon: <BarChart3 className="h-4 w-4" />,
    roles: [ROLES.ADMIN, ROLES.SALES_REP],
    children: [
      { title: 'Overview', titleVi: 'Tong quan', href: '/reports' },
      { title: 'Revenue', titleVi: 'Doanh thu', href: '/reports?tab=revenue' },
      { title: 'Orders', titleVi: 'Don hang', href: '/reports?tab=orders' },
      { title: 'Products', titleVi: 'San pham', href: '/reports?tab=products' },
    ],
  },
  {
    title: 'Settings',
    titleVi: 'Cai dat',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
    roles: [ROLES.ADMIN],
    children: [
      { title: 'Platform Config', titleVi: 'Cau hinh', href: '/settings' },
      { title: 'Users', titleVi: 'Nguoi dung', href: '/settings/users' },
      { title: 'Audit Log', titleVi: 'Nhat ky', href: '/settings/audit-log' },
    ],
  },
];

/** Role display labels */
const ROLE_LABELS: Record<string, { en: string; vi: string; color: string }> = {
  ADMIN: { en: 'Admin', vi: 'Quan tri', color: 'bg-yellow-100 text-yellow-700' },
  SHOP_OWNER: { en: 'Shop Owner', vi: 'Chu cua hang', color: 'bg-red-50 text-red-700' },
  SALES_REP: { en: 'Sales Rep', vi: 'Nhan vien ban', color: 'bg-orange-100 text-orange-700' },
  DRIVER: { en: 'Driver', vi: 'Tai xe', color: 'bg-blue-100 text-blue-700' },
  BROKER: { en: 'Broker', vi: 'Dai ly', color: 'bg-purple-100 text-purple-700' },
  DISTRIBUTOR: { en: 'Distributor', vi: 'Nha PP', color: 'bg-emerald-100 text-emerald-700' },
};

export function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { locale } = useLocale();
  const t = (title: string, titleVi: string) => locale === 'vi' ? titleVi : title;

  const userName = user?.name || 'User';
  const userRole = user?.role;
  const roleLabel = userRole ? (ROLE_LABELS[userRole] || ROLE_LABELS.SHOP_OWNER) : null;
  const initials = userName.split(' ').map((n) => n[0]).join('').slice(0, 2);

  // Filter nav items by role
  // During hydration (no userRole yet), show all items to avoid flash of empty sidebar
  const visibleItems = userRole
    ? navItems.filter((item) => !item.roles || item.roles.includes(userRole))
    : navItems;

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-lg shadow-yellow-500/30 text-red-700 font-extrabold text-base ring-1 ring-yellow-400/30">
            A
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">ALADIN</h1>
            <p className="text-[10px] text-sidebar-foreground/50 leading-tight font-medium uppercase tracking-widest">
              {locale === 'vi' ? 'AI Thương mại B2B' : 'AI B2B Commerce'}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] uppercase tracking-widest text-yellow-500/60 font-semibold">
            {locale === 'vi' ? 'DIEU HUONG' : 'NAVIGATION'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const hasChildren = item.children && item.children.length > 0;
                const isChildActive = hasChildren && item.children?.some((c) => pathname === c.href);

                if (hasChildren) {
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={isChildActive}
                        tooltip={t(item.title, item.titleVi)}
                      >
                        <Link href={item.href}>
                          {item.icon}
                          <span>{t(item.title, item.titleVi)}</span>
                          {isChildActive ? (
                            <ChevronDown className="ml-auto h-4 w-4" />
                          ) : (
                            <ChevronRight className="ml-auto h-4 w-4" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                      {(isChildActive) && (
                        <SidebarMenuSub>
                          {item.children?.map((child) => (
                            <SidebarMenuSubItem key={child.href}>
                              <SidebarMenuButton asChild isActive={pathname === child.href}>
                                <Link href={child.href}>
                                  <span>{t(child.title, child.titleVi)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      )}
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.title, item.titleVi)}>
                      <Link href={item.href}>
                        {item.icon}
                        <span>{t(item.title, item.titleVi)}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge variant="destructive" className="ml-auto h-5 min-w-5 text-[10px] px-1">
                            {item.badge > 99 ? '99+' : item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className={`${roleLabel ? roleLabel.color.split(' ')[0] : 'bg-yellow-100'} text-xs`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span className="truncate max-w-[120px]">{userName}</span>
                    {roleLabel && (
                      <Badge variant="secondary" className={`text-[9px] px-1 py-0 ${roleLabel.color} border-0`}>
                        {locale === 'vi' ? roleLabel.vi : roleLabel.en}
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/m/profile">
                    <User className="mr-2 h-4 w-4" />
                    {locale === 'vi' ? 'Ho so' : 'Profile'}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  {locale === 'vi' ? 'Dang xuat' : 'Logout'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}