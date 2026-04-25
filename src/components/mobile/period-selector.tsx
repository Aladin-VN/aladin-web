'use client';

import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface PeriodOption {
  value: string;
  labelVi: string;
  labelEn: string;
}

interface PeriodSelectorProps {
  value: string;
  onChange: (period: string) => void;
  locale: string;
}

// ============================================
// Period options
// ============================================

const PERIOD_OPTIONS: PeriodOption[] = [
  { value: '7d', labelVi: '7 ngày', labelEn: '7 days' },
  { value: '30d', labelVi: '30 ngày', labelEn: '30 days' },
  { value: '90d', labelVi: '90 ngày', labelEn: '90 days' },
  { value: 'thisMonth', labelVi: 'Tháng này', labelEn: 'This month' },
  { value: 'lastMonth', labelVi: 'Tháng trước', labelEn: 'Last month' },
];

// ============================================
// Period Selector Component
// ============================================

export function PeriodSelector({ value, onChange, locale }: PeriodSelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4">
      {PERIOD_OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        const label = locale === 'vi' ? opt.labelVi : opt.labelEn;

        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:border-primary/50'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
