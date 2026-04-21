'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { toast } from 'sonner';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: {
    id: string;
    name: string;
    nameEn: string | null;
    email: string | null;
    role: string;
    status: string;
    phone: string;
  } | null;
  locale?: string;
  onSaved: () => void;
}

export function UserFormDialog({ open, onOpenChange, user, locale = 'vi', onSaved }: UserFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isCreate = !user;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    name: '',
    nameEn: '',
    email: '',
    role: 'SALES_REP',
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        phone: user.phone,
        password: '',
        name: user.name,
        nameEn: user.nameEn || '',
        email: user.email || '',
        role: user.role,
        status: user.status,
      });
    } else {
      setFormData({
        phone: '',
        password: '',
        name: '',
        nameEn: '',
        email: '',
        role: 'SALES_REP',
        status: 'ACTIVE',
      });
    }
  }, [user, open]);

  const handleSubmit = async () => {
    // Validation
    if (isCreate && !formData.phone) {
      toast.error(t('Phone is required', 'So dien thoai la bat buoc'));
      return;
    }
    if (isCreate && formData.password.length < 8) {
      toast.error(t('Password must be at least 8 characters', 'Mat khau phai it nhat 8 ky tu'));
      return;
    }
    if (!formData.name) {
      toast.error(t('Name is required', 'Ten la bat buoc'));
      return;
    }
    if (!formData.role) {
      toast.error(t('Role is required', 'Vai tro la bat buoc'));
      return;
    }

    setLoading(true);
    try {
      let url = '/api/users';
      let method = 'POST';
      let body: Record<string, unknown> = {
        name: formData.name,
        nameEn: formData.nameEn || undefined,
        email: formData.email || undefined,
        role: formData.role,
      };

      if (isCreate) {
        body.phone = formData.phone;
        body.password = formData.password;
      } else {
        url = `/api/users/${user!.id}`;
        method = 'PATCH';
        body.status = formData.status;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(isCreate ? t('User created', 'Tao nguoi dung thanh cong') : t('User updated', 'Cap nhat nguoi dung thanh cong'));
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(json.error?.message || t('Operation failed', 'Thao tac that bai'));
      }
    } catch (err) {
      console.error('User form error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? t('Create New User', 'Tao nguoi dung moi') : t('Edit User', 'Chinh sua nguoi dung')}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Phone (create only) */}
          {isCreate && (
            <div className="grid gap-2">
              <Label>{t('Phone Number', 'So dien thoai')} *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="0912 345 678"
              />
            </div>
          )}

          {/* Password (create only) */}
          {isCreate && (
            <div className="grid gap-2">
              <Label>{t('Password', 'Mat khau')} *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                placeholder={t('Min 8 characters', 'It nhat 8 ky tu')}
              />
            </div>
          )}

          {/* Name */}
          <div className="grid gap-2">
            <Label>{t('Name (Vietnamese)', 'Ten (Tieng Viet)')} *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('e.g., Nguyen Van A', 'VD: Nguyen Van A')}
            />
          </div>

          {/* Name English */}
          <div className="grid gap-2">
            <Label>{t('Name (English)', 'Ten (Tieng Anh)')}</Label>
            <Input
              value={formData.nameEn}
              onChange={(e) => setFormData((p) => ({ ...p, nameEn: e.target.value }))}
              placeholder={t('e.g., John Nguyen', 'VD: John Nguyen')}
            />
          </div>

          {/* Email */}
          <div className="grid gap-2">
            <Label>{t('Email', 'Email')}</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
            />
          </div>

          {/* Role */}
          <div className="grid gap-2">
            <Label>{t('Role', 'Vai tro')} *</Label>
            <Select value={formData.role} onValueChange={(val) => setFormData((p) => ({ ...p, role: val }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">{t('Admin', 'Quan tri')}</SelectItem>
                <SelectItem value="SALES_REP">{t('Sales Rep', 'Nhan vien BH')}</SelectItem>
                <SelectItem value="DRIVER">{t('Driver', 'Tai xe')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status (edit only) */}
          {!isCreate && (
            <div className="grid gap-2">
              <Label>{t('Status', 'Trang thai')}</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData((p) => ({ ...p, status: val }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">{t('Active', 'Hoat dong')}</SelectItem>
                  <SelectItem value="SUSPENDED">{t('Suspended', 'Bi khoa')}</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">{t('Pending Verification', 'Cho xac minh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {isCreate ? t('Create', 'Tao') : t('Save', 'Luu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
