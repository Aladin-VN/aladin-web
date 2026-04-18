'use client';

import { Bell, Search, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';

interface AdminHeaderProps {
  locale: string;
  onLocaleChange?: (locale: string) => void;
}

export function AdminHeader({ locale, onLocaleChange }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-6" />

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={locale === 'vi' ? 'Tim kiem...' : 'Search...'}
            className="pl-8 h-9 bg-muted/50 border-0 focus-visible:bg-background focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onLocaleChange?.('vi')}>
              🇻🇳 Tiếng Việt
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onLocaleChange?.('en')}>
              🇬🇧 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold">
                3
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="px-3 py-2 border-b">
              <h3 className="text-sm font-semibold">
                {locale === 'vi' ? 'Thong bao' : 'Notifications'}
              </h3>
            </div>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <span className="text-sm font-medium">
                {locale === 'vi' ? '3 cua hang qua han no' : '3 shops overdue on credit'}
              </span>
              <span className="text-xs text-muted-foreground">5 {locale === 'vi' ? 'phut truoc' : 'minutes ago'}</span>
              <Badge variant="destructive" className="text-[10px]">
                {locale === 'vi' ? 'Canh bao' : 'Alert'}
              </Badge>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <span className="text-sm font-medium">
                {locale === 'vi' ? 'Deal mua chung dat muc tieu' : 'Group Buy deal target reached'}
              </span>
              <span className="text-xs text-muted-foreground">1 {locale === 'vi' ? 'gio truoc' : 'hour ago'}</span>
              <Badge className="text-[10px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                {locale === 'vi' ? 'Thanh cong' : 'Success'}
              </Badge>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3">
              <span className="text-sm font-medium">
                {locale === 'vi' ? 'Don hang #ALD-001 giao thanh cong' : 'Order #ALD-001 delivered'}
              </span>
              <span className="text-xs text-muted-foreground">2 {locale === 'vi' ? 'gio truoc' : 'hours ago'}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
