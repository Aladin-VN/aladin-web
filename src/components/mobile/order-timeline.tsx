'use client';

import { cn } from '@/lib/utils';
import type { OrderStatus, ShipmentStatus } from '@/types';

// ============================================
// Order Status Pipeline
// ============================================

const ORDER_STEPS: { status: OrderStatus; vi: string; en: string }[] = [
  { status: 'PENDING',          vi: 'Chờ xử lý',    en: 'Pending' },
  { status: 'CONFIRMED',        vi: 'Xác nhận',      en: 'Confirmed' },
  { status: 'PROCESSING',       vi: 'Xử lý',        en: 'Processing' },
  { status: 'PACKED',           vi: 'Đóng gói',      en: 'Packed' },
  { status: 'OUT_FOR_DELIVERY', vi: 'Đang giao',     en: 'Out for Delivery' },
  { status: 'DELIVERED',        vi: 'Đã giao',       en: 'Delivered' },
];

const TERMINAL_STATUSES: OrderStatus[] = ['CANCELLED', 'REFUNDED'];

interface OrderTimelineProps {
  status: OrderStatus;
  confirmedAt?: string | null;
  packedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  shipmentStatus?: ShipmentStatus | null;
  locale?: string;
}

export function OrderTimeline({
  status,
  confirmedAt,
  packedAt,
  deliveredAt,
  cancelledAt,
  shipmentStatus,
  locale = 'vi',
}: OrderTimelineProps) {
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const isTerminal = TERMINAL_STATUSES.includes(status);

  if (isTerminal) {
    return (
      <div className="flex flex-col items-center py-4">
        <div className={cn(
          'h-12 w-12 rounded-full flex items-center justify-center mb-2',
          status === 'CANCELLED'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-600'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
        )}>
          {status === 'CANCELLED' ? '✕' : '↩'}
        </div>
        <p className={cn(
          'text-sm font-semibold',
          status === 'CANCELLED' ? 'text-red-600' : 'text-gray-500'
        )}>
          {status === 'CANCELLED' ? t('Đã hủy', 'Cancelled') : t('Đã hoàn', 'Refunded')}
        </p>
        {cancelledAt && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date(cancelledAt).toLocaleDateString('vi-VN', {
              day: '2-digit', month: '2-digit', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        )}
      </div>
    );
  }

  // Find current step index
  const currentIdx = ORDER_STEPS.findIndex((s) => s.status === status);

  return (
    <div className="py-2">
      {ORDER_STEPS.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;

        // Map shipment status to steps
        let stepNote = '';
        if (step.status === 'OUT_FOR_DELIVERY' && shipmentStatus) {
          const shipmentLabels: Record<string, { vi: string; en: string }> = {
            PICKED_UP: { vi: 'Đã lấy hàng', en: 'Picked up' },
            IN_TRANSIT: { vi: 'Đang vận chuyển', en: 'In transit' },
          };
          const label = shipmentLabels[shipmentStatus];
          if (label) stepNote = t(label.vi, label.en);
        }

        return (
          <div key={step.status} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-colors',
                isCompleted
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {isCompleted ? '✓' : idx + 1}
              </div>
              {idx < ORDER_STEPS.length - 1 && (
                <div className={cn(
                  'w-0.5 flex-1 min-h-[20px] transition-colors',
                  idx < currentIdx ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 flex-1 min-w-0">
              <p className={cn(
                'text-xs font-medium',
                isCurrent ? 'text-foreground' : isCompleted ? 'text-muted-foreground' : 'text-muted-foreground/50'
              )}>
                {t(step.vi, step.en)}
              </p>
              {isCurrent && stepNote && (
                <p className="text-[10px] text-primary mt-0.5">{stepNote}</p>
              )}
              {isCompleted && step.status === 'CONFIRMED' && confirmedAt && idx < currentIdx && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(confirmedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {isCompleted && step.status === 'DELIVERED' && deliveredAt && (
                <p className="text-[10px] text-emerald-600 mt-0.5">
                  {new Date(deliveredAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
