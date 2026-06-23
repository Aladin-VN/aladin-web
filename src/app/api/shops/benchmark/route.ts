// ALADIN Shop Benchmark API
// GET /api/shops/benchmark — Compare shop metrics to platform/district averages

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }
    if (!hasRole(payload.role, ['SHOP_OWNER'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Shop owner access required'), { status: 403 });
    }

    const shopId = payload.shopId;
    if (!shopId) {
      return NextResponse.json(errorResponse('NO_SHOP', 'Tài khoản chưa liên kết cửa hàng'), { status: 400 });
    }

    const shop = await db.shop.findUnique({
      where: { id: shopId, deletedAt: null },
    });
    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ============================================
    // 1. Avg order value vs platform average
    // ============================================
    const myAvgOrderValue = shop.avgOrderValue || 0;

    const platformAvgOrder = await db.order.aggregate({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
      _avg: { totalAmount: true },
    });
    const platformAvgOrderValue = platformAvgOrder._avg.totalAmount ? Math.round(platformAvgOrder._avg.totalAmount) : 0;

    // ============================================
    // 2. Order frequency vs district average
    // ============================================
    const myRecentOrders = await db.order.count({
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
    });
    const myOrderFrequency = Math.round((myRecentOrders / 30) * 7 * 10) / 10; // orders/week

    // District shops' order frequency
    const districtShops = shop.district
      ? await db.shop.findMany({
          where: { district: shop.district, deletedAt: null, id: { not: shopId } },
          select: { id: true },
        })
      : [];

    let districtAvgFrequency = 0;
    if (districtShops.length > 0) {
      const districtShopIds = districtShops.map((s) => s.id);
      const districtOrderCounts = await db.order.groupBy({
        by: ['shopId'],
        where: {
          shopId: { in: districtShopIds },
          createdAt: { gte: thirtyDaysAgo },
          status: { not: 'CANCELLED' },
        },
        _count: true,
      });

      const totalDistrictOrders = districtOrderCounts.reduce((sum, d) => sum + d._count, 0);
      districtAvgFrequency = Math.round((totalDistrictOrders / (districtShops.length * 30)) * 7 * 10) / 10;
    }

    // ============================================
    // 3. Credit utilization vs average
    // ============================================
    const myCreditUtilization = shop.creditLimit > 0 ? Math.round((shop.creditBalance / shop.creditLimit) * 100) : 0;

    const allShopCredit = await db.shop.aggregate({
      where: { deletedAt: null, creditLimit: { gt: 0 } },
      _avg: { creditBalance: true, creditLimit: true },
    });
    const avgCreditUtilization =
      allShopCredit._avg.creditLimit && allShopCredit._avg.creditLimit > 0
        ? Math.round(((allShopCredit._avg.creditBalance || 0) / allShopCredit._avg.creditLimit) * 100)
        : 0;

    // ============================================
    // 4. Product diversity (unique products ordered)
    // ============================================
    const myUniqueProducts = await db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { shopId },
      },
    }).then((r) => r.length);

    // Platform average unique products
    const allShops = await db.shop.findMany({
      where: { deletedAt: null, totalOrders: { gt: 0 } },
      select: { id: true },
    });
    const platformUniqueProductsList = await Promise.all(
      allShops.slice(0, 100).map(async (s) => {
        const count = await db.orderItem.groupBy({
          by: ['productId'],
          where: { order: { shopId: s.id } },
        }).then((r) => r.length);
        return count;
      })
    );
    const platformAvgUniqueProducts = platformUniqueProductsList.length > 0
      ? Math.round(platformUniqueProductsList.reduce((a, b) => a + b, 0) / platformUniqueProductsList.length)
      : 0;

    // ============================================
    // 5. Total spend rank in district/province
    // ============================================
    const myTotalSpend = shop.totalGmv;

    // Get all shops in province sorted by totalGmv
    const provinceShops = await db.shop.findMany({
      where: {
        province: shop.province,
        deletedAt: null,
        totalGmv: { gt: 0 },
      },
      select: { id: true, totalGmv: true },
      orderBy: { totalGmv: 'desc' },
    });

    const rankInProvince = provinceShops.findIndex((s) => s.id === shopId) + 1;
    const totalInProvince = provinceShops.length;
    const percentileProvince = totalInProvince > 0
      ? Math.round(((totalInProvince - rankInProvince) / totalInProvince) * 100)
      : 0;

    // District rank
    let rankInDistrict = 0;
    let totalInDistrict = 0;
    let percentileDistrict = 0;

    if (shop.district) {
      const districtShopList = provinceShops.filter((s) => {
        // We need to check district on each — fetch from original query scope
        return true; // Will filter below
      });
      // Better: re-query district shops with totalGmv
      const districtShopRanks = await db.shop.findMany({
        where: {
          district: shop.district,
          deletedAt: null,
          totalGmv: { gt: 0 },
        },
        select: { id: true, totalGmv: true },
        orderBy: { totalGmv: 'desc' },
      });

      rankInDistrict = districtShopRanks.findIndex((s) => s.id === shopId) + 1;
      totalInDistrict = districtShopRanks.length;
      percentileDistrict = totalInDistrict > 0
        ? Math.round(((totalInDistrict - rankInDistrict) / totalInDistrict) * 100)
        : 0;
    }

    // ============================================
    // Build benchmark results
    // ============================================
    const benchmarks = [
      {
        metric: 'avg_order_value',
        metricVi: 'Giá trị trung bình đơn hàng',
        metricEn: 'Avg Order Value',
        myValue: myAvgOrderValue,
        myValueFormatted: formatVND(myAvgOrderValue),
        avgValue: platformAvgOrderValue,
        avgValueFormatted: formatVND(platformAvgOrderValue),
        districtAvg: null as number | null,
        districtAvgFormatted: null as string | null,
        rank: null as number | null,
        totalInGroup: null as number | null,
        percentile: platformAvgOrderValue > 0
          ? Math.round(((myAvgOrderValue - platformAvgOrderValue) / platformAvgOrderValue) * 100)
          : 0,
        isHigher: myAvgOrderValue >= platformAvgOrderValue,
      },
      {
        metric: 'order_frequency',
        metricVi: 'Tần suất đặt hàng',
        metricEn: 'Order Frequency',
        myValue: myOrderFrequency,
        myValueFormatted: `${myOrderFrequency}/tuần`,
        avgValue: districtAvgFrequency || myOrderFrequency,
        avgValueFormatted: `${districtAvgFrequency || myOrderFrequency}/tuần`,
        districtAvg: districtAvgFrequency,
        districtAvgFormatted: districtAvgFrequency > 0 ? `${districtAvgFrequency}/tuần` : null,
        rank: null as number | null,
        totalInGroup: null as number | null,
        percentile: 0,
        isHigher: myOrderFrequency >= (districtAvgFrequency || 0),
      },
      {
        metric: 'credit_utilization',
        metricVi: 'Sử dụng công nợ',
        metricEn: 'Credit Utilization',
        myValue: myCreditUtilization,
        myValueFormatted: `${myCreditUtilization}%`,
        avgValue: avgCreditUtilization,
        avgValueFormatted: `${avgCreditUtilization}%`,
        districtAvg: null as number | null,
        districtAvgFormatted: null as string | null,
        rank: null as number | null,
        totalInGroup: null as number | null,
        percentile: 0,
        isHigher: myCreditUtilization > avgCreditUtilization,
        isLowerBetter: true, // Lower credit utilization is better
      },
      {
        metric: 'product_diversity',
        metricVi: 'Đa dạng sản phẩm',
        metricEn: 'Product Diversity',
        myValue: myUniqueProducts,
        myValueFormatted: `${myUniqueProducts} SP`,
        avgValue: platformAvgUniqueProducts,
        avgValueFormatted: `${platformAvgUniqueProducts} SP`,
        districtAvg: null as number | null,
        districtAvgFormatted: null as string | null,
        rank: null as number | null,
        totalInGroup: null as number | null,
        percentile: platformAvgUniqueProducts > 0
          ? Math.round(((myUniqueProducts - platformAvgUniqueProducts) / platformAvgUniqueProducts) * 100)
          : 0,
        isHigher: myUniqueProducts >= platformAvgUniqueProducts,
      },
      {
        metric: 'total_spend_rank',
        metricVi: 'Xếp hạng chi tiêu',
        metricEn: 'Total Spend Rank',
        myValue: rankInDistrict || rankInProvince,
        myValueFormatted: `#${rankInDistrict || rankInProvince}`,
        avgValue: totalInDistrict || totalInProvince,
        avgValueFormatted: `/ ${totalInDistrict || totalInProvince}`,
        districtAvg: null as number | null,
        districtAvgFormatted: null as string | null,
        rank: rankInDistrict || rankInProvince,
        totalInGroup: totalInDistrict || totalInProvince,
        percentile: percentileDistrict || percentileProvince,
        isHigher: (percentileDistrict || percentileProvince) >= 50,
      },
    ];

    // ============================================
    // Generate summary insight
    // ============================================
    const strengths: string[] = [];
    const improvements: string[] = [];

    if (myAvgOrderValue >= platformAvgOrderValue) {
      strengths.push('Giá trị đơn hàng cao hơn trung bình nền tảng');
    } else {
      improvements.push('Cố gắng tăng giá trị đơn hàng bằng cách đặt thêm sản phẩm');
    }

    if (myOrderFrequency >= (districtAvgFrequency || 0)) {
      strengths.push('Tần suất đặt hàng tốt trong khu vực');
    } else {
      improvements.push('Tăng tần suất đặt hàng để nhận ưu đãi tốt hơn');
    }

    if (myCreditUtilization <= avgCreditUtilization) {
      strengths.push('Quản lý công nợ tốt, thấp hơn trung bình');
    }

    if (myUniqueProducts >= platformAvgUniqueProducts) {
      strengths.push('Đa dạng sản phẩm đặt hàng rộng');
    } else {
      improvements.push('Thử đặt thêm các loại sản phẩm mới');
    }

    if ((percentileDistrict || percentileProvince) >= 70) {
      strengths.push(`Top 30% cửa hàng chi tiêu cao nhất ${shop.district ? 'quận/huyện' : 'tỉnh/thành'}`);
    }

    const summary = {
      strengths,
      improvements,
      overallMessage: strengths.length >= improvements.length
        ? 'Hiệu quả kinh doanh của bạn tốt so với mặt bằng chung!'
        : 'Có cơ hội cải thiện để nâng cao hiệu quả kinh doanh.',
    };

    return NextResponse.json(successResponse({
      benchmarks,
      summary,
    }));
  } catch (error) {
    console.error('[SHOP BENCHMARK ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch benchmark data'),
      { status: 500 }
    );
  }
}