'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AuditReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  audit: {
    id: string;
    shopName?: string;
    productName?: string;
    promotionTitle?: string;
    photoUrl?: string;
  } | null;
  locale?: string;
  onReviewed: () => void;
}

export function AuditReviewDialog({ open, onOpenChange, audit, locale = 'vi', onReviewed }: AuditReviewDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [action, setAction] = useState<'APPROVED' | 'REJECTED' | null>(null);

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!audit) return;
    setAction(status);
    setSubmitting(true);
    try {
      const res = await adminFetch(`/api/merchandising/${audit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes: reviewNotes || undefined }),
      });
      if (res.success) {
        toast.success(
          status === 'APPROVED'
            ? t('Audit approved', 'Da duyet trung bay')
            : t('Audit rejected', 'Da tu choi trung bay')
        );
        onReviewed();
        onOpenChange(false);
        setReviewNotes('');
        setAction(null);
      } else {
        toast.error(res.error?.message || t('Failed to review', 'Khong the duyet'));
      }
    } catch {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setReviewNotes(''); setAction(null); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('Review Merchandising Audit', 'Duyet trung bay')}</DialogTitle>
          <DialogDescription>
            {audit?.shopName && audit?.productName
              ? `${audit.shopName} — ${audit.productName}`
              : t('Review the shelf photo and approve or reject', 'Xem anh kệ hàng và duyệt hoặc từ chối')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Photo preview */}
          {audit?.photoUrl && (
            <div className="rounded-lg overflow-hidden border">
              <img
                src={audit.photoUrl}
                alt="Shelf photo"
                className="w-full h-48 object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}

          {audit?.promotionTitle && (
            <p className="text-xs text-muted-foreground">
              {t('Promotion', 'Khuyen mai')}: <span className="font-medium text-foreground">{audit.promotionTitle}</span>
            </p>
          )}

          {/* Review notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Review Notes', 'Ghi chu duyet')}</Label>
            <Textarea
              placeholder={t('Optional notes about this review...', 'Ghi chu tuy chon...')}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="h-9 text-xs"
              onClick={() => onOpenChange(false)}
            >
              {t('Cancel', 'Huy')}
            </Button>
            <Button
              variant="destructive"
              className="h-9 text-xs"
              onClick={() => handleReview('REJECTED')}
              disabled={submitting}
            >
              {submitting && action === 'REJECTED' && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              <XCircle className="h-3.5 w-3.5 mr-1" />
              {t('Reject', 'Tu choi')}
            </Button>
            <Button
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white"
              onClick={() => handleReview('APPROVED')}
              disabled={submitting}
            >
              {submitting && action === 'APPROVED' && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {t('Approve', 'Duyet')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
