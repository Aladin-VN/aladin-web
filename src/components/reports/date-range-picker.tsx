'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateRangePickerProps {
  value: string;
  onChange: (value: string) => void;
  locale?: string;
  size?: 'sm' | 'default';
}

const periods = [
  { value: 'today', en: 'Today', vi: 'Hom nay' },
  { value: '7d', en: 'Last 7 Days', vi: '7 ngay qua' },
  { value: '30d', en: 'Last 30 Days', vi: '30 ngay qua' },
  { value: '90d', en: 'Last 90 Days', vi: '90 ngay qua' },
  { value: 'thisMonth', en: 'This Month', vi: 'Thang nay' },
  { value: 'lastMonth', en: 'Last Month', vi: 'Thang truoc' },
];

export function DateRangePicker({ value, onChange, locale = 'vi', size = 'sm' }: DateRangePickerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`w-full sm:w-[170px] ${size === 'sm' ? 'h-9' : 'h-10'}`}>
        <SelectValue placeholder={t('Period', 'Ky')} />
      </SelectTrigger>
      <SelectContent>
        {periods.map(p => (
          <SelectItem key={p.value} value={p.value}>
            {locale === 'vi' ? p.vi : p.en}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
