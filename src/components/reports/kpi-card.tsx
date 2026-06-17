'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  titleVi: string;
  value: string | number;
  icon: React.ReactNode;
  growth?: number | null;
  locale?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  isSensitive?: boolean;
  suffix?: string;
}

function TrendIndicator({ growth }: { growth: number | null }) {
  if (growth === null || growth === undefined) return null;
  const isPositive = growth > 0;
  const isNeutral = growth === 0;

  return (
    <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
      isNeutral ? 'text-muted-foreground' :
      isPositive ? 'text-red-600' : 'text-red-600'
    }`}>
      {isNeutral ? (
        <Minus className="h-3 w-3" />
      ) : isPositive ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownRight className="h-3 w-3" />
      )}
      {Math.abs(growth).toFixed(1)}%
    </div>
  );
}

export function KpiCard({
  title, titleVi, value, icon, growth, locale = 'vi',
  variant = 'default', suffix, isSensitive = false,
}: KpiCardProps) {
  const label = locale === 'vi' ? titleVi : title;

  return (
    <Card className={
      variant === 'danger' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' :
      variant === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30' :
      variant === 'success' ? 'border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/30' :
      variant === 'info' ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30' :
      ''
    }>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
            <p className="text-xl font-bold mt-1 truncate">
              {isSensitive ? (
                <span className="text-base">{String(value)}</span>
              ) : (
                typeof value === 'number' ? value.toLocaleString() : value
              )}
              {suffix && <span className="text-xs font-normal text-muted-foreground ml-1">{suffix}</span>}
            </p>
            <TrendIndicator growth={growth} />
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ml-3 ${
            variant === 'danger' ? 'bg-red-100 text-red-600' :
            variant === 'warning' ? 'bg-amber-100 text-amber-600' :
            variant === 'success' ? 'bg-yellow-50 text-red-600' :
            variant === 'info' ? 'bg-blue-100 text-blue-600' :
            'bg-muted text-muted-foreground'
          }`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
