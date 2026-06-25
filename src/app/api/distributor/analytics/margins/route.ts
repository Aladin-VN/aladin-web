// GET /api/distributor/analytics/margins — GVM Margin Analytics for Distributors
// Provides per-product, category, customer, and trend margin analysis

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ---- Types ----

interface OrderRow {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  orderId: string;
  shopId: string;
  deliveredAt: Date | null;
  costPrice: number | null;
  categoryId: string;
  categoryName: string;
  shopName: string | null;
  shopDistrict: string | null;
}

interface PosRow {
  productId: string;
  productName: string;
  productSku: string | null;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  createdAt: Date;
  costPrice: number | null;
  categoryId: string;
  categoryName: string;
}

// ---- Helper: parse period into date range ----

function parseDateRange(fromParam: string | null, toParam: string | null, periodParam: string | null) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let daysBack = 30;
  if (periodParam === '7d') daysBack = 7;
  else if (periodParam === '90d') daysBack = 90;

  const periodStart = new Date(todayStart);
  periodStart.setDate(periodStart.getDate() - daysBack);

  const from = fromParam ? new Date(fromParam) : periodStart;
  const to = toParam
    ? new Date(toParam + 'T23:59:59.999')
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return { from, to };
}

// ---- Helper: safe percentage calculation ----

function safeMarginPct(profit: number, revenue: number): number {
  if (revenue <= 0) return 0;
  return Math.round((profit / revenue) * 10000) / 100; // 2 decimal places
}

// ---- Main Handler ----

