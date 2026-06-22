'use client';

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
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { toast } from 'sonner';
import { Loader2, Save, Factory, Warehouse } from 'lucide-react';

// ============================================
// Manufacturer Form Dialog
// ============================================

interface ManufacturerFormData {
  name: string;
  nameEn: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
  address: string;
  province: string;
  commissionRate: string;
}

interface ManufacturerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manufacturer?: {
    id: string;
    name: string;
    nameEn: string | null;
    contactPerson: string | null;
    contactPhone: string | null;
    email: string | null;
    address: string | null;
    province: string | null;
    commissionRate: number;
  } | null;
  locale: string;
  onSaved?: () => void;
}

export function ManufacturerFormDialog({
  open,
  onOpenChange,
  manufacturer,
  locale,
  onSaved,
}: ManufacturerFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isEdit = !!manufacturer;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ManufacturerFormData>({
    name: '',
    nameEn: '',
    contactPerson: '',
    contactPhone: '',
    email: '',
    address: '',
    province: '',
    commissionRate: '15',
  });

  useEffect(() => {
    if (open && manufacturer) {
      setForm({
        name: manufacturer.name,
        nameEn: manufacturer.nameEn || '',
        contactPerson: manufacturer.contactPerson || '',
        contactPhone: manufacturer.contactPhone || '',
        email: manufacturer.email || '',
        address: manufacturer.address || '',
        province: manufacturer.province || '',
        commissionRate: String(Math.round(manufacturer.commissionRate * 100)),
      });
    } else if (open) {
      setForm({ name: '', nameEn: '', contactPerson: '', contactPhone: '', email: '', address: '', province: '', commissionRate: '15' });
    }
  }, [open, manufacturer]);

  const updateField = (field: keyof ManufacturerFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const ratePercent = parseFloat(form.commissionRate);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      toast.error(t('Commission rate must be 0-100%', 'Ty le hoa hong phai 0-100%'));
      return;
    }

    try {
      setSaving(true);
      const url = manufacturer ? `/api/manufacturers/${manufacturer.id}` : '/api/manufacturers';
      const method = manufacturer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          nameEn: form.nameEn.trim() || null,
          contactPerson: form.contactPerson.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          province: form.province.trim() || null,
          commissionRate: ratePercent / 100,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(isEdit
          ? t('Manufacturer updated', 'Cap nhat nha san xuat thanh cong')
          : t('Manufacturer created', 'Them nha san xuat thanh cong')
        );
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(json.error?.message || t('Failed to save', 'Khong the luu'));
      }
    } catch (err) {
      console.error('Save manufacturer error:', err);
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
            <Factory className="h-4 w-4 text-red-600" />
            {isEdit
              ? t('Edit Manufacturer', 'Sua nha san xuat')
              : t('Add Manufacturer', 'Them nha san xuat')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Manage manufacturer information and commission rates',
              'Quan ly thong tin nha san xuat va ty le hoa hong'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="mfg-name">{t('Name', 'Ten')} <span className="text-red-500">*</span></Label>
            <Input id="mfg-name" value={form.name} onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('e.g., Unilever Vietnam', 'VD: Unilever Viet Nam')} />
          </div>

          {/* Name EN */}
          <div className="space-y-2">
            <Label htmlFor="mfg-name-en">{t('Name (English)', 'Ten (Tieng Anh)')}</Label>
            <Input id="mfg-name-en" value={form.nameEn} onChange={(e) => updateField('nameEn', e.target.value)}
              placeholder={t('English name (optional)', 'Ten tieng Anh (tu chon)')} />
          </div>

          {/* Contact Person + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mfg-contact">{t('Contact Person', 'Nguoi lien he')}</Label>
              <Input id="mfg-contact" value={form.contactPerson} onChange={(e) => updateField('contactPerson', e.target.value)}
                placeholder={t('Full name', 'Ho ten')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfg-phone">{t('Phone', 'Dien thoai')}</Label>
              <Input id="mfg-phone" value={form.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)}
                placeholder="0912 345 678" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="mfg-email">{t('Email', 'Email')}</Label>
            <Input id="mfg-email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
              placeholder="contact@manufacturer.com" />
          </div>

          {/* Address + Province */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mfg-address">{t('Address', 'Dia chi')}</Label>
              <Input id="mfg-address" value={form.address} onChange={(e) => updateField('address', e.target.value)}
                placeholder={t('Street address...', 'Dia chi duong...')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mfg-province">{t('Province', 'Tinh/Thanh')}</Label>
              <Input id="mfg-province" value={form.province} onChange={(e) => updateField('province', e.target.value)}
                placeholder={t('e.g., Ho Chi Minh', 'VD: TP Ho Chi Minh')} />
            </div>
          </div>

          {/* Commission Rate */}
          <div className="space-y-2">
            <Label htmlFor="mfg-commission">{t('Commission Rate (%)', 'Ty le hoa hong (%)')}</Label>
            <div className="flex items-center gap-2">
              <Input id="mfg-commission" type="number" min="0" max="100" step="0.5"
                value={form.commissionRate} onChange={(e) => updateField('commissionRate', e.target.value)}
                className="w-24 h-9" />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="text-xs text-muted-foreground">
                {t(`= ${(parseFloat(form.commissionRate) || 0).toFixed(2)}x margin`, `= ${(parseFloat(form.commissionRate) || 0).toFixed(2)}x lai nhuan`)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="bg-red-600 hover:bg-red-700 text-white">
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />
            {t('Save', 'Luu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Distributor Form Dialog
// ============================================

interface DistributorFormData {
  name: string;
  nameEn: string;
  contactPerson: string;
  contactPhone: string;
  email: string;
  address: string;
  lat: string;
  lng: string;
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  taxId: string;
  commissionRate: string;
  deliveryFeeShare: string;
}

interface DistributorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributor?: {
    id: string;
    name: string;
    nameEn: string | null;
    contactPerson: string | null;
    contactPhone: string | null;
    email: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    isActive: boolean;
    bankName: string | null;
    bankAccount: string | null;
    bankHolder: string | null;
    taxId: string | null;
    commissionRate: number;
    deliveryFeeShare: number;
  } | null;
  locale: string;
  onSaved?: () => void;
}

export function DistributorFormDialog({
  open,
  onOpenChange,
  distributor,
  locale,
  onSaved,
}: DistributorFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isEdit = !!distributor;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DistributorFormData>({
    name: '',
    nameEn: '',
    contactPerson: '',
    contactPhone: '',
    email: '',
    address: '',
    lat: '',
    lng: '',
    bankName: '',
    bankAccount: '',
    bankHolder: '',
    taxId: '',
    commissionRate: '3',
    deliveryFeeShare: '50',
  });

  useEffect(() => {
    if (open && distributor) {
      setForm({
        name: distributor.name,
        nameEn: distributor.nameEn || '',
        contactPerson: distributor.contactPerson || '',
        contactPhone: distributor.contactPhone || '',
        email: distributor.email || '',
        address: distributor.address || '',
        lat: distributor.lat !== null ? String(distributor.lat) : '',
        lng: distributor.lng !== null ? String(distributor.lng) : '',
        bankName: distributor.bankName || '',
        bankAccount: distributor.bankAccount || '',
        bankHolder: distributor.bankHolder || '',
        taxId: distributor.taxId || '',
        commissionRate: String(Math.round(distributor.commissionRate * 100)),
        deliveryFeeShare: String(Math.round(distributor.deliveryFeeShare * 100)),
      });
    } else if (open) {
      setForm({ name: '', nameEn: '', contactPerson: '', contactPhone: '', email: '', address: '', lat: '', lng: '', bankName: '', bankAccount: '', bankHolder: '', taxId: '', commissionRate: '3', deliveryFeeShare: '50' });
    }
  }, [open, distributor]);

  const updateField = (field: keyof DistributorFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;

    const ratePercent = parseFloat(form.commissionRate);
    if (isNaN(ratePercent) || ratePercent < 0 || ratePercent > 100) {
      toast.error(t('Platform fee must be 0-100%', 'Phi nen tang phai 0-100%'));
      return;
    }

    try {
      setSaving(true);
      const url = distributor ? `/api/distributors/${distributor.id}` : '/api/distributors';
      const method = distributor ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          nameEn: form.nameEn.trim() || null,
          contactPerson: form.contactPerson.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          lat: form.lat ? parseFloat(form.lat) : null,
          lng: form.lng ? parseFloat(form.lng) : null,
          bankName: form.bankName.trim() || null,
          bankAccount: form.bankAccount.trim() || null,
          bankHolder: form.bankHolder.trim() || null,
          taxId: form.taxId.trim() || null,
          commissionRate: ratePercent / 100,
          deliveryFeeShare: (parseFloat(form.deliveryFeeShare) || 50) / 100,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success(isEdit
          ? t('Distributor updated', 'Cap nhat nha phan phoi thanh cong')
          : t('Distributor created', 'Them nha phan phoi thanh cong')
        );
        onOpenChange(false);
        onSaved?.();
      } else {
        toast.error(json.error?.message || t('Failed to save', 'Khong the luu'));
      }
    } catch (err) {
      console.error('Save distributor error:', err);
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
            <Warehouse className="h-4 w-4 text-red-600" />
            {isEdit
              ? t('Edit Distributor', 'Sua nha phan phoi')
              : t('Add Distributor', 'Them nha phan phoi')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Manage distributor info, financial settings, and bank details',
              'Quan ly thong tin, cau hinh tai chinh va ngan hang'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="dist-name">{t('Name', 'Ten')} <span className="text-red-500">*</span></Label>
            <Input id="dist-name" value={form.name} onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('e.g., Binh Duong Wholesale', 'VD: Binh Duong Wholesale')} />
          </div>

          {/* Name EN */}
          <div className="space-y-2">
            <Label htmlFor="dist-name-en">{t('Name (English)', 'Ten (Tieng Anh)')}</Label>
            <Input id="dist-name-en" value={form.nameEn} onChange={(e) => updateField('nameEn', e.target.value)}
              placeholder={t('English name (optional)', 'Ten tieng Anh (tu chon)')} />
          </div>

          {/* Contact Person + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dist-contact">{t('Contact Person', 'Nguoi lien he')}</Label>
              <Input id="dist-contact" value={form.contactPerson} onChange={(e) => updateField('contactPerson', e.target.value)}
                placeholder={t('Full name', 'Ho ten')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dist-phone">{t('Phone', 'Dien thoai')}</Label>
              <Input id="dist-phone" value={form.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)}
                placeholder="0912 345 678" />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="dist-email">{t('Email', 'Email')}</Label>
            <Input id="dist-email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
              placeholder="contact@distributor.com" />
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="dist-address">{t('Address', 'Dia chi')}</Label>
            <Input id="dist-address" value={form.address} onChange={(e) => updateField('address', e.target.value)}
              placeholder={t('Full address...', 'Dia chi day du...')} />
          </div>

          {/* Coordinates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dist-lat">{t('Latitude', 'Vi do')}</Label>
              <Input id="dist-lat" type="number" step="0.0001" min="-90" max="90"
                value={form.lat} onChange={(e) => updateField('lat', e.target.value)}
                placeholder="10.9062" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dist-lng">{t('Longitude', 'Kinh do')}</Label>
              <Input id="dist-lng" type="number" step="0.0001" min="-180" max="180"
                value={form.lng} onChange={(e) => updateField('lng', e.target.value)}
                placeholder="106.7186" />
            </div>
          </div>

          {/* Financial Settings */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('Financial Settings', 'Cau hinh tai chinh')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dist-commission">{t('Platform Fee (%)', 'Phi nen tang (%)')}</Label>
                <div className="flex items-center gap-2">
                  <Input id="dist-commission" type="number" min="0" max="100" step="0.5"
                    value={form.commissionRate} onChange={(e) => updateField('commissionRate', e.target.value)}
                    className="w-24 h-9" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{t('Default: 3%', 'Mac dinh: 3%')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dist-delivery-share">{t('Delivery Fee Share (%)', 'Phi giao hang (%)')}</Label>
                <div className="flex items-center gap-2">
                  <Input id="dist-delivery-share" type="number" min="0" max="100" step="5"
                    value={form.deliveryFeeShare} onChange={(e) => updateField('deliveryFeeShare', e.target.value)}
                    className="w-24 h-9" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{t('Default: 50%', 'Mac dinh: 50%')}</p>
              </div>
            </div>
          </div>

          {/* Bank Information */}
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('Bank Information', 'Thong tin ngan hang')}
            </p>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="dist-bank-name">{t('Bank Name', 'Ten ngan hang')}</Label>
                <Input id="dist-bank-name" value={form.bankName} onChange={(e) => updateField('bankName', e.target.value)}
                  placeholder={t('e.g., Vietcombank', 'VD: Vietcombank')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dist-bank-account">{t('Account Number', 'So tai khoan')}</Label>
                  <Input id="dist-bank-account" value={form.bankAccount} onChange={(e) => updateField('bankAccount', e.target.value)}
                    placeholder="9876 5432 1098" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dist-bank-holder">{t('Account Holder', 'Chu tai khoan')}</Label>
                  <Input id="dist-bank-holder" value={form.bankHolder} onChange={(e) => updateField('bankHolder', e.target.value)}
                    placeholder={t('Full name', 'Ho ten day du')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dist-tax-id">{t('Tax ID (MST)', 'Ma so thue (MST)')}</Label>
                <Input id="dist-tax-id" value={form.taxId} onChange={(e) => updateField('taxId', e.target.value)}
                  placeholder="0301xxxx" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="bg-red-600 hover:bg-red-700 text-white">
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />
            {t('Save', 'Luu')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
