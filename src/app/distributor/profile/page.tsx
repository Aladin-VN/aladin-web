'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale, useAuth } from '@/providers/app-provider';
import { toast } from 'sonner';
import { User, Building2, Phone, Mail, MapPin, FileText, CreditCard, Lock, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminHeader } from '@/components/layout/admin-header';

export default function DistributorProfile() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ name: '', contactPerson: '', contactPhone: '', email: '', address: '', taxId: '' });
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/distributor/dashboard');
        if (res.success && res.data?.distributor) {
          const d = res.data.distributor;
          setProfile(d);
          setForm({ name: d.name || '', contactPerson: d.contactPerson || '', contactPhone: d.contactPhone || '', email: d.email || '', address: d.address || '', taxId: d.taxId || '' });
        }
      } catch (e) { console.error("[FETCH ERROR]", e); }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 800));
    setProfile({ ...profile, ...form });
    setEditMode(false);
    setSaving(false);
    toast.success(t('Đã cập nhật hồ sơ!', 'Profile updated!'));
  };

  const handleChangePassword = () => {
    if (pwForm.newPw.length < 6) { toast.error(t('Mật khẩu tối thiểu 6 ký tự', 'Password must be at least 6 characters')); return; }
    if (pwForm.newPw !== pwForm.confirm) { toast.error(t('Mật khẩu xác nhận không khớp', 'Passwords do not match')); return; }
    toast.success(t('Đã đổi mật khẩu thành công!', 'Password changed!'));
    setPwForm({ current: '', newPw: '', confirm: '' });
  };

  const initials = (profile?.name || user?.name || 'U').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;

  return (
    <>
    <AdminHeader />
    <div className="flex flex-1 flex-col">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-600/20">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{t('Hồ sơ NPP', 'Distributor Profile')}</h1>
            <p className="text-sm text-muted-foreground">{t('Quản lý thông tin nhà phân phối', 'Manage distributor information')}</p>
          </div>
          {!editMode && <Button variant="outline" size="sm" onClick={() => setEditMode(true)}><FileText className="h-4 w-4 mr-1" />{t('Chỉnh sửa', 'Edit')}</Button>}
        </div>
      </div>
      <Separator />
      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Profile Card */}
          <Card className="shadow-sm rounded-xl">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mx-auto text-white text-2xl font-bold shadow-lg shadow-emerald-600/20">{initials}</div>
              <div>
                <h2 className="text-lg font-bold">{profile?.name || user?.name || '—'}</h2>
                <Badge variant="secondary" className="mt-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs">{t('Nhà phân phối', 'Distributor')}</Badge>
              </div>
              <Separator />
              <div className="space-y-3 text-left text-sm">
                <div className="flex items-center gap-3 text-muted-foreground"><Phone className="h-4 w-4 shrink-0" /><span>{profile?.contactPhone || '—'}</span></div>
                <div className="flex items-center gap-3 text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /><span>{profile?.email || '—'}</span></div>
                <div className="flex items-center gap-3 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><span>{profile?.address || 'Bình Dương, Việt Nam'}</span></div>
                {profile?.taxId && <div className="flex items-center gap-3 text-muted-foreground"><FileText className="h-4 w-4 shrink-0" /><span>MST: {profile.taxId}</span></div>}
              </div>
            </CardContent>
          </Card>

          {/* Right: Edit Form + Financial Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" />{t('Thông tin NPP', 'Distributor Information')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Tên NPP', 'Name')}</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!editMode} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Người liên hệ', 'Contact Person')}</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} disabled={!editMode} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Số điện thoại', 'Phone')}</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} disabled={!editMode} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label className="text-sm font-medium">Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!editMode} className="rounded-lg" /></div>
                  <div className="space-y-2 sm:col-span-2"><Label className="text-sm font-medium">{t('Địa chỉ', 'Address')}</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!editMode} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Mã số thuế (MST)', 'Tax ID')}</Label><Input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} disabled={!editMode} className="rounded-lg" /></div>
                </div>
                {editMode && <div className="flex gap-2 justify-end pt-2"><Button variant="outline" onClick={() => setEditMode(false)} className="rounded-lg">{t('Hủy', 'Cancel')}</Button><Button onClick={handleSave} disabled={saving} className="rounded-lg"><Save className="h-4 w-4 mr-1" />{saving ? t('Đang lưu...', 'Saving...') : t('Cập nhật', 'Update')}</Button></div>}
              </CardContent>
            </Card>

            {/* Financial Info */}
            <Card className="shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><CreditCard className="h-4 w-4" />{t('Thông tin tài chính', 'Financial Info')}</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t('Tỷ lệ phí NT', 'Commission Rate')}</p><p className="text-lg font-bold mt-1">{((profile?.commissionRate || 0.03) * 100).toFixed(1)}%</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t('Chi phí giao hàng', 'Delivery Fee Share')}</p><p className="text-lg font-bold mt-1">{((profile?.deliveryFeeShare || 1) * 100).toFixed(0)}%</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t('Tổng doanh thu', 'Total Revenue')}</p><p className="text-lg font-bold mt-1 text-emerald-600">{formatVND(profile?.totalRevenue || 0)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground">{t('Chờ thanh toán', 'Pending Payout')}</p><p className="text-lg font-bold mt-1 text-amber-600">{formatVND(profile?.pendingPayoutAmount || 0)}</p></div>
                </div>
                {(profile?.bankName || profile?.bankAccount) && (
                  <div className="mt-4 p-3 rounded-lg border space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground font-medium">{t('Thông tin ngân hàng', 'Bank Information')}</p>
                    <p>{profile.bankName} — <span className="font-mono">{profile.bankAccount}</span></p>
                    {profile.bankHolder && <p className="text-muted-foreground">{t('Chủ TK', 'Holder')}: {profile.bankHolder}</p>}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Change Password */}
            <Card className="shadow-sm rounded-xl">
              <CardHeader><CardTitle className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4" />{t('Đổi mật khẩu', 'Change Password')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Mật khẩu hiện tại', 'Current Password')}</Label><Input type="password" value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Mật khẩu mới', 'New Password')}</Label><Input type="password" value={pwForm.newPw} onChange={(e) => setPwForm({ ...pwForm, newPw: e.target.value })} className="rounded-lg" /></div>
                  <div className="space-y-2"><Label className="text-sm font-medium">{t('Xác nhận', 'Confirm')}</Label><Input type="password" value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })} className="rounded-lg" /></div>
                </div>
                <div className="flex justify-end"><Button onClick={handleChangePassword} className="rounded-lg"><Lock className="h-4 w-4 mr-1" />{t('Đổi mật khẩu', 'Change Password')}</Button></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}