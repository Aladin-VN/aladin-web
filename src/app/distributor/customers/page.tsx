'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import {
  Users, Banknote, Gift, AlertCircle, Search, RefreshCw,
  ChevronLeft, ChevronRight, Plus, Star, Wallet, Edit3,
  Pencil, BanknoteIcon, Building2, Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminHeader } from '@/components/layout/admin-header';

// ============================================
// Types
// ============================================

interface Customer {
  id: string;
  code: string;
  name: string;
  phone: string;
  address: string | null;
  district: string | null;
  province: string;
  shopType: string | null;
  taxId: string | null;
  note: string | null;
  loyaltyPoints: number;
  loyaltyTier: string;
  totalSpend: number;
  totalOrders: number;
  creditLimit: number;
  creditBalance: number;
  creditStatus: string;
  paymentTermsDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LoyaltyTransaction {
  id: string;
  type: string;
  points: number;
  balance: number;
  description: string | null;
  createdAt: string;
}

interface CustomerStats {
  total: number;
  byTier: Record<string, number>;
  totalSpend: number;
  totalOrders: number;
}

// ============================================
// Constants
// ============================================

const TIER_MAP: Record<string, { vi: string; en: string; color: string; bg: string }> = {
  BRONZE: { vi: 'Đồng', en: 'Bronze', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40 border-orange-200' },
  SILVER: { vi: 'Bạc', en: 'Silver', color: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800/60 border-gray-300' },
  GOLD: { vi: 'Vàng', en: 'Gold', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200' },
  PLATINUM: { vi: 'Bạch kim', en: 'Platinum', color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/40 border-purple-200' },
};

const CREDIT_STATUS_MAP: Record<string, { vi: string; en: string; color: string; bg: string }> = {
  ACTIVE: { vi: 'Hoạt động', en: 'Active', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-200' },
  LOCKED: { vi: 'Khóa', en: 'Locked', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/40 border-red-200' },
  OVERDUE: { vi: 'Quá hạn', en: 'Overdue', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/40 border-orange-200' },
};

const SHOP_TYPE_MAP: Record<string, { vi: string; en: string }> = {
  TAPHOA: { vi: 'Tạp hóa', en: 'Grocery' },
  CONVENIENCE: { vi: 'Cửa hàng tiện lợi', en: 'Convenience Store' },
  RESTAURANT: { vi: 'Nhà hàng', en: 'Restaurant' },
  FACTORY: { vi: 'Nhà máy', en: 'Factory' },
};

const PAYMENT_TERMS_OPTIONS = [
  { value: '0', vi: 'COD (Không công nợ)', en: 'COD (No credit)' },
  { value: '7', vi: '7 ngày', en: '7 days' },
  { value: '14', vi: '14 ngày', en: '14 days' },
  { value: '30', vi: '30 ngày', en: '30 days' },
];

// ============================================
// Form state type for Add/Edit
// ============================================

interface CustomerFormData {
  name: string;
  phone: string;
  address: string;
  district: string;
  shopType: string;
  creditLimit: string;
  paymentTermsDays: string;
  note: string;
}

const EMPTY_FORM: CustomerFormData = {
  name: '',
  phone: '',
  address: '',
  district: '',
  shopType: '',
  creditLimit: '0',
  paymentTermsDays: '0',
  note: '',
};

// ============================================
// Main Component
// ============================================

export default function DistributorCustomersPage() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // ---- Data State ----
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ---- Filter State ----
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [creditFilter, setCreditFilter] = useState('');

  // ---- Dialog States ----
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [loyaltyDialogOpen, setLoyaltyDialogOpen] = useState(false);
  const [loyaltyCustomer, setLoyaltyCustomer] = useState<Customer | null>(null);
  const [loyaltyTab, setLoyaltyTab] = useState('earn');
  const [loyaltyPoints, setLoyaltyPoints] = useState('');
  const [loyaltyDescription, setLoyaltyDescription] = useState('');
  const [loyaltySubmitting, setLoyaltySubmitting] = useState(false);
  const [loyaltyLoadingTx, setLoyaltyLoadingTx] = useState(false);

  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditMethod, setCreditMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [creditNotes, setCreditNotes] = useState('');
  const [creditSubmitting, setCreditSubmitting] = useState(false);

  // ============================================
  // Fetch Customers
  // ============================================

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sort: 'latest',
      });
      if (search) params.set('search', search);
      if (tierFilter) params.set('tier', tierFilter);
      if (creditFilter) params.set('creditStatus', creditFilter);

      const res = await adminFetch(`/api/distributor/customers?${params}`);
      if (res.success) {
        setCustomers(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setStats(res.data.stats || null);
      }
    } catch (e) {
      console.error('[FETCH CUSTOMERS ERROR]', e);
    }
    setLoading(false);
  }, [page, search, tierFilter, creditFilter]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ============================================
  // Computed KPIs
  // ============================================

  const kpis = useMemo(() => {
    const totalCustomers = stats?.total ?? 0;
    const totalRevenue = stats?.totalSpend ?? 0;
    // Loyalty members = customers with points > 0 (approximate from stats — use items for accuracy)
    // We compute from loaded customers + stats for a rough number
    const loyaltyMembers = customers.filter((c) => c.loyaltyPoints > 0).length;
    const outstandingCredit = customers
      .filter((c) => c.creditStatus !== 'ACTIVE' && c.creditBalance > 0)
      .reduce((sum, c) => sum + c.creditBalance, 0);
    return { totalCustomers, totalRevenue, loyaltyMembers, outstandingCredit };
  }, [stats, customers]);

  // ============================================
  // Format helpers
  // ============================================

  const formatVNDInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    return digits ? new Intl.NumberFormat('vi-VN').format(parseInt(digits)) : '';
  };

  const parseVNDInput = (formatted: string) => {
    return parseInt(formatted.replace(/\D/g, ''), 10) || 0;
  };

  const tierBadge = (tier: string) => {
    const info = TIER_MAP[tier];
    if (!info) return <Badge variant="secondary">{tier}</Badge>;
    return (
      <Badge variant="outline" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 border ${info.bg} ${info.color}`}>
        {locale === 'vi' ? info.vi : info.en}
      </Badge>
    );
  };

  const creditBadge = (status: string) => {
    const info = CREDIT_STATUS_MAP[status];
    if (!info) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge variant="outline" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 border ${info.bg} ${info.color}`}>
        {locale === 'vi' ? info.vi : info.en}
      </Badge>
    );
  };

  const shopTypeLabel = (type: string | null) => {
    if (!type) return '—';
    const info = SHOP_TYPE_MAP[type];
    return info ? (locale === 'vi' ? info.vi : info.en) : type;
  };

  // ============================================
  // Add / Edit Customer Dialog
  // ============================================

  const openAddDialog = () => {
    setEditingCustomer(null);
    setFormData(EMPTY_FORM);
    setFormDialogOpen(true);
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      address: customer.address || '',
      district: customer.district || '',
      shopType: customer.shopType || '',
      creditLimit: String(customer.creditLimit),
      paymentTermsDays: String(customer.paymentTermsDays),
      note: customer.note || '',
    });
    setFormDialogOpen(true);
  };

