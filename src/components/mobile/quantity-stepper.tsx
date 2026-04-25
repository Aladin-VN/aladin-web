'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  size?: 'sm' | 'md';
  onChange: (value: number) => void;
  disabled?: boolean;
}

// ============================================
// Component
// ============================================

export function QuantityStepper({
  value,
  min = 1,
  max = 9999,
  step = 1,
  size = 'sm',
  onChange,
  disabled = false,
}: QuantityStepperProps) {
  const isMin = value <= min;
  const isMax = value >= max;

  const handleDecrease = () => {
    const newVal = Math.max(min, value - step);
    if (newVal !== value) onChange(newVal);
  };

  const handleIncrease = () => {
    const newVal = Math.min(max, value + step);
    if (newVal !== value) onChange(newVal);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value);
    if (!isNaN(raw) && raw >= min && raw <= max) {
      onChange(raw);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value);
    if (isNaN(raw) || raw < min) onChange(min);
    else if (raw > max) onChange(max);
  };

  return (
    <div
      className={cn(
        'inline-flex items-center border rounded-lg overflow-hidden',
        disabled && 'opacity-50 pointer-events-none'
      )}
    >
      <Button
        variant="ghost"
        size={size === 'sm' ? 'icon' : 'sm'}
        className={cn(
          'h-8 w-8 rounded-none',
          isMin && 'text-muted-foreground/30'
        )}
        onClick={handleDecrease}
        disabled={disabled || isMin}
      >
        <Minus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </Button>

      <Input
        type="number"
        value={value}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={cn(
          'h-8 w-12 text-center border-0 border-x bg-transparent p-0 focus-visible:ring-0',
          'font-medium tabular-nums',
          size === 'sm' ? 'text-sm' : 'text-base',
          // Hide number input spinners
          '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
        )}
      />

      <Button
        variant="ghost"
        size={size === 'sm' ? 'icon' : 'sm'}
        className={cn(
          'h-8 w-8 rounded-none',
          isMax && 'text-muted-foreground/30'
        )}
        onClick={handleIncrease}
        disabled={disabled || isMax}
      >
        <Plus className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </Button>
    </div>
  );
}
