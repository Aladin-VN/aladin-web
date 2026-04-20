'use client';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { LoyaltyTierBadge, CreditStatusBadge, ShopTypeBadge, OrderStatusBadge, PaymentMethodBadge } from './shop-status-badge';
import { toast } from 'sonner';
import {
  Store,
  Phone,
  MapPin,
  Calendar,
  TrendingUp,
  ShoppingBag,
  DollarSign,
  Clock,
  User,
  CreditCard,
  Zap,
  BarChart3,
  Edit,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ShopDetail {
  id: string;
  name: string;
  nameEn: string | null;
  district: string | null;
  province: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  shopType: string;
  loyaltyTier: string;
  creditLimit: number;
  creditLimitFormatted: string;
  creditBalance: number;
  creditBalanceFormatted: string;
  creditAvailable: number;
  creditAvailableFormatted: string;
  creditStatus: string;
  totalOrders: number;
  totalGmv: number;
  totalGmvFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    phone: string;
    name: string;
    email: string | null;
    status: string;
    zaloId: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  } | null;
  ward: {
    id: string;
    name: string;
    nameEn: string | null;
    district: string;
    province: string;
    shopCount: number;
  } | null;
  recentOrdersList: {
    id: string;
    orderNumber: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    totalAmount: number;
    totalAmountFormatted: string;
    itemCount: number;
    createdAt: string;
    deliveredAt: string | null;
  }[];
  transactionHistory: {
    id: string;
    type: string;
    amount: number;
    amountFormatted: string;
    balanceAfter: number | null;
    balanceAfterFormatted: string | null;
    description: string | null;
    createdBy: string | null;
    createdAt: string;
  }[];
  stats: {
    totalOrderCount: number;
    totalGmv: number;
    totalGmvFormatted: string;
    avgOrderValue: number;
    avgOrderValueFormatted: string;
    pendingOrders: number;
    deliveredOrders: number;
    recentOrders30d: number;
    recentGmv30d: number;
    recentGmv30dFormatted: string;
  };
}

// ============================================
// Transaction Type Badge
// ============================================

const TX_TYPE_LABELS_VI: Record<string, string> = {
  CREDIT_USED: 'Da su dung',
  REPAYMENT: 'Tra no',
  CREDIT_LIMIT_INCREASE: 'Tang han muc',
  CREDIT_LIMIT_DECREASE: 'Giam han muc',
  ORDER_PAYMENT: 'TT don hang',
  REFUND: 'Hoan tien',
};

const TX_TYPE_LABELS_EN: Record<string, string> = {
  CREDIT_USED: 'Credit Used',
  REPAYMENT: 'Repayment',
  CREDIT_LIMIT_INCREASE: 'Limit Up',
  CREDIT_LIMIT_DECREASE: 'Limit Down',
  ORDER_PAYMENT: 'Order Payment',
  REFUND: 'Refund',
};

const TX_TYPE_COLORS: Record<string, string> = {
  CREDIT_USED: 'text-red-600',
  REPAYMENT: 'text-emerald-600',
  CREDIT_LIMIT_INCREASE: 'text-blue-600',
  CREDIT_LIMIT_DECREASE: 'text-orange-600',
  ORDER_PAYMENT: 'text-purple-600',
  REFUND: 'text-amber-600',
};

// ============================================
// Shop Detail Drawer Component
// ============================================

interface ShopDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shopId: string | null;
  locale: string;
  onShopUpdated?: () => void;
}

