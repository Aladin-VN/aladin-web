'use client';

import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Radio, Loader2, CloudOff } from 'lucide-react';

// ============================================
// Connection Status Types
// ============================================

interface ConnectionStatusProps {
  /** WebSocket connection state */
  wsConnected: boolean;
  /** Network online state */
  isOnline: boolean;
  /** Number of items in offline queue */
  offlineQueueCount?: number;
  /** Is sync in progress */
  syncing?: boolean;
  /** Compact mode (just a dot) */
  compact?: boolean;
  /** Show text label */
  showLabel?: boolean;
}

// ============================================
// Connection Status Indicator
// ============================================

export function ConnectionStatus({
  wsConnected,
  isOnline,
  offlineQueueCount = 0,
  syncing = false,
  compact = false,
  showLabel = false,
}: ConnectionStatusProps) {
  // Determine status
  let status: 'online' | 'ws-connected' | 'ws-disconnected' | 'offline' | 'syncing';
  let label: string;
  let labelEn: string;

  if (!isOnline) {
    status = 'offline';
    label = 'Mất mạng';
    labelEn = 'Offline';
  } else if (syncing) {
    status = 'syncing';
    label = 'Đang đồng bộ';
    labelEn = 'Syncing';
  } else if (wsConnected) {
    status = 'ws-connected';
    label = 'Kết nối';
    labelEn = 'Connected';
  } else {
    status = 'ws-disconnected';
    label = 'Chờ kết nối';
    labelEn = 'Reconnecting';
  }

  const statusConfig = {
    'online': { color: 'text-emerald-500', bg: 'bg-emerald-500', icon: Wifi },
    'ws-connected': { color: 'text-emerald-500', bg: 'bg-emerald-500', icon: Radio },
    'ws-disconnected': { color: 'text-amber-500', bg: 'bg-amber-500', icon: Radio },
    'offline': { color: 'text-red-500', bg: 'bg-red-500', icon: WifiOff },
    'syncing': { color: 'text-blue-500', bg: 'bg-blue-500', icon: Loader2 },
  }[status];

  const Icon = statusConfig.icon;

  if (compact) {
    return (
      <span className="relative inline-flex">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            statusConfig.bg,
            status === 'syncing' && 'animate-pulse',
            status === 'ws-disconnected' && 'animate-pulse'
          )}
        />
        {/* Offline queue badge */}
        {offlineQueueCount > 0 && (
          <span className="absolute -top-1 -right-1.5 h-3 min-w-3 px-0.5 text-[8px] font-bold text-white bg-orange-500 rounded-full flex items-center justify-center">
            {offlineQueueCount > 9 ? '9+' : offlineQueueCount}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className={cn(
          'h-3.5 w-3.5',
          statusConfig.color,
          status === 'syncing' && 'animate-spin'
        )}
      />
      {showLabel && (
        <span className={cn('text-[10px] font-medium', statusConfig.color)}>
          {label}
        </span>
      )}
      {/* Offline queue indicator */}
      {offlineQueueCount > 0 && !compact && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
          <CloudOff className="h-2.5 w-2.5" />
          <span className="text-[9px] font-semibold">{offlineQueueCount}</span>
        </span>
      )}
    </div>
  );
}