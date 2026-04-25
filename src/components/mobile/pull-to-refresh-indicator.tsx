'use client';

import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

// ============================================
// Pull-to-Refresh Indicator
// ============================================

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  threshold: number;
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  threshold,
}: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1);
  const show = pullDistance > 0 || isRefreshing;

  if (!show) return null;

  return (
    <div className="flex justify-center py-2">
      <div
        className={cn(
          'h-8 w-8 rounded-full bg-muted flex items-center justify-center transition-all',
          isRefreshing ? 'opacity-100' : 'opacity-70'
        )}
        style={{
          transform: `rotate(${progress * 360}deg)`,
          opacity: isRefreshing ? 1 : Math.min(progress + 0.3, 1),
        }}
      >
        <RefreshCw
          className={cn(
            'h-4 w-4 text-muted-foreground',
            isRefreshing && 'animate-spin'
          )}
        />
      </div>
    </div>
  );
}
