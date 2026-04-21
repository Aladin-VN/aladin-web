'use client';

import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserStatusBadgeProps {
  status: string;
  locale?: string;
}

const statusConfig: Record<string, {
  label: { en: string; vi: string };
  color: string;
  icon: React.ReactNode;
}> = {
  ACTIVE: {
    label: { en: 'Active', vi: 'Hoat dong' },
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  SUSPENDED: {
    label: { en: 'Suspended', vi: 'Bi khoa' },
    color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
    icon: <XCircle className="h-3 w-3" />,
  },
  PENDING_VERIFICATION: {
    label: { en: 'Pending', vi: 'Cho xac minh' },
    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
    icon: <Clock className="h-3 w-3" />,
  },
};

export function UserStatusBadge({ status, locale = 'vi' }: UserStatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        {status}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${config.color}`}>
      <span className="flex items-center gap-1">
        {config.icon}
        {locale === 'vi' ? config.label.vi : config.label.en}
      </span>
    </Badge>
  );
}