export async function GET(request: NextRequest) {
  try {
    // --- Auth ---
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền nhà phân phối.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    // --- Parse query params ---
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const periodParam = searchParams.get('period');

    // Validate period if provided
    if (periodParam && !['7d', '30d', '90d'].includes(periodParam)) {
      return NextResponse.json(
        errorResponse('INVALID_PARAMS', 'period phải là 7d, 30d, hoặc 90d.'),
        { status: 400 },
      );
    }

    const { from, to } = parseDateRange(fromParam, toParam, periodParam);

    // --- Fetch all data in parallel ---
    // Query 1: Order items (delivered orders only) with cost prices and shop/category info
    // Query 2: POS sale items with cost prices and category info

    const [orderRows, posRows] = await Promise.all([
      // Delivered order items in the period
      db.$queryRaw<OrderRow[]>`
        SELECT
          oi."productId",
          oi."productName",
          oi."productSku",
          oi."unitPrice",
          oi."quantity",
          oi."totalPrice",
          o."id" AS "orderId",
          o."shopId",
          o."deliveredAt",
          di."costPrice",
          p."categoryId",
          c."name" AS "categoryName",
          s."name" AS "shopName",
          s."district" AS "shopDistrict"
        FROM "OrderItem" oi
        JOIN "Order" o ON oi."orderId" = o.id
        JOIN "Product" p ON oi."productId" = p.id
        JOIN "Category" c ON p."categoryId" = c.id
        LEFT JOIN "DistributorInventory" di
          ON di."distributorId" = o."distributorId" AND di."productId" = oi."productId"
        LEFT JOIN "Shop" s ON o."shopId" = s.id
        WHERE o."distributorId" = ${distId}
          AND o."status" = 'DELIVERED'
          AND o."deliveredAt" >= ${from}
          AND o."deliveredAt" <= ${to}
      `,

      // POS sale items in the period
      db.$queryRaw<PosRow[]>`
        SELECT
          psi."productId",
          psi."productName",
          psi."productSku",
          psi."unitPrice",
          psi."quantity",
          psi."totalPrice",
          psi."createdAt",
          di."costPrice",
          p."categoryId",
          c."name" AS "categoryName"
        FROM "PosSaleItem" psi
        JOIN "Product" p ON psi."productId" = p.id
        JOIN "Category" c ON p."categoryId" = c.id
        LEFT JOIN "DistributorInventory" di
          ON di."distributorId" = psi."distributorId" AND di."productId" = psi."productId"
        WHERE psi."distributorId" = ${distId}
          AND psi."createdAt" >= ${from}
          AND psi."createdAt" <= ${to}
      `,
    ]);

    // =================================================================
    // PROCESS ALL DATA IN MEMORY
    // =================================================================

    // --- Aggregate structures ---

    // Product aggregation
    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        productSku: string;
        totalQtySold: number;
        totalRevenue: number;
        totalCost: number;
        hasKnownCost: boolean;
        categoryId: string;
        categoryName: string;
      }
    >();

    // Category aggregation
    const categoryMap = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        totalRevenue: number;
        totalCost: number;
        productSet: Set<string>;
      }
    >();

    // Customer (shop) aggregation
    const customerMap = new Map<
      string,
      {
        shopId: string;
        shopName: string;
        shopDistrict: string | null;
        totalOrders: number;
        orderSet: Set<string>;
        totalRevenue: number;
        totalCost: number;
      }
    >();

    // Daily trend aggregation
    const trendMap = new Map<
      string,
      { date: string; revenue: number; cost: number }
    >();

    // Low margin candidates (products with known cost)
    const lowMarginCandidates = new Map<
      string,
      {
        productId: string;
        productName: string;
        productSku: string;
        totalRevenue: number;
        totalCost: number;
      }
    >();

    // Summary counters
    let summaryRevenue = 0;
    let summaryCost = 0;
    const deliveredOrderIds = new Set<string>();

    // --- Helper: process a single sale row (orders or POS) ---
    function processOrderRow(row: OrderRow) {
      const qty = Number(row.quantity) || 0;
      const revenue = Number(row.totalPrice) || 0;
      const unitCost = row.costPrice != null ? Number(row.costPrice) : null;
      const cost = unitCost != null ? unitCost * qty : 0;

      summaryRevenue += revenue;
      summaryCost += cost;

      if (row.orderId) deliveredOrderIds.add(row.orderId);

      // Date key for trend (from deliveredAt)
      const dateKey = row.deliveredAt
        ? new Date(row.deliveredAt).toISOString().slice(0, 10)
        : 'unknown';

      // Update trend
      const trend = trendMap.get(dateKey) || { date: dateKey, revenue: 0, cost: 0 };
      trend.revenue += revenue;
      trend.cost += cost;
      trendMap.set(dateKey, trend);

      // Update product
      const sku = row.productSku || '';
      const existing = productMap.get(row.productId) || {
        productId: row.productId,
        productName: row.productName,
        productSku: sku,
        totalQtySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        hasKnownCost: false,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
      };
      existing.totalQtySold += qty;
      existing.totalRevenue += revenue;
      existing.totalCost += cost;
      if (unitCost != null) existing.hasKnownCost = true;
      productMap.set(row.productId, existing);

      // Update category
      const cat = categoryMap.get(row.categoryId) || {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        totalRevenue: 0,
        totalCost: 0,
        productSet: new Set<string>(),
      };
      cat.totalRevenue += revenue;
      cat.totalCost += cost;
      cat.productSet.add(row.productId);
      categoryMap.set(row.categoryId, cat);

      // Update customer (shop)
      if (row.shopId) {
        const cust = customerMap.get(row.shopId) || {
          shopId: row.shopId,
          shopName: row.shopName || 'Không xác định',
          shopDistrict: row.shopDistrict,
          totalOrders: 0,
          orderSet: new Set<string>(),
          totalRevenue: 0,
          totalCost: 0,
        };
        cust.totalRevenue += revenue;
        cust.totalCost += cost;
        if (row.orderId) cust.orderSet.add(row.orderId);
        customerMap.set(row.shopId, cust);
      }

      // Track for low margin alerts (only if cost is known)
      if (unitCost != null) {
        const lm = lowMarginCandidates.get(row.productId) || {
          productId: row.productId,
          productName: row.productName,
          productSku: sku,
          totalRevenue: 0,
          totalCost: 0,
        };
        lm.totalRevenue += revenue;
        lm.totalCost += cost;
        lowMarginCandidates.set(row.productId, lm);
      }
    }

    function processPosRow(row: PosRow) {
      const qty = Number(row.quantity) || 0;
      const revenue = Number(row.totalPrice) || 0;
      const unitCost = row.costPrice != null ? Number(row.costPrice) : null;
      const cost = unitCost != null ? unitCost * qty : 0;

      summaryRevenue += revenue;
      summaryCost += cost;

      // Date key for trend (from createdAt)
      const dateKey = new Date(row.createdAt).toISOString().slice(0, 10);

      const trend = trendMap.get(dateKey) || { date: dateKey, revenue: 0, cost: 0 };
      trend.revenue += revenue;
      trend.cost += cost;
      trendMap.set(dateKey, trend);

      // Update product
      const sku = row.productSku || '';
      const existing = productMap.get(row.productId) || {
        productId: row.productId,
        productName: row.productName,
        productSku: sku,
        totalQtySold: 0,
        totalRevenue: 0,
        totalCost: 0,
        hasKnownCost: false,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
      };
      existing.totalQtySold += qty;
      existing.totalRevenue += revenue;
      existing.totalCost += cost;
      if (unitCost != null) existing.hasKnownCost = true;
      productMap.set(row.productId, existing);

      // Update category
      const cat = categoryMap.get(row.categoryId) || {
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        totalRevenue: 0,
        totalCost: 0,
        productSet: new Set<string>(),
      };
      cat.totalRevenue += revenue;
      cat.totalCost += cost;
      cat.productSet.add(row.productId);
      categoryMap.set(row.categoryId, cat);

      // Track for low margin alerts (only if cost is known)
      if (unitCost != null) {
        const lm = lowMarginCandidates.get(row.productId) || {
          productId: row.productId,
          productName: row.productName,
          productSku: sku,
          totalRevenue: 0,
          totalCost: 0,
        };
        lm.totalRevenue += revenue;
        lm.totalCost += cost;
        lowMarginCandidates.set(row.productId, lm);
      }
    }

    // Process all rows
    for (const row of orderRows) processOrderRow(row);
    for (const row of posRows) processPosRow(row);

    // =================================================================
    // 1. SUMMARY KPIs
    // =================================================================
    const grossProfit = summaryRevenue - summaryCost;
    const grossMarginPct = safeMarginPct(grossProfit, summaryRevenue);
    const totalOrdersDelivered = deliveredOrderIds.size;
    const avgOrderValue = totalOrdersDelivered > 0 ? Math.round(summaryRevenue / totalOrdersDelivered) : 0;

    const summary = {
      totalRevenue: summaryRevenue,
      totalCost: summaryCost,
      grossProfit,
      grossMarginPct,
      totalOrdersDelivered,
      avgOrderValue,
    };

    // =================================================================
    // 2. PRODUCT MARGINS (top 20 by revenue)
    // =================================================================
    const productMargins = Array.from(productMap.values())
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        productSku: p.productSku,
        totalQtySold: p.totalQtySold,
        totalRevenue: p.totalRevenue,
        totalCost: p.hasKnownCost ? p.totalCost : null,
        grossProfit: p.totalRevenue - p.totalCost,
        grossMarginPct: p.hasKnownCost
          ? safeMarginPct(p.totalRevenue - p.totalCost, p.totalRevenue)
          : null,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 20);

    // =================================================================
    // 3. CATEGORY MARGINS
    // =================================================================
    const categoryMargins = Array.from(categoryMap.values())
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        totalRevenue: c.totalRevenue,
        totalCost: c.totalCost,
        grossProfit: c.totalRevenue - c.totalCost,
        grossMarginPct: safeMarginPct(c.totalRevenue - c.totalCost, c.totalRevenue),
        productCount: c.productSet.size,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // =================================================================
    // 4. CUSTOMER PROFITABILITY (top 15 by grossProfit)
    // =================================================================
    const customerProfitability = Array.from(customerMap.values())
      .map((c) => {
        const totalOrders = c.orderSet.size;
        return {
          shopId: c.shopId,
          shopName: c.shopName,
          shopDistrict: c.shopDistrict || '',
          totalOrders,
          totalRevenue: c.totalRevenue,
          totalCost: c.totalCost,
          grossProfit: c.totalRevenue - c.totalCost,
          avgOrderValue: totalOrders > 0 ? Math.round(c.totalRevenue / totalOrders) : 0,
        };
      })
      .sort((a, b) => b.grossProfit - a.grossProfit)
      .slice(0, 15);

    // =================================================================
    // 5. MARGIN TREND (daily, sorted by date)
    // =================================================================
    const marginTrend = Array.from(trendMap.values())
      .filter((t) => t.date !== 'unknown')
      .map((t) => {
        const profit = t.revenue - t.cost;
        return {
          date: t.date,
          revenue: t.revenue,
          cost: t.cost,
          profit,
          marginPct: safeMarginPct(profit, t.revenue),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    // =================================================================
    // 6. LOW MARGIN ALERTS (< 5%)
    // =================================================================
    const lowMarginAlerts = Array.from(lowMarginCandidates.values())
      .filter((p) => p.totalRevenue > 0) // Only products that actually sold
      .map((p) => {
        const margin = safeMarginPct(p.totalRevenue - p.totalCost, p.totalRevenue);
        return {
          productId: p.productId,
          productName: p.productName,
          currentMarginPct: margin,
          suggestion:
            p.totalCost >= p.totalRevenue
              ? 'Đàm phán giá nhập' // Negotiate purchase price (negative or zero margin)
              : 'Tăng giá bán',     // Raise selling price (positive but thin margin)
        };
      })
      .filter((p) => p.currentMarginPct < 5)
      .sort((a, b) => a.currentMarginPct - b.currentMarginPct);

    // =================================================================
    // Response
    // =================================================================
    return NextResponse.json(
      successResponse({
        period: {
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
        },
        summary,
        productMargins,
        categoryMargins,
        customerProfitability,
        marginTrend,
        lowMarginAlerts,
      }),
    );
  } catch (error) {
    console.error('[DISTRIBUTOR MARGIN ANALYTICS ERROR]', error);

    // Handle known Prisma errors gracefully
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json(
        errorResponse('DB_ERROR', 'Lỗi truy vấn dữ liệu. Vui lòng thử lại.'),
        { status: 500 },
      );
    }

    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống. Vui lòng thử lại sau.'),
      { status: 500 },
    );
  }
}