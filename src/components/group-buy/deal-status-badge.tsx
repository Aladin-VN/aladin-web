'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';

interface DealStatusBadgeProps {
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  locale?: string;
}

export function DealStatusBadge({ status, locale = 'vi' }: DealStatusBadgeProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  switch (status) {
    case 'ACTIVE':
      return (
        <Badge className="bg-yellow-50 text-red-700 hover:bg-yellow-50 text-xs gap-1 border-0 animate-pulse">
          <CheckCircle className="h-3 w-3" />
          {t('Active', 'Hoạt động')}
        </Badge>
      );
    case 'COMPLETED':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs gap-1 border-0">
          <CheckCircle className="h-3 w-3" />
          {t('Completed', 'Hoàn thành')}
        </Badge>
      );
    case 'EXPIRED':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs gap-1 border-0">
          <AlertTriangle className="h-3 w-3" />
          {t('Expired', 'Hết hạn')}
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs gap-1 border-0">
          <XCircle className="h-3 w-3" />
          {t('Cancelled', 'Đã hủy')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <Clock className="h-3 w-3" />
          {t('Unknown', 'Không xác định')}
        </Badge>
      );
  }
}
