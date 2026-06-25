'use client';

import { useRouter } from 'next/navigation';
import { Bell, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';

interface NotificationBellProps {
  /** Show WS connection indicator dot */
  showConnectionStatus?: boolean;
  /** External unread count (from server API polling) */
  serverUnreadCount?: number;
  /** WS connection state from useRealtime hook */
  wsConnected?: boolean;
}

export function NotificationBell({
  showConnectionStatus = false,
  serverUnreadCount = 0,
  wsConnected = false,
}: NotificationBellProps) {
  const router = useRouter();
  const storeUnreadCount = useAppStore((s) => s.unreadCount());

  // Use the higher of store unread (WS-pushed) vs server unread (polled)
  const displayCount = Math.max(storeUnreadCount, serverUnreadCount);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 relative"
      onClick={() => router.push('/m/notifications')}
    >
      <Bell className="h-5 w-5" />
      {displayCount > 0 && (
        <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground rounded-full border border-background animate-in zoom-in duration-200">
          {displayCount > 99 ? '99+' : displayCount > 9 ? '9+' : displayCount}
        </Badge>
      )}
      {/* Connection status indicator */}
      {showConnectionStatus && (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background transition-colors duration-500',
            wsConnected ? 'bg-emerald-500' : 'bg-gray-400'
          )}
        />
      )}
    </Button>
  );
}