export function ShopDetailDrawer({
  open,
  onOpenChange,
  shopId,
  locale,
  onShopUpdated,
}: ShopDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchShop = useCallback(async () => {
    if (!shopId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/shops/${shopId}`);
      const json = await res.json();
      if (json.success) {
        setShop(json.data);
      } else {
        toast.error(t('Failed to load shop', 'Khong the tai thong tin cua hang'));
      }
    } catch (err) {
      console.error('Fetch shop detail error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setLoading(false);
    }
  }, [shopId, t]);

  useEffect(() => {
    if (open && shopId) {
      fetchShop();
      setActiveTab('overview');
    }
    if (!open) {
      setShop(null);
    }
  }, [open, shopId, fetchShop]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader className="pr-6">
          <SheetTitle className="flex items-center gap-2 text-base">
            {loading ? (
              <Skeleton className="h-5 w-48" />
            ) : shop ? (
              <>
                <Store className="h-4 w-4 text-emerald-600" />
                <span>{shop.name}</span>
                <LoyaltyTierBadge tier={shop.loyaltyTier} locale={locale} size="md" />
              </>
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {loading ? (
              <Skeleton className="h-4 w-32" />
            ) : shop ? (
              <span className="flex items-center gap-2">
                {shop.district && <span>{shop.district}, {shop.province}</span>}
                <ShopTypeBadge type={shop.shopType} locale={locale} />
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex-1 p-4 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : shop ? (
          <div className="flex-1 px-4 pb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="text-xs">
                  {t('Overview', 'Tong quan')}
                </TabsTrigger>
                <TabsTrigger value="orders" className="text-xs">
                  {t('Orders', 'Don hang')} ({shop.stats.pendingOrders > 0 ? `${shop.stats.pendingOrders}!` : shop.stats.totalOrderCount})
                </TabsTrigger>
                <TabsTrigger value="credit" className="text-xs">
                  {t('Credit', 'Cong no')}
                </TabsTrigger>
              </TabsList>

              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {t('Total Orders', 'Tong don hang')}
                      </span>
                    </div>
                    <p className="text-lg font-bold">{shop.stats.totalOrderCount}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('Pending', 'Cho XL')}: {shop.stats.pendingOrders} &middot; {t('Delivered', 'Da giao')}: {shop.stats.deliveredOrders}
                    </p>
                  </div>

                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {t('Total GMV', 'Tong GMV')}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-emerald-700">
                      <SensitiveValue value={shop.stats.totalGmv} maskType="amount" formatOptions={{ formatCurrency: true }} />
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('Avg', 'TB')}: <SensitiveValue value={shop.stats.avgOrderValue} maskType="amount" formatOptions={{ formatCurrency: true }} />
                    </p>
                  </div>

                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {t('Last 30 Days', '30 ngay qua')}
                      </span>
                    </div>
                    <p className="text-lg font-bold">{shop.stats.recentOrders30d} <span className="text-xs font-normal text-muted-foreground">{t('orders', 'don')}</span></p>
                    <p className="text-[10px] text-muted-foreground">
                      <SensitiveValue value={shop.stats.recentGmv30d} maskType="amount" formatOptions={{ formatCurrency: true }} />
                    </p>
                  </div>

                  <div className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground uppercase font-medium">
                        {t('Credit', 'Cong no')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CreditStatusBadge status={shop.creditStatus} locale={locale} />
                    </div>
                    <p className="text-[10px]">
                      <span className="text-muted-foreground">{t('Available', 'Con lai')}: </span>
                      <span className={`font-semibold ${shop.creditAvailable === 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        <SensitiveValue value={shop.creditAvailable} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </span>
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Shop Info */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Store className="h-4 w-4" />
                    {t('Shop Information', 'Thong tin cua hang')}
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{t('Owner', 'Chu cua hang')}</span>
                      </div>
                      <p className="text-sm font-medium pl-5.5">
                        <SensitiveValue value={shop.user?.name || '-'} maskType="name" />
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{t('Phone', 'Dien thoai')}</span>
                      </div>
                      <p className="text-sm font-medium pl-5.5">
                        <SensitiveValue value={shop.user?.phone || '-'} maskType="phone" />
                      </p>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{t('Address', 'Dia chi')}</span>
                      </div>
                      <p className="text-sm pl-5.5">
                        {shop.address || '-'}
                        {shop.district ? `, ${shop.district}` : ''}
                        {shop.province ? `, ${shop.province}` : ''}
                      </p>
                    </div>
                    {shop.ward && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted-foreground">{t('Ward', 'Phuong/Xa')}</span>
                        <p className="text-sm font-medium">{shop.ward.name}</p>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">{t('Zalo ID', 'Zalo ID')}</span>
                      <p className="text-sm font-medium font-mono">
                        {shop.user?.zaloId ? <SensitiveValue value={shop.user.zaloId} maskType="id" /> : '-'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">{t('Loyalty Tier', 'Cap thanh vien')}</span>
                      <div className="pl-0">
                        <LoyaltyTierBadge tier={shop.loyaltyTier} locale={locale} size="md" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">{t('Shop Type', 'Loai cua hang')}</span>
                      <div className="pl-0">
                        <ShopTypeBadge type={shop.shopType} locale={locale} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">{t('Joined', 'Ngay tham gia')}</span>
                      <p className="text-sm">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {new Date(shop.createdAt).toLocaleDateString('vi-VN', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })}
                      </p>
                    </div>
                    {shop.user?.lastLoginAt && (
                      <div className="space-y-1.5">
                        <span className="text-xs text-muted-foreground">{t('Last Login', 'Dang nhap gan nhat')}</span>
                        <p className="text-sm">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(shop.user.lastLoginAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* ORDERS TAB */}
              <TabsContent value="orders" className="space-y-4 mt-4">
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    {t('Recent Orders', 'Don hang gan day')}
                  </h4>
                  {shop.recentOrdersList.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('No orders yet', 'Chua co don hang nao')}
                    </p>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">{t('Order #', 'Ma DH')}</TableHead>
                            <TableHead className="text-xs">{t('Status', 'TT')}</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">{t('Payment', 'TT')}</TableHead>
                            <TableHead className="text-xs text-center hidden sm:table-cell">{t('Items', 'SP')}</TableHead>
                            <TableHead className="text-xs text-right">{t('Total', 'Tong')}</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">{t('Date', 'Ngay')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shop.recentOrdersList.map((order) => (
                            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                              <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                              <TableCell>
                                <OrderStatusBadge status={order.status} locale={locale} />
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <PaymentMethodBadge method={order.paymentMethod} locale={locale} />
                              </TableCell>
                              <TableCell className="text-center hidden sm:table-cell text-xs">{order.itemCount}</TableCell>
                              <TableCell className="text-right text-xs font-semibold">
                                <SensitiveValue value={order.totalAmount} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </TableCell>
                              <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                                {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                                  day: '2-digit', month: '2-digit',
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* CREDIT TAB */}
              <TabsContent value="credit" className="space-y-4 mt-4">
                {/* Credit Summary */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    {t('Credit Account', 'Tai khoan tin dung')}
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">{t('Limit', 'Han muc')}</p>
                      <p className="text-sm font-bold mt-1">
                        <SensitiveValue value={shop.creditLimit} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-red-50 dark:bg-red-950/20">
                      <p className="text-[10px] text-red-600 uppercase">{t('Used', 'Da dung')}</p>
                      <p className="text-sm font-bold mt-1 text-red-600">
                        <SensitiveValue value={shop.creditBalance} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20">
                      <p className="text-[10px] text-emerald-600 uppercase">{t('Available', 'Con lai')}</p>
                      <p className="text-sm font-bold mt-1 text-emerald-600">
                        <SensitiveValue value={shop.creditAvailable} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('Status', 'Trang thai')}</span>
                    <CreditStatusBadge status={shop.creditStatus} locale={locale} />
                  </div>
                  {shop.creditBalance > 0 && shop.creditStatus === 'ACTIVE' && (
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-2">
                      <Zap className="h-3.5 w-3.5" />
                      {t(
                        'Credit is being used. Payment due within 7 days of order.',
                        'Dang su dung cong no. Han tra trong 7 ngay ke tu khi dat don.'
                      )}
                    </div>
                  )}
                  {shop.creditStatus === 'OVERDUE' && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded p-2">
                      <span>&#9888;</span>
                      {t(
                        'Credit is overdue! Shop cannot place new orders until repayment.',
                        'Cong no qua han! Cua hang khong the dat don moi cho den khi tra no.'
                      )}
                    </div>
                  )}
                  {shop.creditStatus === 'LOCKED' && (
                    <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950/20 rounded p-2">
                      <span>&#128274;</span>
                      {t(
                        'Credit account is locked. Contact admin to resolve.',
                        'Tai khoan tin dung da bi khoa. Lien he quan tri de giai quyet.'
                      )}
                    </div>
                  )}
                </div>

                {/* Transaction History */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t('Transaction History', 'Lich su giao dich')}
                  </h4>
                  {shop.transactionHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t('No transactions yet', 'Chua co giao dich nao')}
                    </p>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">{t('Type', 'Loai')}</TableHead>
                            <TableHead className="text-xs text-right">{t('Amount', 'So tien')}</TableHead>
                            <TableHead className="text-xs text-right hidden sm:table-cell">{t('Balance', 'So du')}</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">{t('Date', 'Ngay')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {shop.transactionHistory.map((tx) => {
                            const isCredit = tx.type === 'REPAYMENT' || tx.type === 'CREDIT_LIMIT_INCREASE' || tx.type === 'REFUND';
                            return (
                              <TableRow key={tx.id}>
                                <TableCell>
                                  <span className={`text-xs font-medium ${TX_TYPE_COLORS[tx.type] || ''}`}>
                                    {locale === 'vi' ? (TX_TYPE_LABELS_VI[tx.type] || tx.type) : (TX_TYPE_LABELS_EN[tx.type] || tx.type)}
                                  </span>
                                  {tx.description && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px] truncate">
                                      {tx.description}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={`text-xs font-semibold ${isCredit ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {isCredit ? '+' : '-'}
                                    <SensitiveValue value={tx.amount} maskType="amount" formatOptions={{ formatCurrency: true }} />
                                  </span>
                                </TableCell>
                                <TableCell className="text-right hidden sm:table-cell">
                                  {tx.balanceAfter !== null ? (
                                    <span className="text-xs text-muted-foreground">
                                      <SensitiveValue value={tx.balanceAfter} maskType="amount" formatOptions={{ formatCurrency: true }} />
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleDateString('vi-VN', {
                                      day: '2-digit', month: '2-digit', year: 'numeric',
                                    })}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <p className="text-sm text-muted-foreground">{t('No shop selected', 'Chua chon cua hang')}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
