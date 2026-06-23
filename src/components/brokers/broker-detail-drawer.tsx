'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { BrokerTierBadge, UserStatusBadge } from './broker-tier-badge';
import { toast } from 'sonner';
import {
  UserCircle,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Users,
  Award,
  Edit,
  Trash2,
  Loader2,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface BrokerDetail {
  id: string;
  tier: string;
  wardId: string | null;
  commissionRate: number;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalGmvGenerated: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    phone: string;
    name: string;
    nameEn: string | null;
    email: string | null;
    status: string;
    avatarUrl: string | null;
    zaloId: string | null;
    createdAt: string;
    lastLoginAt: string | null;
    shop: {
      id: string;
      name: string;
      district: string | null;
      province: string;
    } | null;
  };
  ward: {
    id: string;
    name: string;
    nameEn: string | null;
    district: string;
    province: string;
    shopCount: number;
  } | null;
}

// ============================================
// Broker Detail Drawer
// ============================================

interface BrokerDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerId: string | null;
  locale: string;
  onBrokerUpdated?: () => void;
  onEdit?: (broker: BrokerDetail) => void;
}

export function BrokerDetailDrawer({
  open,
  onOpenChange,
  brokerId,
  locale,
  onBrokerUpdated,
  onEdit,
}: BrokerDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [broker, setBroker] = useState<BrokerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchBroker = useCallback(async () => {
    if (!brokerId) return;
    try {
      setLoading(true);
      const res = await adminFetch(`/api/brokers/${brokerId}`);
      if (json.success) {
        setBroker(json.data);
      } else {
        toast.error(t('Failed to load broker', 'Khong the tai thong tin dai ly'));
      }
    } catch (err) {
      console.error('Fetch broker detail error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setLoading(false);
    }
  }, [brokerId, t]);

  useEffect(() => {
    if (open && brokerId) {
      fetchBroker();
    }
    if (!open) {
      setBroker(null);
    }
  }, [open, brokerId, fetchBroker]);

  const handleDelete = async () => {
    if (!broker) return;
    if (!confirm(t(
      `Are you sure you want to remove broker "${broker.user.name}"? The user account will be kept.`,
      `Ban co chac chan muon xoa dai ly "${broker.user.name}"? Tai khoan nguoi dung se duoc giu lai.`
    ))) return;

    try {
      setDeleting(true);
      const res = await adminFetch(`/api/brokers/${broker.id}`, { method: 'DELETE' });
      if (json.success) {
        toast.success(t('Broker removed', 'Xoa dai ly thanh cong'));
        onOpenChange(false);
        onBrokerUpdated?.();
      } else {
        toast.error(json.error?.message || t('Failed to delete', 'Khong the xoa'));
      }
    } catch (err) {
      console.error('Delete broker error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader className="pr-6">
          <SheetTitle className="flex items-center gap-2 text-base">
            {loading ? (
              <Skeleton className="h-5 w-48" />
            ) : broker ? (
              <>
                <UserCircle className="h-4 w-4 text-red-600" />
                <span>{broker.user.name}</span>
                <BrokerTierBadge tier={broker.tier} locale={locale} size="md" />
              </>
            ) : (
                <span>{t('Broker Detail', 'Chi tiết đại lý')}</span>
              )}
          </SheetTitle>
          <SheetDescription>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : broker ? (
              <span className="flex items-center gap-2">
                <UserStatusBadge status={broker.user.status} locale={locale} />
                {broker.ward && <span>{broker.ward.name}, {broker.ward.district}</span>}
              </span>
            ) : (
              <span>{t('Loading...', 'Đang tải...')}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : broker ? (
          <div className="flex-1 px-4 pb-6 space-y-4 mt-4">
            {/* Performance Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">
                  {t('Shops', 'Cua hang')}
                </p>
                <p className="text-lg font-bold">{broker.totalShopsReferred}</p>
                <p className="text-[10px] text-muted-foreground">{t('referred', 'duoc gioi thieu')}</p>
              </div>

              <div className="rounded-lg border p-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-red-600" />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">
                  {t('Commission', 'Hoa hong')}
                </p>
                <p className="text-lg font-bold text-red-700">
                  <SensitiveValue value={broker.totalCommissionEarned} maskType="amount" formatOptions={{ formatCurrency: true }} />
                </p>
                <p className="text-[10px] text-muted-foreground">{t('earned', 'da kiem')}</p>
              </div>

              <div className="rounded-lg border p-3 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <p className="text-[10px] text-muted-foreground uppercase font-medium">
                  {t('GMV', 'GMV')}
                </p>
                <p className="text-lg font-bold text-blue-700">
                  <SensitiveValue value={broker.totalGmvGenerated} maskType="amount" formatOptions={{ formatCurrency: true }} />
                </p>
                <p className="text-[10px] text-muted-foreground">{t('generated', 'tao ra')}</p>
              </div>
            </div>

            <Separator />

            {/* Broker Info */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                {t('Broker Information', 'Thong tin dai ly')}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Name', 'Ten')}</span>
                  <p className="text-sm font-medium">
                    <SensitiveValue value={broker.user.name} maskType="name" />
                  </p>
                  {broker.user.nameEn && (
                    <p className="text-[10px] text-muted-foreground">{broker.user.nameEn}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Phone', 'Dien thoai')}</span>
                  <p className="text-sm font-medium">
                    <SensitiveValue value={broker.user.phone} maskType="phone" />
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Email', 'Email')}</span>
                  <p className="text-sm font-medium">
                    {broker.user.email ? (
                      <SensitiveValue value={broker.user.email} maskType="name" />
                    ) : '-'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Tier', 'Cap dai ly')}</span>
                  <div>
                    <BrokerTierBadge tier={broker.tier} locale={locale} size="md" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Commission', 'Hoa hong')}</span>
                  <p className="text-sm font-semibold">
                    {(broker.commissionRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Status', 'Trang thai')}</span>
                  <UserStatusBadge status={broker.user.status} locale={locale} />
                </div>
                {broker.ward && (
                  <div className="space-y-1.5 col-span-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{t('Territory', 'Khu vuc')}</span>
                    </div>
                    <p className="text-sm pl-5.5">
                      {broker.ward.name}, {broker.ward.district}, {broker.ward.province}
                      <span className="text-xs text-muted-foreground ml-2">
                        ({broker.ward.shopCount} {t('shops', 'cua hang')})
                      </span>
                    </p>
                  </div>
                )}
                {broker.user.zaloId && (
                  <div className="space-y-1.5">
                    <span className="text-xs text-muted-foreground">{t('Zalo ID', 'Zalo ID')}</span>
                    <p className="text-sm font-medium font-mono">
                      <SensitiveValue value={broker.user.zaloId} maskType="id" />
                    </p>
                  </div>
                )}
                <div className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">{t('Joined', 'Ngay tham gia')}</span>
                  <p className="text-sm">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {new Date(broker.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onEdit?.(broker)}
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                {t('Edit', 'Sua')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                {t('Remove', 'Xoa')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">{t('No broker selected', 'Chua chon dai ly')}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
