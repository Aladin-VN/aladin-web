'use client';

import { Shield, Store, Users, Truck, Megaphone, Warehouse } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface UserRoleBadgeProps {
  role: string;
  locale?: string;
}

const roleConfig: Record<string, {
  label: { en: string; vi: string };
  color: string;
  icon: React.ReactNode;
}> = {
  ADMIN: {
    label: { en: 'Admin', vi: 'Quan tri' },
    color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
    icon: <Shield className="h-3 w-3" />,
  },
  SHOP_OWNER: {
    label: { en: 'Shop Owner', vi: 'Chu cua hang' },
    color: 'bg-yellow-50 text-red-700 border-yellow-100 dark:bg-emerald-950 dark:text-yellow-500 dark:border-red-800',
    icon: <Store className="h-3 w-3" />,
  },
  SALES_REP: {
    label: { en: 'Sales Rep', vi: 'Nhan vien BH' },
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800',
    icon: <Users className="h-3 w-3" />,
  },
  DRIVER: {
    label: { en: 'Driver', vi: 'Tai xe' },
    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
    icon: <Truck className="h-3 w-3" />,
  },
  BROKER: {
    label: { en: 'Broker', vi: 'Dai ly' },
    color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800',
    icon: <Megaphone className="h-3 w-3" />,
  },
  DISTRIBUTOR: {
    label: { en: 'Distributor', vi: 'Nha PP' },
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
    icon: <Warehouse className="h-3 w-3" />,
  },
};

export function UserRoleBadge({ role, locale = 'vi' }: UserRoleBadgeProps) {
  const config = roleConfig[role];
  if (!config) {
    return (
      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
        {role}
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
