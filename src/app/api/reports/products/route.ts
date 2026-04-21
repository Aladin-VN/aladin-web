import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// ============================================
// Products Analytics API
// Top sellers, category performance, stock alerts
// ============================================

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const now = new Date();
  let start: Date;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 86400000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 86400000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 86400000);
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    default:
      start = new Date(now.getTime() - 30 * 86400000);
  }

  return { start, end: now };
}

export async function GET(request: NextRequest) {
  try {
    const { start, end } = getDateRange(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    // ---- Order items in period ----
    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          status: { notIn: ['CANCELLED', 'REFUNDED'] },
        },
      },
      select: {
        productId: true,
        productName: true,
        productSku: true,
        quantity: true,
        unitPrice: true,
        totalPrice: true,
        product: {
          select: {
            id: true, name: true, sku: true, basePrice: true, stockQuantity: true,
            category: { select: { id: true, name: true } },
            manufacturer: { select: { id: true, name: true } },
            brand: true, unit: true, isActive: true, isPrivateLabel: true,
          },
        },
      },
    });

    // ---- Product KPIs ----
    const uniqueProducts = new Set(orderItems.map(oi => oi.productId));
    const totalItemsSold = orderItems.reduce((s, oi) => s + oi.quantity, 0);
    const totalRevenue = orderItems.reduce((s, oi) => s + oi.totalPrice, 0);
    const avgUnitPrice = totalItemsSold > 0 ? Math.round(totalRevenue / totalItemsSold) : 0;

    // ---- Top Selling Products ----
    const productSales: Record<string, {
      productId: string; name: string; sku: string; revenue: number; qty: number;
      category: string; brand: string; manufacturer: string; inStock: boolean;
    }> = {};
    orderItems.forEach(oi => {
      const p = oi.product;
      if (!productSales[oi.productId]) {
        productSales[oi.productId] = {
          productId: oi.productId,
          name: oi.productName || p?.name || 'Unknown',
          sku: oi.productSku || p?.sku || '',
          revenue: 0,
          qty: 0,
          category: p?.category?.name || 'Other',
          brand: p?.brand || '',
          manufacturer: p?.manufacturer?.name || '',
          inStock: (p?.stockQuantity || 0) > 0,
        };
      }
      productSales[oi.productId].revenue += oi.totalPrice;
      productSales[oi.productId].qty += oi.quantity;
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)
      .map(p => ({ ...p, revenueFormatted: formatVND(p.revenue) }));

    const topByQty = Object.values(productSales)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
      .map(p => ({ ...p, revenueFormatted: formatVND(p.revenue) }));

    // ---- Category Performance ----
    const categoryPerf: Record<string, { revenue: number; qty: number; orders: number; productCount: number }> = {};
    orderItems.forEach(oi => {
      const cat = oi.product?.category?.name || 'Other';
      if (!categoryPerf[cat]) categoryPerf[cat] = { revenue: 0, qty: 0, orders: 0, productCount: 0 };
      categoryPerf[cat].revenue += oi.totalPrice;
      categoryPerf[cat].qty += oi.quantity;
      categoryPerf[cat].orders++;
      if (!categoryPerf[cat].productCount || !orderItems.slice(0, orderItems.indexOf(oi)).some(prev => prev.product?.category?.name === cat)) {
        categoryPerf[cat].productCount++;
      }
    });

    // Count unique products per category properly
    const catProducts: Record<string, Set<string>> = {};
    orderItems.forEach(oi => {
      const cat = oi.product?.category?.name || 'Other';
      if (!catProducts[cat]) catProducts[cat] = new Set();
      catProducts[cat].add(oi.productId);
    });
    Object.keys(categoryPerf).forEach(cat => {
      categoryPerf[cat].productCount = catProducts[cat]?.size || 0;
    });

    const topCategories = Object.entries(categoryPerf)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 15)
      .map(([name, data]) => ({
        name,
        ...data,
        revenueFormatted: formatVND(data.revenue),
        percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
      }));

    // ---- Brand Performance ----
    const brandPerf: Record<string, { revenue: number; qty: number }> = {};
    orderItems.forEach(oi => {
      const brand = oi.product?.brand || 'No Brand';
      if (!brandPerf[brand]) brandPerf[brand] = { revenue: 0, qty: 0 };
      brandPerf[brand].revenue += oi.totalPrice;
      brandPerf[brand].qty += oi.quantity;
    });
    const topBrands = Object.entries(brandPerf)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data, revenueFormatted: formatVND(data.revenue), percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0 }));

    // ---- Manufacturer Performance ----
    const mfgPerf: Record<string, { revenue: number; qty: number }> = {};
    orderItems.forEach(oi => {
      const mfg = oi.product?.manufacturer?.name || 'No Manufacturer';
      if (!mfgPerf[mfg]) mfgPerf[mfg] = { revenue: 0, qty: 0 };
      mfgPerf[mfg].revenue += oi.totalPrice;
      mfgPerf[mfg].qty += oi.quantity;
    });
    const topManufacturers = Object.entries(mfgPerf)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data, revenueFormatted: formatVND(data.revenue), percentage: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0 }));

    // ---- Stock Alerts ----
    const lowStockProducts = await db.product.findMany({
      where: { isActive: true, stockQuantity: { gt: 0, lte: 10 } },
      select: { id: true, name: true, sku: true, basePrice: true, stockQuantity: true, unit: true },
      orderBy: { stockQuantity: 'asc' },
      take: 15,
    });

    const outOfStockProducts = await db.product.findMany({
      where: { isActive: true, stockQuantity: 0 },
      select: { id: true, name: true, sku: true, basePrice: true, unit: true },
      orderBy: { updatedAt: 'desc' },
      take: 15,
    });

    // ---- Product Catalog Stats ----
    const catalogStats = await db.product.aggregate({
      _count: { id: true },
      _sum: { basePrice: true, stockQuantity: true },
    });
    const activeCount = await db.product.count({ where: { isActive: true } });
    const privateLabelCount = await db.product.count({ where: { isPrivateLabel: true } });
    const categoryCount = await db.category.count({ where: { isActive: true } });

    // ---- Private Label vs Regular ----
    const plItems = orderItems.filter(oi => oi.product?.isPrivateLabel);
    const plRevenue = plItems.reduce((s, oi) => s + oi.totalPrice, 0);
    const regularRevenue = totalRevenue - plRevenue;

    return NextResponse.json(successResponse({
      period,
      kpis: {
        totalProducts: catalogStats._count.id,
        activeProducts: activeCount,
        categories: categoryCount,
        uniqueProductsSold: uniqueProducts.size,
        totalItemsSold,
        totalRevenue,
        totalRevenueFormatted: formatVND(totalRevenue),
        avgUnitPrice,
        avgUnitPriceFormatted: formatVND(avgUnitPrice),
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        privateLabelCount,
        privateLabelRevenue: plRevenue,
        privateLabelRevenueFormatted: formatVND(plRevenue),
        privateLabelPercentage: totalRevenue > 0 ? Math.round((plRevenue / totalRevenue) * 1000) / 10 : 0,
        regularRevenue,
        regularRevenueFormatted: formatVND(regularRevenue),
        avgStock: Math.round((catalogStats._sum.stockQuantity || 0) / (activeCount || 1)),
      },
      rankings: {
        topProducts,
        topByQty,
        topCategories,
        topBrands,
        topManufacturers,
      },
      stockAlerts: {
        lowStock: lowStockProducts.map(p => ({ ...p, basePriceFormatted: formatVND(p.basePrice) })),
        outOfStock: outOfStockProducts.map(p => ({ ...p, basePriceFormatted: formatVND(p.basePrice) })),
      },
    }));
  } catch (error: any) {
    console.error('Products report error:', error);
    return NextResponse.json(errorResponse('REPORTS_ERROR', error.message || 'Failed to generate products report'), { status: 500 });
  }
}
