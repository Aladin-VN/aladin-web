'use client';

import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app.store';

export function NotificationBell() {
  const router = useRouter();
  const unreadCount = useAppStore((s) => s.unreadCount());

  return (
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
  );
}
