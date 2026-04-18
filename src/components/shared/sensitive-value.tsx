'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { maskPhone, maskName, maskAmount, maskId, formatVND } from '@/lib/security';

type MaskType = 'phone' | 'name' | 'amount' | 'id';

interface SensitiveValueProps {
  value: string | number;
  maskType: MaskType;
  formatOptions?: {
    formatCurrency?: boolean; // For amounts: show formatted VND
  };
  className?: string;
}

function applyMask(value: string | number, maskType: MaskType): string {
  const str = String(value);
  switch (maskType) {
    case 'phone':
      return maskPhone(str);
    case 'name':
      return maskName(str);
    case 'amount':
      return maskAmount(Number(value));
    case 'id':
      return maskId(str);
    default:
      return '***';
  }
}

function getDisplayValue(value: string | number, maskType: MaskType, options?: { formatCurrency?: boolean }): string {
  switch (maskType) {
    case 'amount':
      return options?.formatCurrency ? formatVND(Number(value)) : String(value);
    case 'phone':
    case 'name':
    case 'id':
      return String(value);
    default:
      return String(value);
  }
}

export function SensitiveValue({ value, maskType, formatOptions, className }: SensitiveValueProps) {
  const [isVisible, setIsVisible] = useState(false);

  const displayValue = isVisible
    ? getDisplayValue(value, maskType, formatOptions)
    : applyMask(value, maskType);

  return (
    <span className={`inline-flex items-center gap-1 ${className || ''}`}>
      <span className={isVisible ? '' : 'font-mono text-sm'}>{displayValue}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 hover:bg-muted"
        onClick={() => setIsVisible(!isVisible)}
        aria-label={isVisible ? 'Hide value' : 'Show value'}
      >
        {isVisible ? (
          <EyeOff className="h-3 w-3 text-muted-foreground" />
        ) : (
          <Eye className="h-3 w-3 text-muted-foreground" />
        )}
      </Button>
    </span>
  );
}
