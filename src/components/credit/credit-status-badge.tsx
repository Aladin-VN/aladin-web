'use client';

import { Badge } from '@/components/ui/badge';

interface CreditStatusBadgeProps {
  status: string;
  locale?: string;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  ACTIVE: {
    bg: 'bg-yellow-50 text-red-700 hover:bg-yellow-50 dark:bg-red-900/40 dark:text-yellow-500',
    dot: 'bg-red-500',
  },
  OVERDUE: {
    bg: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/40 dark:text-red-400',
    dot: 'bg-red-500',
  },
  LOCKED: {
    bg: 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
};

const statusLabels: Record<string, { en: string; vi: string }> = {
  ACTIVE: { en: 'Active', vi: 'Hoat dong' },
  OVERDUE: { en: 'Overdue', vi: 'Qua han' },
  LOCKED: { en: 'Locked', vi: 'Bi khoa' },
};

export function CreditStatusBadge({ status, locale = 'vi' }: CreditStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.ACTIVE;
  const label = statusLabels[status] || { en: status, vi: status };

  return (
    <Badge variant="secondary" className={`text-[11px] font-medium px-2 py-0.5 ${config.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot} mr-1.5`} />
      {locale === 'vi' ? label.vi : label.en}
    </Badge>
  );
}
