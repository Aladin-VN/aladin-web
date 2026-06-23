'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect, useCallback } from 'react';
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
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';

// ============================================
// Types
// ============================================

interface ShopDetail {
  id: string;
  name: string;
  nameEn: string | null;
  address: string | null;
  district: string | null;
  province: string;
  shopType: string;
  loyaltyTier: string;
  creditLimit: number;
  creditStatus: string;
  user: { name: string; phone: string } | null;
}

// ============================================
// Shop Edit Dialog
// ============================================

interface ShopEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string | null;
  locale: string;
  onUpdated?: () => void;
}

export function ShopEditDialog({
  open,
  onOpenChange,
  shopId,
  locale,
  onUpdated,
}: ShopEditDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [shopType, setShopType] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [creditStatus, setCreditStatus] = useState('');

  const fetchShop = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const res = await adminFetch(`/api/shops/${shopId}`);
      if (res.success) {
        const data = res.data;
        setShop(data);
        // Populate form
        setName(data.name);
        setNameEn(data.nameEn || '');
        setAddress(data.address || '');
        setDistrict(data.district || '');
        setProvince(data.province || '');
        setShopType(data.shopType);
        setLoyaltyTier(data.loyaltyTier);
        setCreditLimit(String(data.creditLimit));
        setCreditStatus(data.creditStatus);
      } else {
        toast.error(t('Failed to load shop', 'Khong the tai thong tin cua hang'));
      }
    } catch (err) {
      console.error('Fetch shop for edit error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setLoading(false);
    }
  }, [shopId, t]);

  useEffect(() => {
    if (open && shopId) {
      fetchShop();
    }
    if (!open) {
      setShop(null);
      resetForm();
    }
  }, [open, shopId, fetchShop]);

  const resetForm = () => {
    setName('');
    setNameEn('');
    setAddress('');
    setDistrict('');
    setProvince('');
    setShopType('');
    setLoyaltyTier('');
    setCreditLimit('');
    setCreditStatus('');
  };

  const handleSave = async () => {
    if (!shopId || !name.trim()) return;

    // Validate credit limit
    const limitNum = parseInt(creditLimit);
    if (isNaN(limitNum) || limitNum < 0) {
      toast.error(t('Credit limit must be a positive number', 'Han muc tin dung phai la so duong'));
      return;
    }

    try {
      setSaving(true);
      const res = await adminFetch(`/api/shops/${shopId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nameEn: nameEn.trim() || null,
          address: address.trim() || null,
          district: district.trim() || null,
          province: province.trim() || null,
          shopType,
          loyaltyTier,
          creditLimit: limitNum,
          creditStatus,
        }),
      });
      if (res.success) {
        toast.success(t('Shop updated successfully', 'Cap nhat cua hang thanh cong'));
        onOpenChange(false);
        onUpdated?.();
      } else {
        toast.error(res.error?.message || t('Failed to update shop', 'Khong the cap nhat cua hang'));
      }
    } catch (err) {
      console.error('Update shop error:', err);
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
            {shop ? (
              <>
                <SensitiveValue value={shop.name} maskType="name" />
              </>
            ) : (
              t('Edit Shop', 'Sua cua hang')
            )}
          </DialogTitle>
          <DialogDescription>
            {t('Update shop details, loyalty tier, and credit settings', 'Cap nhat thong tin cua hang, cap thanh vien va cau hinh tin dung')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : shop ? (
          <div className="space-y-4 py-2">
            {/* Name (Vietnamese) */}
            <div className="space-y-2">
              <Label htmlFor="shop-name">{t('Shop Name', 'Ten cua hang')} <span className="text-red-500">*</span></Label>
              <Input
                id="shop-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Enter shop name...', 'Nhap ten cua hang...')}
              />
            </div>

            {/* Name (English) */}
            <div className="space-y-2">
              <Label htmlFor="shop-name-en">{t('Name (English)', 'Ten (Tieng Anh)')}</Label>
              <Input
                id="shop-name-en"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder={t('English name (optional)', 'Ten tieng Anh (tu chon)')}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="shop-address">{t('Address', 'Dia chi')}</Label>
              <Input
                id="shop-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('Street address...', 'Dia chi duong...')}
              />
            </div>

            {/* District + Province row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="shop-district">{t('District', 'Quan/Huyen')}</Label>
                <Input
                  id="shop-district"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={t('Thu Dau Mot...', 'Thu Dau Mot...')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shop-province">{t('Province', 'Tinh/Thanh')}</Label>
                <Input
                  id="shop-province"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder={t('Binh Duong...', 'Binh Duong...')}
                />
              </div>
            </div>

            {/* Shop Type + Loyalty Tier row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('Shop Type', 'Loai cua hang')}</Label>
                <Select value={shopType} onValueChange={setShopType}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAPHOA">
                      <span className="flex items-center gap-1.5">
                        <span>&#127848;</span>
                        {t('Mom-and-pop', 'Tap hoa')}
                      </span>
                    </SelectItem>
                    <SelectItem value="CONVENIENCE">
                      <span className="flex items-center gap-1.5">
                        <span>&#128722;</span>
                        {t('Convenience', 'Tien loi')}
                      </span>
                    </SelectItem>
                    <SelectItem value="FACTORY">
                      <span className="flex items-center gap-1.5">
                        <span>&#127981;</span>
                        {t('Factory', 'Cong nghiep')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('Loyalty Tier', 'Cap thanh vien')}</Label>
                <Select value={loyaltyTier} onValueChange={setLoyaltyTier}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRONZE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        {t('Bronze', 'Dong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="SILVER">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-400" />
                        {t('Silver', 'Bac')}
                      </span>
                    </SelectItem>
                    <SelectItem value="GOLD">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
                        {t('Gold', 'Vang')}
                      </span>
                    </SelectItem>
                    <SelectItem value="PLATINUM">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                        {t('Platinum', 'Bach Kim')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Credit Limit + Credit Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="credit-limit">{t('Credit Limit (VND)', 'Han muc tin dung (VND)')}</Label>
                <Input
                  id="credit-limit"
                  type="number"
                  min="0"
                  max="50000000"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  className="h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  {t('Max: 50,000,000 VND', 'Toi da: 50.000.000d')}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t('Credit Status', 'Trang thai no')}</Label>
                <Select value={creditStatus} onValueChange={setCreditStatus}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        {t('Active', 'Hoat dong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="LOCKED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                        {t('Locked', 'Bi khoa')}
                      </span>
                    </SelectItem>
                    <SelectItem value="OVERDUE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        {t('Overdue', 'Qua han')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim() || loading}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            <Save className="h-4 w-4 mr-1" />
            {t('Save Changes', 'Luu thay doi')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
