'use client';

import { Bell, Search, Globe, LogOut, User, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { useLocale, useAuth } from '@/providers/app-provider';
import { useRouter } from 'next/navigation';

// ============================================
// Admin Header — Global top bar
// Locale toggle + Notifications + User menu with Logout
// ============================================

export function AdminHeader() {
  const { locale, setLocale } = useLocale();
  const { user, logout } = useAuth();
  const router = useRouter();

  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const toggleLocale = () => {
    setLocale(locale === 'vi' ? 'en' : 'vi');
  };

  const displayName = user?.name || 'Admin';
  const displayRole = user?.role || 'ADMIN';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-red-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-4 shadow-sm">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />

      {/* Search */}
      <div className="flex-1 max-w-md hidden sm:block">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t('Search...', 'Tim kiem...')}
            className="pl-8 h-9 bg-gray-50 border border-gray-200 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-red-200 focus-visible:border-red-200"
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 ml-auto">
        {/* Language Toggle — Always visible */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleLocale}
          className="h-8 px-2.5 gap-1.5 text-xs font-bold border-yellow-400 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-500 shadow-sm"
        >
          <Globe className="h-3.5 w-3.5 text-yellow-600" />
          {locale === 'vi' ? 'VI' : 'EN'}
        </Button>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white font-bold ring-2 ring-white">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 border-b">
              <h3 className="text-sm font-semibold">
                {t('Notifications', 'Thong bao')}
              </h3>
            </div>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <span className="text-sm font-medium">
                {t('3 shops overdue on credit', '3 cua hang qua han no')}
              </span>
              <span className="text-xs text-muted-foreground">5 {t('minutes ago', 'phut truoc')}</span>
              <Badge variant="destructive" className="text-[10px]">
                {t('Alert', 'Canh bao')}
              </Badge>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <span className="text-sm font-medium">
                {t('Group Buy deal target reached', 'Deal mua chung dat muc tieu')}
              </span>
              <span className="text-xs text-muted-foreground">1 {t('hour ago', 'gio truoc')}</span>
              <Badge className="text-[10px] bg-yellow-50 text-red-700 hover:bg-yellow-50">
                {t('Success', 'Thanh cong')}
              </Badge>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <span className="text-sm font-medium">
                {t('Order #ALD-001 delivered', 'Don hang #ALD-001 giao thanh cong')}
              </span>
              <span className="text-xs text-muted-foreground">2 {t('hours ago', 'gio truoc')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu with Logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2 hover:bg-red-50">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-red-600 text-white text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm font-medium max-w-[100px] truncate">
                {displayName}
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{displayName}</span>
                <span className="text-xs text-muted-foreground">{displayRole}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <User className="mr-2 h-4 w-4" />
              {t('Profile', 'Ho so')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              {t('Settings', 'Cai dat')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              {t('Logout', 'Dang xuat')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
