'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, UserCircle } from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface BrokerFormData {
  userId: string;
  tier: string;
  wardId: string;
  commissionRate: string;
}

interface UserOption {
  id: string;
  phone: string;
  name: string;
}

interface WardOption {
  id: string;
  name: string;
  district: string;
}

interface BrokerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker?: {
    id: string;
    userId: string;
    tier: string;
    wardId: string | null;
    commissionRate: number;
    user: {
      id: string;
      phone: string;
      name: string;
    };
  } | null;
  locale: string;
  wards: WardOption[];
  onSaved?: () => void;
}

// ============================================
// Broker Form Dialog
// ============================================

export function BrokerFormDialog({
  open,
  onOpenChange,
  broker,
  locale,
  wards,
  onSaved,
}: BrokerFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isEdit = !!broker;

  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [form, setForm] = useState<BrokerFormData>({
    userId: '',
    tier: 'WARD_LEVEL',
    wardId: 'none',
    commissionRate: '3',
  });

  // Fetch available users (BROKER role, no existing broker)
  useEffect(() => {
    if (open && !isEdit) {
      fetchUsers();
    }
  }, [open, isEdit]);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      // Fetch all users — filter for BROKER role on backend ideally
      // For now, we use the list endpoint
      const res = await adminFetch('/api/brokers?limit=1');
      // We'll load all available users via a broader query
      // Since we don't have a dedicated users endpoint, we fetch from the list
      // In practice, use a separate /api/users?role=BROKER endpoint
      const usersRes = await adminFetch('/api/brokers?limit=1000');
      if (usersRes.success) {
        // Extract unique users from the response (excluding those already brokers)
        const brokerUserIds = new Set(usersRes.data.items.map((b: { userId: string }) => b.userId));
        // We need a way to get all users. For now, provide a simple approach:
        // The backend already handles duplicate checks, so we just need a userId input
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (open && broker) {
      setForm({
        userId: broker.userId,
        tier: broker.tier,
        wardId: broker.wardId || 'none',
        commissionRate: String(Math.round(broker.commissionRate * 100)),
      });
    } else if (open) {
      setForm({
        userId: '',
        tier: 'WARD_LEVEL',
        wardId: 'none',
        commissionRate: '3',
      });
    }
  }, [open, broker]);

  const updateField = (field: keyof BrokerFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!isEdit && !form.userId.trim()) {
      toast.error(t('User ID is required', 'User ID la bat buoc'));
      return;
    }

    const ratePercent = parseFloat(form.commissionRate);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      toast.error(t('Commission rate must be 0-100%', 'Ty le hoa hong phai 0-100%'));
      return;
    }

    try {
      setSaving(true);
      const url = broker ? `/api/brokers/${broker.id}` : '/api/brokers';
      const method = broker ? 'PATCH' : 'POST';

      const payload: Record<string, unknown> = {
        tier: form.tier,
        commissionRate: ratePercent / 100,
      };

      if (!isEdit) {
        payload.userId = form.userId.trim();
      }

      if (form.wardId && form.wardId !== 'none') {
        payload.wardId = form.wardId;
      } else if (isEdit) {
        payload.wardId = null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.success) {
        toast.success(isEdit
          ? t('Broker updated', 'Cap nhat dai ly thanh cong')
          : t('Broker created', 'Them dai ly thanh cong')
        );
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(res.error?.message || t('Failed to save', 'Khong the luu'));
      }
    } catch (err) {
      console.error('Save broker error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-4 w-4 text-red-600" />
            {isEdit
              ? t('Edit Broker', 'Sua dai ly')
              : t('Add Broker', 'Them dai ly')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Manage broker information, tier assignment, and commission rates',
              'Quan ly thong tin dai ly, cap phan va ty le hoa hong'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* User ID (create only) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="broker-user-id">{t('User ID', 'User ID')} <span className="text-red-500">*</span></Label>
              <Input
                id="broker-user-id"
                value={form.userId}
                onChange={(e) => updateField('userId', e.target.value)}
                placeholder={t('Enter user ID (cuid)', 'Nhap user ID (cuid)')}
              />
              <p className="text-[10px] text-muted-foreground">
                {t('The user must already exist in the system', 'Nguoi dung phai da ton tai trong he thong')}
              </p>
            </div>
          )}

          {/* Broker User Info (edit mode) */}
          {isEdit && broker && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
              <p className="text-xs text-muted-foreground">{t('Broker User', 'Nguoi dung dai ly')}</p>
              <p className="text-sm font-medium">{broker.user.name}</p>
              <p className="text-xs text-muted-foreground">{broker.user.phone}</p>
            </div>
          )}

          {/* Tier */}
          <div className="space-y-2">
            <Label htmlFor="broker-tier">{t('Broker Tier', 'Cap dai ly')} <span className="text-red-500">*</span></Label>
            <Select value={form.tier} onValueChange={(val) => updateField('tier', val)}>
              <SelectTrigger id="broker-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WARD_LEVEL">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {t('Ward Level', 'Cap Phuong')}
                  </span>
                </SelectItem>
                <SelectItem value="CATEGORY_SPECIALIST">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    {t('Category Specialist', 'Chuyen gia Danh muc')}
                  </span>
                </SelectItem>
                <SelectItem value="FACTORY_GATE">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange-500" />
                    {t('Factory Gate', 'Cong Nhap')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ward */}
          <div className="space-y-2">
            <Label htmlFor="broker-ward">{t('Assigned Ward', 'Phuong duoc phan')}</Label>
            <Select value={form.wardId} onValueChange={(val) => updateField('wardId', val)}>
              <SelectTrigger id="broker-ward">
                <SelectValue placeholder={t('Select ward (optional)', 'Chon phuong (tu chon)')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('None', 'Khong')}</SelectItem>
                {wards.map((ward) => (
                  <SelectItem key={ward.id} value={ward.id}>
                    {ward.name} ({ward.district})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Commission Rate */}
          <div className="space-y-2">
            <Label htmlFor="broker-commission">{t('Commission Rate (%)', 'Ty le hoa hong (%)')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="broker-commission"
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={form.commissionRate}
                onChange={(e) => updateField('commissionRate', e.target.value)}
                className="w-24 h-9"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="text-xs text-muted-foreground">
                {t(`= ${(parseFloat(form.commissionRate) || 0).toFixed(2)}% commission`, `= ${(parseFloat(form.commissionRate) || 0).toFixed(2)}% hoa hong`)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t('Standard rate is 3%. Stored as decimal (0.03).', 'Ty le chuan la 3%. Luu duoi dang thap phan (0.03).')}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!isEdit && !form.userId.trim())}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />
            {t('Save', 'Luu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
