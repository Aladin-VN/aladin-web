'use client';

import { useState, useCallback } from 'react';

// ============================================
// Pull-to-Refresh Hook
// Triggers refresh on vertical swipe down past threshold
// ============================================

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    // Only activate at top of scroll
    const target = e.currentTarget;
    if (target.scrollTop <= 0) {
      setPullDistance(0);
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const target = e.currentTarget;

    if (target.scrollTop <= 0) {
      const touch = e.touches[0];
      const delta = Math.max(0, touch.clientY - (e as unknown as { startY: number }).startY || 0);
      const distance = delta / resistance;
      setPullDistance(Math.min(distance, threshold * 1.5));
    }
  }, [isRefreshing, threshold, resistance]);

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch {}
      setIsRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  // Record start Y on touch start
  const handleTouchStartWithY = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLElement & { startY: number };
    target.startY = e.touches[0].clientY;
    handleTouchStart(e);
  }, [handleTouchStart]);

  const handleTouchMoveWithY = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget as HTMLElement & { startY: number };
    if (target.scrollTop <= 0) {
      const touch = e.touches[0];
      const delta = Math.max(0, touch.clientY - (target.startY || 0));
      const distance = delta / resistance;
      setPullDistance(Math.min(distance, threshold * 1.5));
    }
  }, [threshold, resistance]);

  return {
    pullDistance,
    isRefreshing,
    pullHandlers: {
      onTouchStart: handleTouchStartWithY,
      onTouchMove: handleTouchMoveWithY,
      onTouchEnd: handleTouchEnd,
    },
  };
}
