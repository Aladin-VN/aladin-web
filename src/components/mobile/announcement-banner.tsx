'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app.store';

// ============================================
// Announcement Banner Types
// ============================================

export interface Announcement {
  id: string;
  title: string;
  titleVi?: string;
  body: string;
  bodyVi?: string;
  type: 'info' | 'promotion' | 'warning' | 'urgent';
  actionLabel?: string;
  actionLabelVi?: string;
  actionHref?: string;
  dismissible?: boolean;
  expiresAt?: string;
}

interface AnnouncementBannerProps {
  announcements: Announcement[];
  onDismiss?: (id: string) => void;
  className?: string;
}

// ============================================
// Banner Type Styles
// ============================================

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  info: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-900', icon: 'info' },
  promotion: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900', icon: 'promo' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900', icon: 'warn' },
  urgent: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-900', icon: 'urgent' },
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  info: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>,
  promo: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>,
  warn: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>,
  urgent: <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
};

// ============================================
// Announcement Banner Component
// ============================================

export function AnnouncementBanner({ announcements, onDismiss, className }: AnnouncementBannerProps) {
  const locale = useAppStore((s) => s.locale);

  if (!announcements || announcements.length === 0) return null;

  return (
    <div className={cn('space-y-2', className)}>
      {announcements.map((ann) => {
        const style = TYPE_STYLES[ann.type] || TYPE_STYLES.info;
        const icon = TYPE_ICONS[ann.type] || TYPE_ICONS.info;
        const isExpired = ann.expiresAt && new Date(ann.expiresAt) < new Date();
        if (isExpired) return null;

        return (
          <Card key={ann.id} className={cn('border', style.bg, style.border)}>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {locale === 'vi' && ann.titleVi ? ann.titleVi : ann.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {locale === 'vi' && ann.bodyVi ? ann.bodyVi : ann.body}
                  </p>
                  {ann.actionHref && (
                    <Button
                      variant="link"
                      className="h-auto p-0 mt-1 text-xs"
                      onClick={() => { if (ann.actionHref) window.location.href = ann.actionHref; }}
                    >
                      {locale === 'vi' && ann.actionLabelVi ? ann.actionLabelVi : ann.actionLabel || 'Xem chi tiết'}
                    </Button>
                  )}
                </div>
                {ann.dismissible && onDismiss && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => onDismiss(ann.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
