'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Building2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { BrokerTierBadge } from '@/components/brokers/broker-tier-badge';

interface Territory {
  wardId: string;
  wardName: string;
  wardNameEn: string | null;
  district: string;
  shopCount: number;
  assignedBrokers: {
    brokerId: string;
    name: string;
    phone: string;
    tier: string;
    commissionRate: number;
    status: string;
    totalShopsReferred: number;
    totalGmvGenerated: number;
  }[];
  isCovered: boolean;
  brokerCount: number;
}

interface TerritorySummary {
  totalWards: number;
  coveredWards: number;
  uncoveredWards: number;
  coveragePercent: number;
  totalShops: number;
  coveredShops: number;
  uncoveredShops: number;
  shopCoveragePercent: number;
}

export default function BrokerTerritoriesPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [districts, setDistricts] = useState<{ district: string; wardCount: number }[]>([]);
  const [summary, setSummary] = useState<TerritorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState('all');

  const fetchTerritories = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (districtFilter !== 'all') params.set('district', districtFilter);

      const res = await adminFetch(`/api/brokers/territories?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setTerritories(json.data.territories || []);
        setDistricts(json.data.districts || []);
        setSummary(json.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch territories:', err);
    } finally {
      setLoading(false);
    }
  }, [districtFilter]);

  useEffect(() => { fetchTerritories(); }, [fetchTerritories]);

  const covered = territories.filter(t => t.isCovered);
  const uncovered = territories.filter(t => !t.isCovered);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Territory Coverage', 'Phủ sóng Khu vực')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Monitor ward coverage and broker territory assignments', 'Theo dõi phạm vi phủ sóng và phân công khu vực đại lý')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTerritories}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('Refresh', 'Làm mới')}
            </Button>
          </div>

          <Separator />

          {/* Coverage Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className={summary?.coveragePercent && summary.coveragePercent >= 80 ? 'border-yellow-100 bg-yellow-50/50' : summary?.coveragePercent && summary.coveragePercent >= 50 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Ward Coverage', 'Phủ sóng Phường')}</p>
                <p className="text-2xl font-bold mt-1">{summary?.coveragePercent || 0}%</p>
                <p className="text-[10px] text-muted-foreground">{summary?.coveredWards || 0}/{summary?.totalWards || 0} {t('wards covered', 'phường đã phủ')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Shop Coverage', 'Phủ sóng Cửa hàng')}</p>
                <p className="text-2xl font-bold mt-1 text-blue-700">{summary?.shopCoveragePercent || 0}%</p>
                <p className="text-[10px] text-muted-foreground">{summary?.coveredShops || 0}/{summary?.totalShops || 0} {t('shops', 'cửa hàng')}</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Uncovered Wards', 'Phường Chưa phủ')}</p>
                <p className="text-2xl font-bold mt-1 text-red-700">{summary?.uncoveredWards || 0}</p>
                <p className="text-[10px] text-muted-foreground">{summary?.uncoveredShops || 0} {t('shops unassigned', 'CH chưa phân công')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Total Districts', 'Tổng Quận')}</p>
                <p className="text-2xl font-bold mt-1">{districts.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Coverage Progress Bar */}
          {summary && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium">{t('Territory Coverage Progress', 'Tiến trình Phủ sóng')}</span>
                  <span className="text-xs font-bold">{summary.coveragePercent}%</span>
                </div>
                <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${summary.coveragePercent >= 80 ? 'bg-red-500' : summary.coveragePercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.max(2, summary.coveragePercent)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* District Filter */}
          <Card>
            <CardContent className="p-4">
              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger className="w-full sm:w-[220px] h-9">
                  <SelectValue placeholder={t('All Districts', 'Tất cả quận')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Districts', 'Tất cả quận')}</SelectItem>
                  {districts.map(d => (
                    <SelectItem key={d.district} value={d.district}>
                      {d.district} ({d.wardCount} {t('wards', 'phường')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Territory Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Covered Wards */}
              {covered.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-red-600" />
                    {t('Covered Wards', 'Phường Đã phủ')} ({covered.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {covered.map(ward => (
                      <Card key={ward.wardId} className="border-yellow-100">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-yellow-50 flex items-center justify-center">
                                <MapPin className="h-4 w-4 text-red-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{ward.wardName}</p>
                                <p className="text-[10px] text-muted-foreground">{ward.district}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-yellow-50 text-red-700 text-[10px]">
                              {ward.brokerCount} {t('broker(s)', 'đại lý')}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{ward.shopCount} {t('shops', 'CH')}</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            {ward.assignedBrokers.map(broker => (
                              <div key={broker.brokerId} className="flex items-center gap-2 p-1.5 rounded bg-muted/50 text-xs">
                                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                  <span className="text-[8px] font-bold text-blue-700">{broker.name.charAt(0)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{broker.name}</p>
                                  <div className="flex items-center gap-2">
                                    <BrokerTierBadge tier={broker.tier} locale={locale} />
                                    <span className="text-[10px] text-muted-foreground">
                                      {ward.shopCount} {t('CH')} · {(broker.commissionRate * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Uncovered Wards */}
              {uncovered.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    {t('Uncovered Wards', 'Phường Chưa phủ')} ({uncovered.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {uncovered.map(ward => (
                      <Card key={ward.wardId} className="border-red-200 bg-red-50/30">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{ward.wardName}</p>
                                <p className="text-[10px] text-muted-foreground">{ward.district}</p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px]">
                              {t('No broker', 'Chưa có ĐL')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            <span>{ward.shopCount} {t('shops — unassigned', 'cửa hàng — chưa phân công')}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {territories.length === 0 && !loading && (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <MapPin className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No territories found', 'Không có dữ liệu khu vực')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('Ward data will appear once the database has wards configured.', 'Dữ liệu phường sẽ hiển thị khi có phường trong cơ sở dữ liệu.')}
                  </p>
                </div>
              )}
            </div>
          )}
        </main>
      </SidebarInset>
    </div>
  );
}
