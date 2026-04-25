'use client';

import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface CategoryChipData {
  id: string;
  name: string;
  nameEn?: string | null;
  icon?: string | null;
  productCount?: number;
}

interface CategoryChipsProps {
  categories: CategoryChipData[];
  selectedId: string | null;
  onSelect: (categoryId: string | null) => void;
}

// ============================================
// Component
// ============================================

export function CategoryChips({ categories, selectedId, onSelect }: CategoryChipsProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const handleSelect = (id: string | null) => {
    onSelect(selectedId === id ? null : id);
  };

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide py-1 -mx-4 px-4">
      {/* "All" chip */}
      <button
        onClick={() => handleSelect(null)}
        className={cn(
          'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
          selectedId === null
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background text-foreground border-border hover:border-primary/50'
        )}
      >
        <span>{t('Tất cả', 'All')}</span>
      </button>

      {/* Category chips */}
      {categories.map((cat) => {
        const name = locale === 'en' && cat.nameEn ? cat.nameEn : cat.name;
        const isSelected = selectedId === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => handleSelect(cat.id)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:border-primary/50'
            )}
          >
            {cat.icon && <span className="text-sm">{cat.icon}</span>}
            <span>{name}</span>
            {cat.productCount !== undefined && cat.productCount > 0 && (
              <span
                className={cn(
                  'text-[10px] px-1 py-0 rounded-full',
                  isSelected
                    ? 'bg-primary-foreground/20'
                    : 'bg-muted'
                )}
              >
                {cat.productCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export type { CategoryChipData };
