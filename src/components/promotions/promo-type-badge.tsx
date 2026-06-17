'use client';

import { Badge } from '@/components/ui/badge';
import { Gift, Percent, Tag, ShoppingCart } from 'lucide-react';

interface PromoTypeBadgeProps {
  type: string;
  buyQty?: number | null;
  getQty?: number | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  locale?: string;
}

export function PromoTypeBadge({ type, buyQty, getQty, discountPercent, discountAmount, locale = 'vi' }: PromoTypeBadgeProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  switch (type) {
    case 'BUY_X_GET_Y':
      return (
        <Badge variant="secondary" className="bg-yellow-50 text-red-700 hover:bg-yellow-50 text-xs gap-1">
          <Gift className="h-3 w-3" />
          {buyQty && getQty
            ? (locale === 'vi' ? `Mua ${buyQty} Tang ${getQty}` : `Buy ${buyQty} Get ${getQty}`)
            : t('Buy X Get Y', 'Mua X Tang Y')
          }
        </Badge>
      );
    case 'PERCENT_OFF':
      return (
        <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs gap-1">
          <Percent className="h-3 w-3" />
          {discountPercent
            ? `-${discountPercent}%`
            : t('Percentage Off', 'Giam theo %')
          }
        </Badge>
      );
    case 'FIXED_DISCOUNT':
      return (
        <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-50 text-xs gap-1">
          <Tag className="h-3 w-3" />
          {discountAmount
            ? (locale === 'vi' ? `-${(discountAmount / 1000).toFixed(0)}K` : `-${discountAmount.toLocaleString()}d`)
            : t('Fixed Discount', 'Giam co dinh')
          }
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          <ShoppingCart className="h-3 w-3 mr-1" />
          {type}
        </Badge>
      );
  }
}
