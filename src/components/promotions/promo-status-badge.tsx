'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, Ban } from 'lucide-react';

interface PromoStatusBadgeProps {
  status: 'active' | 'upcoming' | 'expired';
  isActive?: boolean;
  locale?: string;
}

export function PromoStatusBadge({ status, isActive, locale = 'vi' }: PromoStatusBadgeProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  switch (status) {
    case 'active':
      return (
        <Badge className="bg-yellow-50 text-red-700 hover:bg-yellow-50 text-xs gap-1 border-0">
          <CheckCircle className="h-3 w-3" />
          {t('Active', 'Hoat dong')}
        </Badge>
      );
    case 'upcoming':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs gap-1 border-0">
          <Clock className="h-3 w-3" />
          {t('Upcoming', 'Sap dien ra')}
        </Badge>
      );
    case 'expired':
      return (
        <Badge className={isActive ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' : 'bg-red-100 text-red-700 hover:bg-red-100'} style={{ borderWidth: 0 }} className="text-xs gap-1 border-0">
          <AlertTriangle className="h-3 w-3" />
          {isActive ? t('Paused', 'Tam dung') : t('Expired', 'Het han')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs gap-1">
          <Ban className="h-3 w-3" />
          {t('Inactive', 'Ngung')}
        </Badge>
      );
  }
}
