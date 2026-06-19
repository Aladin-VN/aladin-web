'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================
// Simple CSS Bar Chart (Vertical)
// For showing trends and distributions
// ============================================

interface BarChartProps {
  title: string;
  titleVi: string;
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  showValues?: boolean;
  formatValue?: (value: number) => string;
  locale?: string;
  height?: number;
  className?: string;
}

export function BarChart({
  title, titleVi, data, maxValue, showValues = true,
  formatValue, locale = 'vi', height = 180, className,
}: BarChartProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const max = maxValue || Math.max(...data.map(d => d.value), 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-end gap-1.5" style={{ height: `${height}px` }}>
          {data.map((d, i) => {
            const pct = max > 0 ? (d.value / max) * 100 : 0;
            const color = d.color || (i === data.length - 1 ? 'bg-red-500' : 'bg-red-500/70');
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                {showValues && d.value > 0 && (
                  <span className="text-[9px] text-muted-foreground font-medium truncate max-w-full">
                    {formatValue ? formatValue(d.value) : d.value >= 1000000
                      ? `${(d.value / 1000000).toFixed(1)}M`
                      : d.value >= 1000
                        ? `${(d.value / 1000).toFixed(0)}K`
                        : d.value}
                  </span>
                )}
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 ${color}`}
                  style={{ height: `${Math.max(pct, 2)}%`, minHeight: '2px' }}
                  title={`${d.label}: ${formatValue ? formatValue(d.value) : d.value.toLocaleString()}`}
                />
                <span className="text-[8px] text-muted-foreground truncate max-w-full text-center leading-tight">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
        {data.length === 0 && (
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <p className="text-xs text-muted-foreground">
              {locale === 'vi' ? 'Khong co du lieu' : 'No data'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Horizontal Bar Chart
// For rankings (top shops, top products)
// ============================================

interface HBarChartProps {
  title: string;
  titleVi: string;
  data: { label: string; value: number; color?: string; subtitle?: string }[];
  maxValue?: number;
  formatValue?: (value: number) => string;
  locale?: string;
  maxItems?: number;
  className?: string;
}

export function HBarChart({
  title, titleVi, data, maxValue, formatValue, locale = 'vi',
  maxItems = 10, className,
}: HBarChartProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const items = data.slice(0, maxItems);
  const max = maxValue || Math.max(...items.map(d => d.value), 1);

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {items.map((d, i) => {
          const pct = max > 0 ? (d.value / max) * 100 : 0;
          const color = d.color || [
            'bg-red-500', 'bg-yellow-500', 'bg-orange-500', 'bg-amber-500',
            'bg-rose-500', 'bg-emerald-500', 'bg-lime-500', 'bg-pink-500',
            'bg-teal-500', 'bg-red-400',
          ][i % 10];
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-mono w-4 text-right shrink-0">{i + 1}</span>
                  <span className="font-medium truncate">{d.label}</span>
                </div>
                <span className="font-semibold text-[11px] shrink-0 ml-2">
                  {formatValue ? formatValue(d.value) : d.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${color}`}
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
              </div>
              {d.subtitle && (
                <p className="text-[10px] text-muted-foreground pl-5">{d.subtitle}</p>
              )}
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">
              {locale === 'vi' ? 'Khong co du lieu' : 'No data'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Donut / Distribution Chart (CSS)
// ============================================

interface DistributionChartProps {
  title: string;
  titleVi: string;
  data: { label: string; value: number; color: string; labelVi?: string }[];
  locale?: string;
  totalLabel?: string;
  totalLabelVi?: string;
  className?: string;
}

export function DistributionChart({
  title, titleVi, data, locale = 'vi', totalLabel, totalLabelVi, className,
}: DistributionChartProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const total = data.reduce((s, d) => s + d.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <Card className={className}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {/* Stacked bar */}
        <div className="h-4 rounded-full overflow-hidden flex bg-muted">
          {sortedData.map((d, i) => {
            const pct = total > 0 ? (d.value / total) * 100 : 0;
            if (pct < 0.5) return null;
            return (
              <div
                key={i}
                className={`${d.color} transition-all duration-300`}
                style={{ width: `${pct}%` }}
                title={`${locale === 'vi' && d.labelVi ? d.labelVi : d.label}: ${pct.toFixed(1)}%`}
              />
            );
          })}
        </div>
        {/* Legend */}
        <div className="mt-3 space-y-1.5">
          {sortedData.map((d, i) => {
            const pct = total > 0 ? Math.round((d.value / total) * 1000) / 10 : 0;
            const label = locale === 'vi' && d.labelVi ? d.labelVi : d.label;
            return (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-sm ${d.color} shrink-0`} />
                  <span className="text-muted-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{d.value.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
        {totalLabel && (
          <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t(totalLabel || 'Total', totalLabelVi || 'Tong')}</span>
            <span className="font-bold">{total.toLocaleString()}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
