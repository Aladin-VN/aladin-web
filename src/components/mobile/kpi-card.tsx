'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ============================================
// Mobile KPI Card
// ============================================

interface MobileKpiCardProps {
  label: string;
  labelVi?: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  locale?: string;
}

export function MobileKpiCard({
  label,
  labelVi,
  value,
  icon,
  trend,
  trendLabel,
  variant = 'default',
  locale = 'vi',
}: MobileKpiCardProps) {
  const displayLabel = locale === 'vi' && labelVi ? labelVi : label;

  const variantClasses = {
    default: 'border-border',
    success: 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30',
    warning: 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30',
    danger: 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30',
  };

  return (
    <Card className={cn('p-3', variantClasses[variant])}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground font-medium truncate">
              {displayLabel}
            </p>
            <p className="text-lg font-bold tracking-tight mt-1 truncate">{value}</p>
          </div>
          <div
            className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ml-2',
              variant === 'success' && 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
              variant === 'warning' && 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
              variant === 'danger' && 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
              variant === 'default' && 'bg-muted text-muted-foreground'
            )}
          >
            {icon}
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center mt-1.5">
            {trend >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-600 mr-0.5" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600 mr-0.5" />
            )}
            <span className={`text-[11px] font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {Math.abs(trend)}%
            </span>
            {trendLabel && (
              <span className="text-[11px] text-muted-foreground ml-1">{trendLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
