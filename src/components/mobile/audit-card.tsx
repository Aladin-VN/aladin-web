'use client';

import { useAppStore } from '@/stores/app.store';
import { Store, Package, Tag, Clock } from 'lucide-react';

// ============================================
// Audit Card — Merchandising audit card for list view
// ============================================

export interface AuditCardData {
  id: string;
  photoUrl?: string | null;
  status: string;
  reviewNotes?: string | null;
  createdAt: string;
  shop: { id: string; name: string; district: string | null; shopType: string };
  product: { id: string; name: string; sku: string; imageUrl: string | null };
  promotion?: { id: string; title: string; promoType: string } | null;
}

interface AuditCardProps {
  audit: AuditCardData;
  onClick?: (id: string) => void;
}

function AuditStatusBadge({ status, locale }: { status: string; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const config: Record<string, { label: string; cls: string }> = {
    PENDING_REVIEW: { label: t('Chờ duyệt', 'Pending'), cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    APPROVED: { label: t('Đã duyệt', 'Approved'), cls: 'bg-yellow-50 text-red-700 dark:bg-red-900/30 dark:text-yellow-500' },
    REJECTED: { label: t('Từ chối', 'Rejected'), cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };
  const c = config[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.cls}`}>
      {status === 'PENDING_REVIEW' && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />}
      {c.label}
    </span>
  );
}

function formatRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (locale === 'vi') {
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } else {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function AuditCard({ audit, onClick }: AuditCardProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <button
      onClick={() => onClick?.(audit.id)}
      className="w-full text-left bg-card rounded-xl border border-border/60 overflow-hidden active:scale-[0.98] transition-transform"
    >
      {/* Photo thumbnail + content side by side */}
      <div className="flex">
        {/* Photo thumbnail */}
        <div className="w-24 h-24 shrink-0 bg-muted">
          {audit.photoUrl ? (
            <img
              src={audit.photoUrl}
              alt={t('Ảnh kệ hàng', 'Shelf photo')}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="h-5 w-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          {/* Status + Time */}
          <div className="flex items-center justify-between mb-1.5">
            <AuditStatusBadge status={audit.status} locale={locale} />
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {formatRelativeTime(audit.createdAt, locale)}
            </span>
          </div>

          {/* Shop name */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
            <Store className="h-3 w-3 shrink-0" />
            <span className="truncate font-medium text-foreground">{audit.shop.name}</span>
            {audit.shop.district && (
              <>
                <span className="text-border">·</span>
                <span className="truncate">{audit.shop.district}</span>
              </>
            )}
          </div>

          {/* Product */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
            <Package className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{audit.product.name}</span>
          </div>

          {/* Promotion (optional) */}
          {audit.promotion && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Tag className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{audit.promotion.title}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
