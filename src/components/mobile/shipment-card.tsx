'use client';

import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';
import { Truck, ExternalLink } from 'lucide-react';
import type { ShipmentStatus } from '@/types';

// ============================================
// Config
// ============================================

const SHIPMENT_STATUS_CONFIG: Record<ShipmentStatus, { vi: string; en: string; bg: string; text: string; dot: string }> = {
  PENDING:    { vi: 'Chờ lấy hàng',    en: 'Pending',    bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500' },
  PICKED_UP:  { vi: 'Đã lấy hàng',    en: 'Picked Up',  bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     dot: 'bg-blue-500' },
  IN_TRANSIT: { vi: 'Đang vận chuyển', en: 'In Transit', bg: 'bg-cyan-100 dark:bg-cyan-900/30',     text: 'text-cyan-700 dark:text-cyan-400',     dot: 'bg-cyan-500' },
  DELIVERED:  { vi: 'Đã giao',        en: 'Delivered',  bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  FAILED:     { vi: 'Giao thất bại',   en: 'Failed',     bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500' },
};

// ============================================
// Shipment Status Badge
// ============================================

export function ShipmentStatusBadge({ status, locale }: { status: ShipmentStatus | string; locale: string }) {
  const config = SHIPMENT_STATUS_CONFIG[status as ShipmentStatus];
  if (!config) return <span className="text-xs text-muted-foreground">{status}</span>;
  const isEn = locale === 'en';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium text-[10px]', config.bg, config.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {isEn ? config.en : config.vi}
    </span>
  );
}

// ============================================
// Shipment Card Component
// ============================================

interface ShipmentCardData {
  id: string;
  orderNumber?: string;
  orderTotal?: number;
  orderTotalFormatted?: string;
  shopName?: string;
  shopProvince?: string;
  type: string;
  status: ShipmentStatus;
  driverName?: string | null;
  driverPhone?: string | null;
  dropoffAddress: string;
  deliveredAt?: string | null;
  thirdPartyTrackingId?: string | null;
  createdAt?: string;
}

interface ShipmentCardProps {
  shipment: ShipmentCardData;
  locale?: string;
  onTap?: (shipment: ShipmentCardData) => void;
}

export function ShipmentCard({ shipment, onTap }: ShipmentCardProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const formatVND = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);

  return (
    <button
      onClick={() => onTap?.(shipment)}
      className="w-full text-left bg-card border rounded-xl p-3 active:scale-[0.99] transition-all"
    >
      {/* Top row: order number + status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">
            {shipment.orderNumber || shipment.id.slice(0, 8)}
          </span>
        </div>
        <ShipmentStatusBadge status={shipment.status} locale={locale} />
      </div>

      {/* Shop + address */}
      <div className="space-y-1">
        {shipment.shopName && (
          <p className="text-sm font-medium">{shipment.shopName}</p>
        )}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {shipment.dropoffAddress}
        </p>
      </div>

      {/* Bottom row: driver + amount */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t">
        <div className="text-xs text-muted-foreground">
          {shipment.driverName ? (
            <>
              <span className="font-medium text-foreground">{shipment.driverName}</span>
              {shipment.driverPhone && (
                <span className="ml-1">· {shipment.driverPhone}</span>
              )}
            </>
          ) : (
            t('Chưa phân công tài xế', 'No driver assigned')
          )}
        </div>
        {shipment.orderTotal != null && (
          <span className="text-sm font-semibold text-primary">
            {shipment.orderTotalFormatted || formatVND(shipment.orderTotal)}
          </span>
        )}
      </div>

      {/* Third-party tracking */}
      {shipment.thirdPartyTrackingId && (
        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          <span>Mã vận đơn: <span className="font-mono">{shipment.thirdPartyTrackingId}</span></span>
        </div>
      )}
    </button>
  );
}

export type { ShipmentCardData };
export { SHIPMENT_STATUS_CONFIG };