  const handleFormChange = (field: keyof CustomerFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitForm = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error(t('Vui lòng nhập tên cửa hàng', 'Please enter shop name'));
      return;
    }
    if (!formData.phone.trim()) {
      toast.error(t('Vui lòng nhập số điện thoại', 'Please enter phone number'));
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!/^0[35789][0-9]{8}$/.test(cleanPhone)) {
      toast.error(t('Số điện thoại không hợp lệ (09xx/03xx/07xx/08xx/05xx)', 'Invalid phone number'));
      return;
    }

    setFormSubmitting(true);
    try {
      const isEdit = !!editingCustomer;
      const url = '/api/distributor/customers';
      const method = isEdit ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        phone: cleanPhone,
      };

      if (formData.address.trim()) body.address = formData.address.trim();
      if (formData.district.trim()) body.district = formData.district.trim();
      if (formData.shopType) body.shopType = formData.shopType;
      if (formData.note.trim()) body.note = formData.note.trim();

      const creditLimit = parseVNDInput(formData.creditLimit);
      body.creditLimit = creditLimit;
      body.paymentTermsDays = parseInt(formData.paymentTermsDays, 10) || 0;

      if (isEdit) {
        body.id = editingCustomer!.id;
      }

      const res = await adminFetch(url, { method, body: JSON.stringify(body) });
      if (res.success) {
        toast.success(isEdit ? t('Cập nhật khách hàng thành công!', 'Customer updated successfully!') : t('Thêm khách hàng thành công!', 'Customer created successfully!'));
        setFormDialogOpen(false);
        fetchCustomers();
      } else {
        toast.error(res.error?.message || t('Lỗi, vui lòng thử lại', 'Error, please try again'));
      }
    } catch (e) {
      console.error('[FORM SUBMIT ERROR]', e);
      toast.error(t('Lỗi kết nối', 'Connection error'));
    } finally {
      setFormSubmitting(false);
    }
  };

  // ============================================
  // Loyalty Points Dialog
  // ============================================

  const openLoyaltyDialog = async (customer: Customer) => {
    setLoyaltyCustomer(customer);
    setLoyaltyTab('earn');
    setLoyaltyPoints('');
    setLoyaltyDescription('');
    setLoyaltyTransactions([]);
    setLoyaltyDialogOpen(true);

    // Fetch recent loyalty transactions
    setLoyaltyLoadingTx(true);
    try {
      const res = await adminFetch(
        `/api/distributor/customers?search=${encodeURIComponent(customer.code)}&limit=1`
      );
      if (res.success) {
        // Also fetch transactions — use credit/transactions endpoint or loyalty endpoint
        // Since we don't have a dedicated list endpoint, we'll show info from customer
      }
    } catch {
      // silently fail for transactions
    }
    setLoyaltyLoadingTx(false);
  };

  const handleSubmitLoyalty = async () => {
    if (!loyaltyCustomer) return;

    const pts = parseInt(loyaltyPoints, 10);
    if (!pts || isNaN(pts)) {
      toast.error(t('Nhập số điểm hợp lệ', 'Enter valid points'));
      return;
    }

    if (loyaltyTab === 'earn' && pts <= 0) {
      toast.error(t('Điểm tích lũy phải lớn hơn 0', 'Points must be greater than 0'));
      return;
    }

    if (loyaltyTab === 'redeem' && (pts <= 0 || pts > loyaltyCustomer.loyaltyPoints)) {
      toast.error(t(`Điểm không được vượt quá ${loyaltyCustomer.loyaltyPoints}`, `Points cannot exceed ${loyaltyCustomer.loyaltyPoints}`));
      return;
    }

    setLoyaltySubmitting(true);
    try {
      const type = loyaltyTab === 'earn' ? 'EARN' : loyaltyTab === 'redeem' ? 'REDEEM' : 'ADJUST';
      const res = await adminFetch('/api/distributor/customers/loyalty', {
        method: 'POST',
        body: JSON.stringify({
          customerId: loyaltyCustomer.id,
          type,
          points: pts,
          description: loyaltyDescription.trim() || undefined,
        }),
      });

      if (res.success) {
        const typeLabel =
          type === 'EARN'
            ? t('Tích điểm thành công!', 'Points earned successfully!')
            : type === 'REDEEM'
              ? t('Đổi điểm thành công!', 'Points redeemed successfully!')
              : t('Điều chỉnh điểm thành công!', 'Points adjusted successfully!');
        toast.success(typeLabel);
        setLoyaltyDialogOpen(false);
        fetchCustomers();
      } else {
        toast.error(res.error?.message || t('Lỗi, vui lòng thử lại', 'Error, please try again'));
      }
    } catch (e) {
      console.error('[LOYALTY ERROR]', e);
      toast.error(t('Lỗi kết nối', 'Connection error'));
    } finally {
      setLoyaltySubmitting(false);
    }
  };

  // ============================================
  // Credit Payment Dialog
  // ============================================

  const openCreditDialog = (customer: Customer) => {
    setCreditCustomer(customer);
    setCreditAmount('');
    setCreditMethod('CASH');
    setCreditNotes('');
    setCreditDialogOpen(true);
  };

  const creditLoyaltyPreview = useMemo(() => {
    const amount = parseVNDInput(creditAmount);
    return Math.floor(amount / 100_000);
  }, [creditAmount]);

  const handleSubmitCredit = async () => {
    if (!creditCustomer) return;

    const amount = parseVNDInput(creditAmount);
    if (!amount || amount <= 0) {
      toast.error(t('Nhập số tiền hợp lệ', 'Enter a valid amount'));
      return;
    }
    if (amount > creditCustomer.creditBalance) {
      toast.error(t('Số tiền vượt quá công nợ', 'Amount exceeds outstanding debt'));
      return;
    }

    setCreditSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/customers/credit-payment', {
        method: 'POST',
        body: JSON.stringify({
          customerId: creditCustomer.id,
          amount,
          paymentMethod: creditMethod,
          notes: creditNotes.trim() || undefined,
        }),
      });

      if (res.success) {
        toast.success(t('Thu nợ thành công!', 'Payment recorded successfully!'));
        setCreditDialogOpen(false);
        fetchCustomers();
      } else {
        toast.error(res.error?.message || t('Lỗi, vui lòng thử lại', 'Error, please try again'));
      }
    } catch (e) {
      console.error('[CREDIT PAYMENT ERROR]', e);
      toast.error(t('Lỗi kết nối', 'Connection error'));
    } finally {
      setCreditSubmitting(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  return (
    <>
      <AdminHeader />

      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Quản lý khách hàng', 'Customer Management')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('CRM — Theo dõi, quản lý khách hàng và công nợ', 'CRM — Track and manage customers and credit')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchCustomers} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* ===== KPI Cards ===== */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Customers */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('Tổng khách hàng', 'Total Customers')}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">
                        {kpis.totalCustomers}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('khách hàng đang hoạt động', 'active customers')}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Revenue */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('Tổng doanh thu', 'Total Revenue')}
                      </p>
                      <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                        {formatVND(kpis.totalRevenue)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('từ tất cả khách hàng', 'from all customers')}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Loyalty Members */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('Thành viên tích điểm', 'Loyalty Members')}
                      </p>
                      <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">
                        {kpis.loyaltyMembers}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('có điểm tích lũy', 'with loyalty points')}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Outstanding Credit */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {t('Công nợ xấu', 'Outstanding Credit')}
                      </p>
                      <p className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">
                        {formatVND(kpis.outstandingCredit)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t('cần thu hồi', 'needs collection')}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ===== Search & Filter Bar ===== */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('Tìm tên, SĐT, mã KH...', 'Search name, phone, code...')}
                  className="pl-9 h-9 text-sm rounded-lg"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>

              {/* Tier Filter */}
              <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[140px] h-9 text-sm rounded-lg">
                  <SelectValue placeholder={t('Hạng', 'Tier')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('Tất cả hạng', 'All Tiers')}</SelectItem>
                  <SelectItem value="BRONZE">{t('Đồng', 'Bronze')}</SelectItem>
                  <SelectItem value="SILVER">{t('Bạc', 'Silver')}</SelectItem>
                  <SelectItem value="GOLD">{t('Vàng', 'Gold')}</SelectItem>
                  <SelectItem value="PLATINUM">{t('Bạch kim', 'Platinum')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Credit Status Filter */}
              <Select value={creditFilter} onValueChange={(v) => { setCreditFilter(v === 'ALL' ? '' : v); setPage(1); }}>
                <SelectTrigger className="w-full sm:w-[150px] h-9 text-sm rounded-lg">
                  <SelectValue placeholder={t('Công nợ', 'Credit')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('Tất cả trạng thái', 'All Status')}</SelectItem>
                  <SelectItem value="ACTIVE">{t('Hoạt động', 'Active')}</SelectItem>
                  <SelectItem value="LOCKED">{t('Khóa', 'Locked')}</SelectItem>
                  <SelectItem value="OVERDUE">{t('Quá hạn', 'Overdue')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Add Customer Button */}
            <Button
              onClick={openAddDialog}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('Thêm khách hàng', 'Add Customer')}
            </Button>
          </div>

          {/* ===== Customer Table ===== */}
          <Card className="shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 md:p-6 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-16 rounded" />
                      <Skeleton className="h-4 w-28 rounded" />
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded ml-auto" />
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-20 w-36 rounded" />
                    </div>
                  ))}
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('Chưa có khách hàng nào', 'No customers found')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t('Nhấn "Thêm khách hàng" để bắt đầu', 'Click "Add Customer" to get started')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">
                          {t('Mã', 'Code')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">
                          {t('Tên', 'Name')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">
                          {t('Điện thoại', 'Phone')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">
                          {t('Loại', 'Type')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">
                          {t('Hạng', 'Tier')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                          {t('Tổng chi tiêu', 'Total Spend')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                          {t('Công nợ', 'Credit')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                          {t('Điểm', 'Points')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                          {t('Trạng thái', 'Status')}
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                          {t('Hành động', 'Actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer) => (
                        <TableRow
                          key={customer.id}
                          className={`transition-colors ${!customer.isActive ? 'opacity-50' : 'hover:bg-muted/50'}`}
                        >
                          {/* Code */}
                          <TableCell>
                            <span className="font-mono text-xs font-semibold text-muted-foreground">
                              {customer.code}
                            </span>
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{customer.name}</p>
                              {customer.district && (
                                <p className="text-[11px] text-muted-foreground">{customer.district}</p>
                              )}
                            </div>
                          </TableCell>

                          {/* Phone */}
                          <TableCell>
                            <span className="text-sm">{customer.phone}</span>
                          </TableCell>

                          {/* Shop Type */}
                          <TableCell>
                            {customer.shopType ? (
                              <Badge variant="outline" className="rounded-full text-[11px] font-medium px-2 py-0.5 border-muted">
                                {shopTypeLabel(customer.shopType)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          {/* Tier */}
                          <TableCell>{tierBadge(customer.loyaltyTier)}</TableCell>

                          {/* Total Spend */}
                          <TableCell className="text-right">
                            <span className="text-sm font-semibold">{formatVND(customer.totalSpend)}</span>
                          </TableCell>

                          {/* Credit Balance */}
                          <TableCell className="text-right">
                            <span className={`text-sm font-semibold ${customer.creditBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                              {formatVND(customer.creditBalance)}
                            </span>
                          </TableCell>

                          {/* Loyalty Points */}
                          <TableCell className="text-center">
                            <span className="text-sm font-medium">
                              {customer.loyaltyPoints > 0 ? (
                                <span className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400">
                                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                                  {customer.loyaltyPoints}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="text-center">
                            <Badge
                              variant="outline"
                              className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 border ${
                                customer.isActive
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-800'
                                  : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700'
                              }`}
                            >
                              {customer.isActive
                                ? t('Hoạt động', 'Active')
                                : t('Ngừng', 'Inactive')}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLoyaltyDialog(customer);
                                }}
                              >
                                <Star className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">{t('Điểm', 'Pts')}</span>
                              </Button>
                              {customer.creditBalance > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openCreditDialog(customer);
                                  }}
                                >
                                  <Wallet className="h-3.5 w-3.5" />
                                  <span className="hidden xl:inline">{t('Thu nợ', 'Pay')}</span>
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1 hover:bg-muted"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(customer);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden xl:inline">{t('Sửa', 'Edit')}</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ===== Pagination ===== */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('Trước', 'Prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('Sau', 'Next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================ */}
      {/* ===== Add / Edit Customer Dialog ========== */}
      {/* ============================================ */}
      <Dialog open={formDialogOpen} onOpenChange={(open) => { if (!open) setFormDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                {editingCustomer ? (
                  <Edit3 className="h-4.5 w-4.5 text-blue-600" />
                ) : (
                  <Plus className="h-4.5 w-4.5 text-blue-600" />
                )}
              </div>
              {editingCustomer
                ? t('Sửa khách hàng', 'Edit Customer')
                : t('Thêm khách hàng mới', 'Add New Customer')}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? t(`Chỉnh sửa thông tin ${editingCustomer.name}`, `Edit information for ${editingCustomer.name}`)
                : t('Nhập thông tin khách hàng mới', 'Enter new customer information')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Shop Name */}
            <div className="space-y-2">
              <Label htmlFor="form-name">
                {t('Tên cửa hàng')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="form-name"
                placeholder={t('VD: Tạp hóa An Phát', 'e.g. An Phat Grocery')}
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="form-phone">
                {t('Số điện thoại')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="form-phone"
                placeholder="0912 345 678"
                value={formData.phone}
                onChange={(e) => handleFormChange('phone', e.target.value)}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label htmlFor="form-address">{t('Địa chỉ', 'Address')}</Label>
              <Input
                id="form-address"
                placeholder={t('Số nhà, tên đường', 'Street address')}
                value={formData.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
              />
            </div>

            {/* District */}
            <div className="space-y-2">
              <Label htmlFor="form-district">{t('Quận/Huyện', 'District')}</Label>
              <Input
                id="form-district"
                placeholder={t('VD: Thủ Đức', 'e.g. Thu Duc')}
                value={formData.district}
                onChange={(e) => handleFormChange('district', e.target.value)}
              />
            </div>

            {/* Shop Type */}
            <div className="space-y-2">
              <Label>{t('Loại hình', 'Shop Type')}</Label>
              <Select
                value={formData.shopType}
                onValueChange={(v) => handleFormChange('shopType', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('Chọn loại hình...', 'Select shop type...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAPHOA">{t('Tạp hóa', 'Grocery')}</SelectItem>
                  <SelectItem value="CONVENIENCE">{t('Cửa hàng tiện lợi', 'Convenience Store')}</SelectItem>
                  <SelectItem value="RESTAURANT">{t('Nhà hàng', 'Restaurant')}</SelectItem>
                  <SelectItem value="FACTORY">{t('Nhà máy', 'Factory')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit Limit & Payment Terms (side by side on sm+) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="form-credit-limit">{t('Hạn mức tín dụng (₫)', 'Credit Limit (₫)')}</Label>
                <div className="relative">
                  <Input
                    id="form-credit-limit"
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={formatVNDInput(formData.creditLimit)}
                    onChange={(e) => handleFormChange('creditLimit', e.target.value.replace(/\D/g, ''))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ₫
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('Số ngày công nợ', 'Payment Terms (days)')}</Label>
                <Select
                  value={formData.paymentTermsDays}
                  onValueChange={(v) => handleFormChange('paymentTermsDays', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {locale === 'vi' ? opt.vi : opt.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label htmlFor="form-note">{t('Ghi chú', 'Note')}</Label>
              <Textarea
                id="form-note"
                placeholder={t('Ghi chú thêm...', 'Additional notes...')}
                value={formData.note}
                onChange={(e) => handleFormChange('note', e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFormDialogOpen(false)} disabled={formSubmitting}>
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmitForm}
              disabled={formSubmitting || !formData.name.trim() || !formData.phone.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
            >
              {formSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('Đang lưu...', 'Saving...')}
                </>
              ) : editingCustomer ? (
                <>
                  <Edit3 className="h-4 w-4 mr-2" />
                  {t('Cập nhật', 'Update')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('Tạo mới', 'Create')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* ===== Loyalty Points Dialog =============== */}
      {/* ============================================ */}
      <Dialog open={loyaltyDialogOpen} onOpenChange={(open) => { if (!open) setLoyaltyDialogOpen(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <Star className="h-4.5 w-4.5 text-amber-600" />
              </div>
              {t('Quản lý điểm', 'Loyalty Points')}
            </DialogTitle>
            <DialogDescription>
              {loyaltyCustomer && (
                <>
                  {loyaltyCustomer.name} — {loyaltyCustomer.code}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-sm font-semibold text-foreground">
                      {t('Điểm hiện tại: ', 'Current points: ')}
                      <span className="text-amber-600 dark:text-amber-400">{loyaltyCustomer.loyaltyPoints}</span>
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    {tierBadge(loyaltyCustomer.loyaltyTier)}
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={loyaltyTab} onValueChange={setLoyaltyTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="earn" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                {t('Tích điểm', 'Earn')}
              </TabsTrigger>
              <TabsTrigger value="redeem" className="text-xs">
                <Gift className="h-3.5 w-3.5 mr-1.5" />
                {t('Đổi điểm', 'Redeem')}
              </TabsTrigger>
              <TabsTrigger value="adjust" className="text-xs">
                <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                {t('Điều chỉnh', 'Adjust')}
              </TabsTrigger>
            </TabsList>

            {(['earn', 'redeem', 'adjust'] as const).map((tabType) => (
              <TabsContent key={tabType} value={tabType} className="space-y-4 pt-2">
                {/* Points Input */}
                <div className="space-y-2">
                  <Label htmlFor={`loyalty-points-${tabType}`}>
                    {tabType === 'earn'
                      ? t('Số điểm tích lũy', 'Points to earn')
                      : tabType === 'redeem'
                        ? t('Số điểm đổi', 'Points to redeem')
                        : t('Số điểm (âm để giảm)', 'Points (+/-)')}
                  </Label>
                  <Input
                    id={`loyalty-points-${tabType}`}
                    type="number"
                    inputMode="numeric"
                    min={tabType === 'adjust' ? undefined : '1'}
                    max={tabType === 'redeem' ? String(loyaltyCustomer?.loyaltyPoints || 0) : undefined}
                    placeholder={tabType === 'adjust' ? t('VD: 50 hoặc -20', 'e.g. 50 or -20') : '0'}
                    value={loyaltyPoints}
                    onChange={(e) => setLoyaltyPoints(e.target.value)}
                  />
                  {tabType === 'redeem' && loyaltyCustomer && (
                    <p className="text-[11px] text-muted-foreground">
                      {t(`Tối đa: ${loyaltyCustomer.loyaltyPoints} điểm`, `Max: ${loyaltyCustomer.loyaltyPoints} points`)}
                    </p>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor={`loyalty-desc-${tabType}`}>{t('Mô tả', 'Description')}</Label>
                  <Input
                    id={`loyalty-desc-${tabType}`}
                    placeholder={
                      tabType === 'earn'
                        ? t('VD: Thưởng đơn hàng lớn', 'e.g. Large order bonus')
                        : tabType === 'redeem'
                          ? t('VD: Đổi quà tặng', 'e.g. Redeem gift')
                          : t('VD: Bù điểm lỗi hệ thống', 'e.g. System error correction')
                    }
                    value={loyaltyDescription}
                    onChange={(e) => setLoyaltyDescription(e.target.value)}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setLoyaltyDialogOpen(false)} disabled={loyaltySubmitting}>
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmitLoyalty}
              disabled={loyaltySubmitting || !loyaltyPoints || parseInt(loyaltyPoints) === 0}
              className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
            >
              {loyaltySubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('Đang lưu...', 'Saving...')}
                </>
              ) : (
                <>
                  <Star className="h-4 w-4 mr-2" />
                  {loyaltyTab === 'earn'
                    ? t('Tích điểm', 'Earn')
                    : loyaltyTab === 'redeem'
                      ? t('Đổi điểm', 'Redeem')
                      : t('Điều chỉnh', 'Adjust')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* ===== Credit Payment Dialog =============== */}
      {/* ============================================ */}
      <Dialog open={creditDialogOpen} onOpenChange={(open) => { if (!open) setCreditDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <Wallet className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              {t('Thu nợ', 'Collect Payment')}
            </DialogTitle>
            <DialogDescription>
              {creditCustomer && (
                <>
                  {creditCustomer.name}
                  <br />
                  <span className="font-semibold text-foreground">
                    {t('Công nợ: ', 'Outstanding: ')}
                    {formatVND(creditCustomer.creditBalance)}
                  </span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="credit-amount">{t('Số tiền thanh toán (₫)', 'Payment Amount (₫)')}</Label>
              <div className="relative">
                <Input
                  id="credit-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(formatVNDInput(e.target.value))}
                  className="pr-16 text-lg font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  ₫
                </span>
              </div>
              {creditCustomer && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setCreditAmount(formatVNDInput(String(creditCustomer.creditBalance)))}
                >
                  {t('→ Thu toàn bộ ' + formatVND(creditCustomer.creditBalance), '→ Collect full ' + formatVND(creditCustomer.creditBalance))}
                </Button>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>{t('Phương thức', 'Payment Method')}</Label>
              <Select
                value={creditMethod}
                onValueChange={(v) => setCreditMethod(v as 'CASH' | 'BANK_TRANSFER')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      {t('Tiền mặt', 'Cash')}
                    </div>
                  </SelectItem>
                  <SelectItem value="BANK_TRANSFER">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-600" />
                      {t('Chuyển khoản', 'Bank Transfer')}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="credit-notes">{t('Ghi chú', 'Notes')}</Label>
              <Textarea
                id="credit-notes"
                placeholder={t('VD: Thu tiền hàng ngày 25/6', 'e.g. Collected payment for June 25th')}
                value={creditNotes}
                onChange={(e) => setCreditNotes(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Loyalty Preview */}
            {creditLoyaltyPreview > 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                  {t('Thưởng: ', 'Reward: ')}
                  <span className="font-bold">+{creditLoyaltyPreview} {t('điểm', 'points')}</span>
                  <span className="text-amber-600/70 dark:text-amber-500/70 font-normal text-xs ml-1">
                    ({t('1 điểm / 100.000₫', '1 point / 100K₫')})
                  </span>
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCreditDialogOpen(false)} disabled={creditSubmitting}>
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmitCredit}
              disabled={creditSubmitting || !parseVNDInput(creditAmount)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
            >
              {creditSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('Đang lưu...', 'Saving...')}
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4 mr-2" />
                  {t('Xác nhận thu', 'Confirm Payment')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}