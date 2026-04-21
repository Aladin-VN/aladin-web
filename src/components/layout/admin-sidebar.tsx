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
  Tag,
  Gift,
  Warehouse,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
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

interface NavItem {
  title: string;
  titleVi: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
  children?: { title: string; titleVi: string; href: string }[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    titleVi: 'Tong quan',
    href: '/',
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    title: 'Orders',
    titleVi: 'Don hang',
    href: '/orders',
    icon: <ShoppingCart className="h-4 w-4" />,
  },
  {
    title: 'Products',
    titleVi: 'San pham',
    href: '/products',
    icon: <Package className="h-4 w-4" />,
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
    badge: 0,
  },
  {
    title: 'Group Buy',
    titleVi: 'Mua chung',
    href: '/group-buy',
    icon: <Tag className="h-4 w-4" />,
  },
  {
    title: 'Credit & Finance',
    titleVi: 'Cong no',
    href: '/credit',
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    title: 'Logistics',
    titleVi: 'Van chuyen',
    href: '/shipments',
    icon: <Truck className="h-4 w-4" />,
  },
  {
    title: 'Supply Chain',
    titleVi: 'Chuoi cung ung',
    href: '/supply-chain',
    icon: <Warehouse className="h-4 w-4" />,
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
    children: [
      { title: 'Overview', titleVi: 'Tong quan', href: '/reports' },
      { title: 'Revenue', titleVi: 'Doanh thu', href: '/reports?tab=revenue' },
      { title: 'Orders', titleVi: 'Don hang', href: '/reports?tab=orders' },
      { title: 'Products', titleVi: 'San pham', href: '/reports?tab=products' },
      { title: 'Shops', titleVi: 'Cua hang', href: '/reports?tab=shops' },
      { title: 'Shipments', titleVi: 'Van chuyen', href: '/reports?tab=shipments' },
    ],
  },
  {
    title: 'Settings',
    titleVi: 'Cai dat',
    href: '/settings',
    icon: <Settings className="h-4 w-4" />,
    children: [
      { title: 'Platform Config', titleVi: 'Cau hinh', href: '/settings' },
      { title: 'Users', titleVi: 'Nguoi dung', href: '/settings/users' },
      { title: 'Audit Log', titleVi: 'Nhat ky', href: '/settings/audit-log' },
    ],
  },
];

interface AdminSidebarProps {
  locale?: string;
  userName?: string;
  userRole?: string;
}

export function AdminSidebar({ locale: localeProp, userName: userNameProp, userRole: userRoleProp }: AdminSidebarProps) {
  const pathname = usePathname();
  const { logout: authLogout, user: authUser } = useAuth();
  const { locale: contextLocale } = useLocale();
  const locale = localeProp || contextLocale;
  const userName = userNameProp || authUser?.name || 'Admin User';
  const userRole = userRoleProp || authUser?.role || 'ADMIN';
  const t = (title: string, titleVi: string) => locale === 'vi' ? titleVi : title;

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
            A
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">ALADIN</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {locale === 'vi' ? 'AI Thương mại B2B' : 'AI B2B Commerce'}
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3 py-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs text-muted-foreground">
            {locale === 'vi' ? 'DIEU HUONG' : 'NAVIGATION'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
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

      <SidebarFooter className="border-t p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                      {userName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start text-sm">
                    <span>{userName}</span>
                    <span className="text-[10px] text-muted-foreground">{userRole}</span>
                  </div>
                  <ChevronDown className="ml-auto h-4 w-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    {locale === 'vi' ? 'Ho so' : 'Profile'}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={authLogout} className="text-red-600 focus:text-red-600">
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
