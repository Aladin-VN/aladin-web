// ALADIN Shop Detail API
// Sprint 5A: Full shop detail with orders, credit history, stats

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// GET /api/shops/[id] — Shop detail with recent orders & transactions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;

    const shop = await db.shop.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: { id: true, phone: true, name: true, email: true, status: true, zaloId: true, lastLoginAt: true, createdAt: true },
        },
        ward: { select: { id: true, name: true, nameEn: true, district: true, province: true, shopCount: true } },
        orders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            paymentStatus: true,
            totalAmount: true,
            itemCount: true,
            createdAt: true,
            deliveredAt: true,
          },
        },
        transactions: {
          take: 15,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            description: true,
            createdBy: true,
            createdAt: true,
          },
        },
      },
    });

    if (!shop) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Shop not found'),
        { status: 404 }
      );
    }

    // Calculate summary stats
    const orderStats = await db.order.aggregate({
      where: { shopId: id, deletedAt: null },
      _count: true,
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    });

    const pendingOrders = await db.order.count({
      where: { shopId: id, deletedAt: null, status: 'PENDING' },
    });

    const deliveredOrders = await db.order.count({
      where: { shopId: id, deletedAt: null, status: 'DELIVERED' },
    });

    // Recent 30-day orders
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = await db.order.count({
      where: { shopId: id, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
    });

    const recentGmv = await db.order.aggregate({
      where: { shopId: id, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
      _sum: { totalAmount: true },
    });

    // Format the response
    const shopData = {
      id: shop.id,
      name: shop.name,
      nameEn: shop.nameEn,
      wardId: shop.wardId,
      district: shop.district,
      province: shop.province,
      address: shop.address,
      lat: shop.lat,
      lng: shop.lng,
      shopType: shop.shopType,
      loyaltyTier: shop.loyaltyTier,
      creditLimit: shop.creditLimit,
      creditLimitFormatted: formatVND(shop.creditLimit),
      creditBalance: shop.creditBalance,
      creditBalanceFormatted: formatVND(shop.creditBalance),
      creditAvailable: Math.max(0, shop.creditLimit - shop.creditBalance),
      creditAvailableFormatted: formatVND(Math.max(0, shop.creditLimit - shop.creditBalance)),
      creditStatus: shop.creditStatus,
      totalOrders: shop.totalOrders,
      totalGmv: shop.totalGmv,
      totalGmvFormatted: formatVND(shop.totalGmv),
      avgOrderValue: shop.avgOrderValue,
      avgOrderValueFormatted: formatVND(shop.avgOrderValue),
      createdAt: shop.createdAt,
      updatedAt: shop.updatedAt,

      // User info
      user: shop.user,

      // Ward info
      ward: shop.ward,

      // Recent orders with formatted amounts
      recentOrdersList: shop.orders.map((o) => ({
        ...o,
        totalAmountFormatted: formatVND(o.totalAmount),
      })),

      // Transaction history
      transactionHistory: shop.transactions.map((t) => ({
        ...t,
        amountFormatted: formatVND(t.amount),
        balanceAfterFormatted: t.balanceAfter ? formatVND(t.balanceAfter) : null,
      })),

      // Calculated stats
      stats: {
        totalOrderCount: orderStats._count,
        totalGmv: orderStats._sum.totalAmount || 0,
        totalGmvFormatted: formatVND(orderStats._sum.totalAmount || 0),
        avgOrderValue: orderStats._avg.totalAmount ? Math.round(orderStats._avg.totalAmount) : 0,
        avgOrderValueFormatted: formatVND(orderStats._avg.totalAmount ? Math.round(orderStats._avg.totalAmount) : 0),
        pendingOrders,
        deliveredOrders,
        recentOrders30d: recentOrders,
        recentGmv30d: recentGmv._sum.totalAmount || 0,
        recentGmv30dFormatted: formatVND(recentGmv._sum.totalAmount || 0),
      },
    };

    return NextResponse.json(successResponse(shopData));
  } catch (error) {
    console.error('[SHOP DETAIL ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shop details'),
      { status: 500 }
    );
  }
}

// PATCH /api/shops/[id] — Update shop details (name, loyalty tier, credit limit, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      nameEn,
      address,
      district,
      province,
      lat,
      lng,
      shopType,
      loyaltyTier,
      creditLimit,
      creditStatus,
    } = body;

    // Validate shop exists
    const existing = await db.shop.findUnique({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Shop not found'),
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Shop name must be at least 2 characters'),
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (nameEn !== undefined) updateData.nameEn = nameEn || null;
    if (address !== undefined) updateData.address = address || null;
    if (district !== undefined) updateData.district = district || null;
    if (province !== undefined) updateData.province = province || null;
    if (lat !== undefined) updateData.lat = lat || null;
    if (lng !== undefined) updateData.lng = lng || null;

    if (shopType !== undefined) {
      const validTypes = ['TAPHOA', 'CONVENIENCE', 'FACTORY'];
      if (!validTypes.includes(shopType)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', `Invalid shop type. Must be: ${validTypes.join(', ')}`),
          { status: 400 }
        );
      }
      updateData.shopType = shopType;
    }

    if (loyaltyTier !== undefined) {
      const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
      if (!validTiers.includes(loyaltyTier)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', `Invalid loyalty tier. Must be: ${validTiers.join(', ')}`),
          { status: 400 }
        );
      }
      updateData.loyaltyTier = loyaltyTier;
    }

    if (creditLimit !== undefined) {
      const limit = parseInt(creditLimit);
      if (isNaN(limit) || limit < 0) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Credit limit must be a non-negative number'),
          { status: 400 }
        );
      }
      if (limit > 50000000) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Credit limit cannot exceed 50,000,000 VND'),
          { status: 400 }
        );
      }
      // If lowering limit below current balance, block it
      if (limit < existing.creditBalance) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Cannot set credit limit below current used balance'),
          { status: 400 }
        );
      }
      updateData.creditLimit = limit;
    }

    if (creditStatus !== undefined) {
      const validStatuses = ['ACTIVE', 'LOCKED', 'OVERDUE'];
      if (!validStatuses.includes(creditStatus)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', `Invalid credit status. Must be: ${validStatuses.join(', ')}`),
          { status: 400 }
        );
      }
      updateData.creditStatus = creditStatus;
    }

    const updated = await db.shop.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(successResponse({
      id: updated.id,
      name: updated.name,
      loyaltyTier: updated.loyaltyTier,
      creditLimit: updated.creditLimit,
      creditLimitFormatted: formatVND(updated.creditLimit),
      creditStatus: updated.creditStatus,
      updatedAt: updated.updatedAt,
    }));
  } catch (error) {
    console.error('[SHOP UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update shop'),
      { status: 500 }
    );
  }
}
