'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle } from 'lucide-react';

interface AuditStatusBadgeProps {
  status: string;
  locale?: string;
}

export function AuditStatusBadge({ status, locale = 'vi' }: AuditStatusBadgeProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  switch (status) {
    case 'PENDING_REVIEW':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs gap-1 border-0">
          <Clock className="h-3 w-3" />
          {t('Pending Review', 'Cho duyet')}
        </Badge>
      );
    case 'APPROVED':
      return (
        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs gap-1 border-0">
          <CheckCircle className="h-3 w-3" />
          {t('Approved', 'Da duyet')}
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs gap-1 border-0">
          <XCircle className="h-3 w-3" />
          {t('Rejected', 'Da tu choi')}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
}
