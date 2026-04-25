'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ============================================
// Mini Sparkline Chart (pure SVG, no library needed)
// ============================================

interface SparklineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
  className?: string;
}

export function SparklineChart({
  data,
  width = 120,
  height = 40,
  color = 'currentColor',
  fillColor,
  showDots = false,
  className,
}: SparklineChartProps) {
  if (!data || data.length < 2) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ width, height }}>
        <span className="text-[10px] text-muted-foreground">No data</span>
      </div>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (val - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)},${height} L ${padding},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
    >
      {fillColor && (
        <path d={areaD} fill={fillColor} opacity={0.15} />
      )}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && (
        <circle
          cx={padding + ((data.length - 1) / (data.length - 1)) * (width - padding * 2)}
          cy={padding + (1 - (data[data.length - 1] - min) / range) * (height - padding * 2)}
          r={3}
          fill={color}
        />
      )}
    </svg>
  );
}

// ============================================
// Donut Chart (pure SVG)
// ============================================

interface DonutChartProps {
  segments: { label: string; value: number; color: string; labelVi?: string }[];
  size?: number;
  strokeWidth?: number;
  centerText?: string;
  className?: string;
}

export function DonutChart({
  segments,
  size = 80,
  strokeWidth = 12,
  centerText,
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ width: size, height: size }}>
        <span className="text-[10px] text-muted-foreground">No data</span>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Pre-calculate segment offsets immutably
  const segmentData = segments.map((seg) => {
    const segLength = (seg.value / total) * circumference;
    const gap = segments.length > 1 ? 2 : 0;
    return { seg, segLength, gap };
  });
  const offsets = segmentData.reduce<number[]>((acc, _, i) => {
    acc.push(segmentData.slice(0, i).reduce((sum, s) => sum + s.segLength, 0));
    return acc;
  }, []);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        {segmentData.map(({ seg, segLength, gap }, i) => {
          const dashArray = `${Math.max(segLength - gap, 0)} ${circumference - Math.max(segLength - gap, 0)}`;
          const dashOffset = -offsets[i];

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {centerText && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-bold">{centerText}</span>
        </div>
      )}
    </div>
  );
}

// ============================================
// Horizontal Bar Chart (pure SVG)
// ============================================

interface HorizontalBarChartProps {
  data: { label: string; value: number; color: string; maxValue?: number }[];
  height?: number;
  barHeight?: number;
  className?: string;
  formatValue?: (v: number) => string;
}

export function HorizontalBarChart({
  data,
  height = 160,
  barHeight = 20,
  className,
  formatValue = (v) => String(v),
}: HorizontalBarChartProps) {
  const max = Math.max(...data.map((d) => d.maxValue || d.value), 1);
  const gap = 8;
  const totalHeight = data.length * (barHeight + gap);
  const labelWidth = 80;
  const valueWidth = 50;
  const chartWidth = 120;

  return (
    <div className={className} style={{ height: Math.max(totalHeight + 10, height) }}>
      <svg width="100%" viewBox={`0 0 ${labelWidth + chartWidth + valueWidth} ${totalHeight + 10}`}>
        {data.map((item, i) => {
          const y = i * (barHeight + gap);
          const barWidth = (item.value / max) * chartWidth;

          return (
            <g key={i}>
              <text
                x={labelWidth - 4}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={10}
              >
                {item.label}
              </text>
              <rect
                x={labelWidth}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={4}
                fill={item.color}
                opacity={0.8}
              />
              <text
                x={labelWidth + chartWidth + 4}
                y={y + barHeight / 2 + 4}
                className="fill-foreground"
                fontSize={10}
                fontWeight={500}
              >
                {formatValue(item.value)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
