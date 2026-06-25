'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import {
  Users, Star, CreditCard, Crown, Plus, Search, Phone, MapPin,
  ChevronDown, ChevronUp, X, Gift, MinusCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

// ============================================
// Types
// ============================================

interface Customer {
  id: string;
  name: string;
  code: string;
  phone: string;
  address?: string;
  district?: string;
  shopType?: string;
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  loyaltyPoints: number;
  totalSpend: number;
  creditStatus: 'good' | 'warning' | 'overdue';
  paymentTerms?: string;
  lastOrderDate?: string;
  lastOrderAmount?: number;
}

interface CustomerKpis {
  totalCustomers: number;
  avgLoyaltyPoints: number;
  totalCreditBalance: number;
  platinumCount: number;
}

type TierFilter = 'ALL' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

// ============================================
// Helpers
// ============================================

const t = (vi: string, en: string, locale: string) => (locale === 'vi' ? vi : en);

const tierColors: Record<string, string> = {
  BRONZE: '#CD7F32',
  SILVER: '#C0C0C0',
  GOLD: '#FFD700',
  PLATINUM: '#E5E4E2',
};

const tierLabelsVi: Record<string, string> = {
  BRONZE: 'Đồng',
  SILVER: 'Bạc',
  GOLD: 'Vàng',
  PLATINUM: 'Bạch kim',
};

const tierLabelsEn: Record<string, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

const creditDotColor: Record<string, string> = {
  good: 'bg-green-500',
  warning: 'bg-yellow-500',
  overdue: 'bg-red-500',
};

const creditLabelVi: Record<string, string> = {
  good: 'Tốt',
  warning: 'Cảnh báo',
  overdue: 'Quá hạn',
};

const creditLabelEn: Record<string, string> = {
  good: 'Good',
  warning: 'Warning',
  overdue: 'Overdue',
};

const shopTypes = ['Tạp hóa', 'Đại lý', 'Cửa hàng', 'Siêu thị mini', 'Chợ'];

// ============================================
// Component
// ============================================

