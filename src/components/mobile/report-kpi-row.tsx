'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ============================================
// Types
// ============================================

interface ReportKPIRowProps {
  label: string;
  labelVi: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: number;
  variant?: 'default' | 'success' | 'danger';
  locale: string;
}

// ============================================
// Report KPI Row Component
// ============================================

export function ReportKPIRow({
  label,
  labelVi,
  value,
  icon,
  trend,
  variant = 'default',
  locale,
}: ReportKPIRowProps) {
  const displayLabel = locale === 'vi' ? labelVi : label;

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2.5 px-1',
        variant === 'danger' && 'opacity-70'
      )}
    >
      {/* Left: icon + label + trend */}
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
              variant === 'success'
                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
                : variant === 'danger'
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                  : 'bg-muted text-muted-foreground'
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{displayLabel}</p>
          {trend !== undefined && (
            <div
              className={cn(
                'flex items-center gap-0.5 text-[11px] font-medium',
                trend >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-600 dark:text-red-400'
              )}
            >
              {trend >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>{trend >= 0 ? '+' : ''}{trend}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: value */}
      <p
        className={cn(
          'text-sm font-semibold tabular-nums shrink-0 ml-2',
          variant === 'danger' ? 'text-red-600 dark:text-red-400' : 'text-foreground'
        )}
      >
        {typeof value === 'number' ? value.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US') : value}
      </p>
    </div>
  );
}
