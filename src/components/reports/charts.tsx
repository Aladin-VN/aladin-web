'use client';

import {
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Line,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// ============================================
// Color Palette (Aladin Brand)
// ============================================

export const CHART_COLORS = ['#EAB308', '#DC2626', '#F59E0B', '#EF4444', '#FBBF24', '#B91C1C', '#CA8A04', '#F97316'];
export const PIPELINE_COLORS = ['#9CA3AF', '#EAB308', '#F97316', '#F59E0B', '#DC2626', '#10B981'];

// ============================================
// Formatters
// ============================================

export function formatVNDShort(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toString();
}

// ============================================
// Custom Tooltip for VND
// ============================================

function VNDTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
      <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold">
            {entry.name === 'GMV' ? formatVNDShort(entry.value) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// 1. Revenue Trend Chart (BarChart + LineChart combo)
// ============================================

interface MonthlyTrendItem {
  month: string;
  orders: number;
  gmv: number;
}

interface RevenueTrendChartProps {
  data: MonthlyTrendItem[];
  title: string;
  titleVi: string;
  description?: string;
  descriptionVi?: string;
  locale?: string;
  className?: string;
}

export function RevenueTrendChart({
  data,
  title,
  titleVi,
  description,
  descriptionVi,
  locale = 'vi',
  className,
}: RevenueTrendChartProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
        {description && (
          <CardDescription className="text-xs">{t(description, descriptionVi || '')}</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <RechartsBarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="gmv"
                tickFormatter={formatVNDShort}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip content={<VNDTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                yAxisId="gmv"
                dataKey="gmv"
                name="GMV"
                fill="#EAB308"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Line
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                name="Orders"
                stroke="#DC2626"
                strokeWidth={2.5}
                dot={{ fill: '#DC2626', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px]">
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
// 2. Order Pipeline Donut (PieChart)
// ============================================

interface PipelineItem {
  status: string;
  count: number;
}

interface OrderPipelineDonutProps {
  data: PipelineItem[];
  totalOrders: number;
  title: string;
  titleVi: string;
  locale?: string;
  className?: string;
}

const PIPELINE_STATUS_LABELS: Record<string, { en: string; vi: string }> = {
  pending: { en: 'Pending', vi: 'Cho XL' },
  confirmed: { en: 'Confirmed', vi: 'Da XL' },
  processing: { en: 'Processing', vi: 'Dang XL' },
  packed: { en: 'Packed', vi: 'Dong goi' },
  outForDelivery: { en: 'Out for Delivery', vi: 'Dang giao' },
  out_for_delivery: { en: 'Out for Delivery', vi: 'Dang giao' },
  delivered: { en: 'Delivered', vi: 'Da giao' },
};

export function OrderPipelineDonut({
  data,
  totalOrders,
  title,
  titleVi,
  locale = 'vi',
  className,
}: OrderPipelineDonutProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const pieData = data.map((item, i) => {
    const statusKey = item.status.replace(/_/g, '');
    const labels = PIPELINE_STATUS_LABELS[item.status] || PIPELINE_STATUS_LABELS[statusKey] || { en: item.status, vi: item.status };
    return {
      name: t(labels.en, labels.vi),
      value: item.count,
      color: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
    };
  }).filter(d => d.value > 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0];
                    return (
                      <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: data.payload.color }} />
                          <span className="font-medium">{data.name}</span>
                          <span className="font-bold ml-auto">{data.value.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                {/* Center Label using a render prop workaround */}
                <Pie
                  data={[{ value: 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={0}
                  paddingAngle={0}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central">
                    <tspan className="fill-foreground" style={{ fontSize: '22px', fontWeight: 800 }}>
                      {totalOrders.toLocaleString()}
                    </tspan>
                  </text>
                  <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central">
                    <tspan className="fill-muted-foreground" style={{ fontSize: '11px' }}>
                      {t('orders', 'don')}
                    </tspan>
                  </text>
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-[11px] text-muted-foreground">{entry.name}</span>
                  <span className="text-[11px] font-bold">{entry.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-[220px]">
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
// 3. Top Categories Horizontal Bar
// ============================================

interface CategoryItem {
  name: string;
  revenue: number;
  revenueFormatted: string;
  qty: number;
}

interface TopCategoriesBarProps {
  data: CategoryItem[];
  title: string;
  titleVi: string;
  locale?: string;
  className?: string;
}

export function TopCategoriesBar({
  data,
  title,
  titleVi,
  locale = 'vi',
  className,
}: TopCategoriesBarProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  // Reverse so highest is at top in horizontal layout
  const chartData = [...data].reverse().slice(0, 8);

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <RechartsBarChart data={chartData} layout="vertical" margin={{ top: 0, right: 50, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={formatVNDShort}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                axisLine={false}
                tickLine={false}
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as CategoryItem;
                  return (
                    <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                      <p className="text-xs font-semibold mb-1">{d.name}</p>
                      <p className="text-sm text-muted-foreground">{t('Revenue', 'Doanh thu')}: <span className="font-bold text-foreground">{d.revenueFormatted}</span></p>
                      <p className="text-xs text-muted-foreground">{d.qty.toLocaleString()} {t('units sold', 'SP da ban')}</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {chartData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={index % 2 === 0 ? '#EAB308' : '#DC2626'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px]">
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
// 6. Payment Breakdown Pie Chart
// ============================================

interface PaymentBreakdownItem {
  method: string;
  count: number;
  revenue: number;
  revenueFormatted: string;
}

interface PaymentBreakdownChartProps {
  data: PaymentBreakdownItem[];
  title: string;
  titleVi: string;
  locale?: string;
  className?: string;
}

const PAYMENT_COLORS: Record<string, string> = {
  CREDIT: '#DC2626',
  DIGITAL: '#EAB308',
  COD: '#10B981',
};

const PAYMENT_LABELS: Record<string, { en: string; vi: string }> = {
  CREDIT: { en: 'Credit', vi: 'Cong no' },
  DIGITAL: { en: 'Digital', vi: 'Chuyen khoan' },
  COD: { en: 'COD', vi: 'COD' },
};

export function PaymentBreakdownChart({
  data,
  title,
  titleVi,
  locale = 'vi',
  className,
}: PaymentBreakdownChartProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  const pieData = data.map((item) => ({
    name: t(PAYMENT_LABELS[item.method]?.en || item.method, PAYMENT_LABELS[item.method]?.vi || item.method),
    value: item.revenue,
    count: item.count,
    color: PAYMENT_COLORS[item.method] || CHART_COLORS[0],
  }));

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{t(title, titleVi)}</CardTitle>
      </CardHeader>
      <CardContent>
        {pieData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="font-medium">{d.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-4">
                          {t('Revenue', 'Doanh thu')}: <span className="font-bold text-foreground">{formatVNDShort(d.value)}</span>
                        </p>
                        <p className="text-xs text-muted-foreground pl-4">
                          {t('Orders', 'Don hang')}: <span className="font-bold text-foreground">{d.count.toLocaleString()}</span>
                        </p>
                      </div>
                    );
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            {/* Legend + counts */}
            <div className="space-y-2 mt-1">
              {pieData.map((entry, i) => {
                const pct = totalRevenue > 0 ? Math.round((entry.value / totalRevenue) * 1000) / 10 : 0;
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">{entry.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{entry.count} {t('orders', 'don')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{formatVNDShort(entry.value)}</span>
                      <span className="text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Total */}
            <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t('Total Revenue', 'Tong doanh thu')}</span>
              <span className="font-bold">{formatVNDShort(totalRevenue)}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-[200px]">
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
// LEGACY: CSS Bar Chart (Vertical)
// Kept for backward compatibility with /reports page
// ============================================

interface LegacyBarChartProps {
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
}: LegacyBarChartProps) {
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
// LEGACY: Horizontal Bar Chart
// Kept for backward compatibility with /reports page
// ============================================

interface LegacyHBarChartProps {
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
}: LegacyHBarChartProps) {
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
// LEGACY: Donut / Distribution Chart (CSS)
// Kept for backward compatibility with /reports page
// ============================================

interface LegacyDistributionChartProps {
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
}: LegacyDistributionChartProps) {
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