export default function DistributorCustomersPage() {
  const locale = useAppStore((s) => s.locale);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('ALL');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [kpis, setKpis] = useState<CustomerKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Add customer dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', address: '', district: '', shopType: 'Tạp hóa' });
  const [addLoading, setAddLoading] = useState(false);

  // Loyalty dialog
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null);
  const [loyaltyAction, setLoyaltyAction] = useState<'add' | 'redeem'>('add');
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [loyaltyDesc, setLoyaltyDesc] = useState('');
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (tierFilter !== 'ALL') params.set('tier', tierFilter);
      params.set('page', String(page));
      params.set('limit', '20');
      const res = await adminFetch(`/api/distributor/customers?${params.toString()}`);
      if (res.success) {
        setCustomers(res.data?.items || res.data || []);
        setKpis(res.data?.kpis || null);
        setTotalPages(res.data?.meta?.totalPages || 1);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [search, tierFilter, page]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleAddCustomer = async () => {
    if (!addForm.name || !addForm.phone) return;
    setAddLoading(true);
    try {
      await adminFetch('/api/distributor/customers', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      setAddOpen(false);
      setAddForm({ name: '', phone: '', address: '', district: '', shopType: 'Tạp hóa' });
      fetchCustomers();
    } catch {
      // silent
    }
    setAddLoading(false);
  };

  const handleLoyaltyAction = async () => {
    if (!loyaltyCustomer || !loyaltyPoints) return;
    setLoyaltyLoading(true);
    try {
      await adminFetch('/api/distributor/customers/loyalty', {
        method: 'POST',
        body: JSON.stringify({
          customerId: loyaltyCustomer.id,
          action: loyaltyAction,
          points: parseInt(loyaltyPoints),
          description: loyaltyDesc,
        }),
      });
      setLoyaltyOpen(false);
      setLoyaltyPoints('');
      setLoyaltyDesc('');
      fetchCustomers();
    } catch {
      // silent
    }
    setLoyaltyLoading(false);
  };

  const openLoyalty = (customer: Customer) => {
    setLoyaltyCustomer(customer);
    setLoyaltyAction('add');
    setLoyaltyPoints('');
    setLoyaltyDesc('');
    setLoyaltyOpen(true);
  };

  const tierFilters: { key: TierFilter; vi: string; en: string }[] = [
    { key: 'ALL', vi: 'Tất cả', en: 'All' },
    { key: 'BRONZE', vi: 'Đồng', en: 'Bronze' },
    { key: 'SILVER', vi: 'Bạc', en: 'Silver' },
    { key: 'GOLD', vi: 'Vàng', en: 'Gold' },
    { key: 'PLATINUM', vi: 'Bạch kim', en: 'Platinum' },
  ];

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
  const tierIndex = (tier: string) => tiers.indexOf(tier as typeof tiers[number]);
  const nextTier = (tier: string) => {
    const idx = tierIndex(tier);
    return idx < tiers.length - 1 ? tiers[idx + 1] : null;
  };

  const tierPointThresholds: Record<string, number> = {
    BRONZE: 0,
    SILVER: 500,
    GOLD: 2000,
    PLATINUM: 5000,
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Khách hàng', 'Customers', locale)}
        rightAction={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-9 w-9">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] w-full mx-auto">
              <DialogHeader>
                <DialogTitle>{t('Thêm khách hàng', 'Add Customer', locale)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Tên khách hàng *', 'Customer Name *', locale)}
                  </label>
                  <Input
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder={t('Nhập tên...', 'Enter name...', locale)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Số điện thoại *', 'Phone Number *', locale)}
                  </label>
                  <Input
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    placeholder="09xx xxx xxx"
                    type="tel"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Địa chỉ', 'Address', locale)}
                  </label>
                  <Textarea
                    value={addForm.address}
                    onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                    placeholder={t('Nhập địa chỉ...', 'Enter address...', locale)}
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Quận/Huyện', 'District', locale)}
                  </label>
                  <Input
                    value={addForm.district}
                    onChange={(e) => setAddForm({ ...addForm, district: e.target.value })}
                    placeholder={t('Nhập quận/huyện...', 'Enter district...', locale)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Loại cửa hàng', 'Shop Type', locale)}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {shopTypes.map((st) => (
                      <Badge
                        key={st}
                        variant={addForm.shopType === st ? 'default' : 'outline'}
                        className="cursor-pointer text-xs py-1.5 px-3"
                        onClick={() => setAddForm({ ...addForm, shopType: st })}
                      >
                        {st}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  className="w-full mt-2"
                  onClick={handleAddCustomer}
                  disabled={addLoading || !addForm.name || !addForm.phone}
                >
                  {addLoading ? '...' : t('Thêm khách hàng', 'Add Customer', locale)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-10 h-11 rounded-xl"
            placeholder={t('Tìm tên, SĐT, mã KH...', 'Search name, phone, code...', locale)}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          {search && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSearch('')}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
          {tierFilters.map((tf) => (
            <button
              key={tf.key}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tierFilter === tf.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => { setTierFilter(tf.key); setPage(1); }}
            >
              {locale === 'vi' ? tf.vi : tf.en}
            </button>
          ))}
        </div>

        {/* KPI strip */}
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-32 shrink-0 rounded-xl" />
            ))}
          </div>
        ) : kpis ? (
          <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
            <div className="shrink-0 w-32">
              <MobileKpiCard
                label={t('Tổng khách', 'Total Customers', locale)}
                value={kpis.totalCustomers}
                icon={<Users className="h-4 w-4" />}
                variant="default"
              />
            </div>
            <div className="shrink-0 w-32">
              <MobileKpiCard
                label={t('Điểm TB', 'Avg Points', locale)}
                value={Math.round(kpis.avgLoyaltyPoints)}
                icon={<Star className="h-4 w-4" />}
                variant="success"
              />
            </div>
            <div className="shrink-0 w-32">
              <MobileKpiCard
                label={t('Công nợ', 'Credit', locale)}
                value={formatVND(kpis.totalCreditBalance)}
                icon={<CreditCard className="h-4 w-4" />}
                variant="warning"
              />
            </div>
            <div className="shrink-0 w-32">
              <MobileKpiCard
                label="VIP"
                labelVi={t('VIP', 'VIP', locale)}
                value={kpis.platinumCount}
                icon={<Crown className="h-4 w-4" />}
                variant="danger"
              />
            </div>
          </div>
        ) : null}

        {/* Customer list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="p-8 text-center">
              <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('Chưa có khách hàng', 'No customers found', locale)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {customers.map((c) => {
              const isExpanded = expandedId === c.id;
              const nt = nextTier(c.loyaltyTier);
              return (
                <Card
                  key={c.id}
                  className="rounded-xl overflow-hidden cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{c.name}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{c.code}</span>
                        </div>
                        <a
                          href={`tel:${c.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary flex items-center gap-1 mb-1.5"
                        >
                          <Phone className="h-3 w-3" />
                          {c.phone}
                        </a>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {c.shopType && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              {c.shopType}
                            </Badge>
                          )}
                          <Badge
                            className="text-[10px] py-0 text-white"
                            style={{ backgroundColor: tierColors[c.loyaltyTier] || '#999' }}
                          >
                            {locale === 'vi'
                              ? tierLabelsVi[c.loyaltyTier]
                              : tierLabelsEn[c.loyaltyTier]}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-[10px]">
                            <span className={`h-1.5 w-1.5 rounded-full ${creditDotColor[c.creditStatus]}`} />
                            <span className="text-muted-foreground">
                              {locale === 'vi'
                                ? creditLabelVi[c.creditStatus]
                                : creditLabelEn[c.creditStatus]}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatVND(c.totalSpend)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {t('Tổng chi tiêu', 'Total spend', locale)}
                        </p>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground mt-1" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />
                        )}
                      </div>
                    </div>

                    {/* Expanded section */}
                    {isExpanded && (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-2 text-xs">
                          {c.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-muted-foreground">
                                {c.address}{c.district ? `, ${c.district}` : ''}
                              </span>
                            </div>
                          )}
                          {c.paymentTerms && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {t('Điều khoản TT', 'Payment Terms', locale)}
                              </span>
                              <span className="font-medium">{c.paymentTerms}</span>
                            </div>
                          )}
                          {c.lastOrderDate && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">
                                {t('Đơn gần nhất', 'Last Order', locale)}
                              </span>
                              <span className="font-medium">
                                {new Date(c.lastOrderDate).toLocaleDateString('vi-VN')}
                                {c.lastOrderAmount ? ` — ${formatVND(c.lastOrderAmount)}` : ''}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              {t('Điểm tích lũy', 'Loyalty Points', locale)}
                            </span>
                            <span className="font-semibold text-primary">{c.loyaltyPoints}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); openLoyalty(c); }}
                          >
                            <Star className="h-3.5 w-3.5 mr-1" />
                            {t('Quản lý điểm', 'Manage Points', locale)}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              {locale === 'vi' ? 'Trước' : 'Prev'}
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              {locale === 'vi' ? 'Sau' : 'Next'}
            </Button>
          </div>
        )}

        {/* Loyalty Points Dialog */}
        <Dialog open={loyaltyOpen} onOpenChange={setLoyaltyOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] w-full mx-auto">
            <DialogHeader>
              <DialogTitle>
                {t('Quản lý điểm', 'Manage Points', locale)} — {loyaltyCustomer?.name}
              </DialogTitle>
            </DialogHeader>
            {loyaltyCustomer && (() => {
              const nt = nextTier(loyaltyCustomer.loyaltyTier);
              return (
              <div className="space-y-4 pt-2">
                {/* Current tier info */}
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t('Điểm hiện tại', 'Current Points', locale)}
                        </p>
                        <p className="text-xl font-bold">{loyaltyCustomer.loyaltyPoints}</p>
                      </div>
                      <Badge
                        className="text-white text-xs"
                        style={{ backgroundColor: tierColors[loyaltyCustomer.loyaltyTier] || '#999' }}
                      >
                        {locale === 'vi'
                          ? tierLabelsVi[loyaltyCustomer.loyaltyTier]
                          : tierLabelsEn[loyaltyCustomer.loyaltyTier]}
                      </Badge>
                    </div>
                    {nt && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{t('Tiến tới', 'Next', locale)}: {tierLabelsVi[nt]}</span>
                          <span>
                            {loyaltyCustomer.loyaltyPoints} / {tierPointThresholds[nt]}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(
                                (loyaltyCustomer.loyaltyPoints / tierPointThresholds[nt]) * 100,
                                100
                              )}%`,
                              backgroundColor: tierColors[nt],
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Action selector */}
                <div className="flex gap-2">
                  <Button
                    variant={loyaltyAction === 'add' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setLoyaltyAction('add')}
                  >
                    <Gift className="h-4 w-4 mr-1" />
                    {t('Tặng điểm', 'Add Points', locale)}
                  </Button>
                  <Button
                    variant={loyaltyAction === 'redeem' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setLoyaltyAction('redeem')}
                  >
                    <MinusCircle className="h-4 w-4 mr-1" />
                    {t('Trừ điểm', 'Redeem', locale)}
                  </Button>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Số điểm', 'Points', locale)}
                  </label>
                  <Input
                    type="number"
                    value={loyaltyPoints}
                    onChange={(e) => setLoyaltyPoints(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Mô tả', 'Description', locale)}
                  </label>
                  <Textarea
                    value={loyaltyDesc}
                    onChange={(e) => setLoyaltyDesc(e.target.value)}
                    placeholder={t('Nhập mô tả...', 'Enter description...', locale)}
                    rows={2}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleLoyaltyAction}
                  disabled={loyaltyLoading || !loyaltyPoints || parseInt(loyaltyPoints) <= 0}
                >
                  {loyaltyLoading ? '...' : loyaltyAction === 'add'
                    ? t('Tặng điểm', 'Add Points', locale)
                    : t('Trừ điểm', 'Redeem Points', locale)}
                </Button>
              </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}