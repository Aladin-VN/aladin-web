'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect, useCallback } from 'react';
import {
  Edit,
  Key,
  Ban,
  CheckCircle,
  Trash2,
  Loader2,
  Phone,
  Mail,
  Calendar,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { UserRoleBadge } from '@/components/settings/user-role-badge';
import { UserStatusBadge } from '@/components/settings/user-status-badge';
import { toast } from 'sonner';

interface UserDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  locale?: string;
  onUserUpdated: () => void;
  onEdit: (user: any) => void;
  onResetPassword: (user: any) => void;
}

interface UserDetail {
  id: string;
  phone: string;
  name: string;
  nameEn: string | null;
  email: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  mustChangePwd: boolean;
  createdAt: string;
  updatedAt: string;
  shop: { id: string; name: string; loyaltyTier: string; creditLimit: number; creditBalance: number } | null;
  broker: { id: string; tier: string; commissionRate: number; totalShopsReferred: number; totalCommissionEarned: number } | null;
  ordersCount?: number;
  transactionsCount?: number;
}

export function UserDetailDrawer({
  open,
  onOpenChange,
  userId,
  locale = 'vi',
  onUserUpdated,
  onEdit,
  onResetPassword,
}: UserDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchUser = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await adminFetch(`/api/users/${userId}`);
      const json = await res.json();
      if (json.success) {
        setUser(json.data);
      } else {
        toast.error(json.error?.message || t('Failed to fetch user', 'Khong tai duoc thong tin'));
      }
    } catch (err) {
      console.error('Fetch user error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    if (open && userId) {
      fetchUser();
    }
  }, [open, userId, fetchUser]);

  const handleToggleStatus = async () => {
    if (!user) return;
    setTogglingStatus(true);
    try {
      const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      const res = await adminFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(newStatus === 'ACTIVE' ? t('User reactivated', 'Kich hoat nguoi dung') : t('User suspended', 'Khoa nguoi dung'));
        fetchUser();
        onUserUpdated();
      } else {
        toast.error(json.error?.message || t('Failed', 'That bai'));
      }
    } catch (err) {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm(t(`Delete user "${user.name}"? This action cannot be undone.`, `Xoa nguoi dung "${user.name}"? Hanh dong khong the hoan tac.`))) return;

    setDeleting(true);
    try {
      const res = await adminFetch(`/api/users/${user.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(t('User deleted', 'Xoa nguoi dung thanh cong'));
        onOpenChange(false);
        onUserUpdated();
      } else {
        toast.error(json.error?.message || t('Failed', 'That bai'));
      }
    } catch (err) {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t('User Details', 'Chi tiet nguoi dung')}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !user ? (
          <div className="text-center py-16 text-muted-foreground">
            {t('User not found', 'Khong tim thay nguoi dung')}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {/* User Info Card */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{user.name}</h3>
                <div className="flex items-center gap-2">
                  <UserRoleBadge role={user.role} locale={locale} />
                  <UserStatusBadge status={user.status} locale={locale} />
                </div>
              </div>

              {user.nameEn && (
                <p className="text-sm text-muted-foreground">{user.nameEn}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <SensitiveValue value={user.phone} maskType="phone" />
                </div>
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {user.email}
                  </div>
                )}
              </div>
            </div>

            {/* Account Details */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {t('Account Details', 'Thong tin tai khoan')}
              </h4>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">{t('Created', 'Ngay tao')}</p>
                  <p className="font-medium flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {formatDate(user.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('Last Login', 'Dang nhap cuoi')}</p>
                  <p className="font-medium flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    {formatDate(user.lastLoginAt)}
                  </p>
                </div>
              </div>

              {user.mustChangePwd && (
                <div className="flex items-center gap-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-sm text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400">
                  <ShieldAlert className="h-4 w-4" />
                  {t('Must change password on next login', 'Phai doi mat khau khi dang nhap tiep theo')}
                </div>
              )}
            </div>

            {/* Related Info */}
            {(user.shop || user.broker) && (
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('Related Information', 'Thong tin lien quan')}
                </h4>

                {user.shop && (
                  <div className="space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">{t('Shop', 'Cua hang')}</p>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.shop.name}</span>
                      <Badge variant="outline" className="text-[10px]">{user.shop.loyaltyTier}</Badge>
                    </div>
                  </div>
                )}

                {user.broker && (
                  <div className="space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">{t('Broker', 'Dai ly')}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{user.broker.tier}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {t('Commission', 'Hoa hong')}: {(user.broker.commissionRate * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="rounded-lg border p-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('Statistics', 'Thong ke')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{user.ordersCount || 0}</p>
                  <p className="text-xs text-muted-foreground">{t('Orders', 'Don hang')}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{user.transactionsCount || 0}</p>
                  <p className="text-xs text-muted-foreground">{t('Transactions', 'Giao dich')}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Quick Actions */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {t('Quick Actions', 'Thao tac nhanh')}
              </h4>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onEdit(user)}
              >
                <Edit className="h-4 w-4 mr-2" />
                {t('Edit User', 'Chinh sua')}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => onResetPassword(user)}
              >
                <Key className="h-4 w-4 mr-2" />
                {t('Reset Password', 'Dat lai mat khau')}
              </Button>

              <Button
                variant="outline"
                className={`w-full justify-start ${
                  user.status === 'ACTIVE'
                    ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                    : 'text-red-600 hover:text-red-700 hover:bg-yellow-50'
                }`}
                onClick={handleToggleStatus}
                disabled={togglingStatus}
              >
                {togglingStatus ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : user.status === 'ACTIVE' ? (
                  <Ban className="h-4 w-4 mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {user.status === 'ACTIVE' ? t('Suspend User', 'Khoa nguoi dung') : t('Activate User', 'Kich hoat')}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                {t('Delete User', 'Xoa nguoi dung')}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
