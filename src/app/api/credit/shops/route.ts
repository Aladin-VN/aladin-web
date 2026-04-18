// ALADIN Shop Credit Overview API
// GET /api/credit/shops — All shops with credit info, sorted by exposure

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { calculateAvailableCredit, getDaysUntilDue } from '@/lib/credit-engine';
import type { CreditStatus } from '@/types';

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

    // Only admins and sales reps can see all shops' credit info
    if (!hasRole(payload.role, ['ADMIN', 'SALES_REP'])) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Admin or Sales Rep access required'),
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const statusFilter = searchParams.get('status') as CreditStatus | null;

    // Build WHERE clause
    const where: Record<string, unknown> = {};
    if (statusFilter) {
      where.creditStatus = statusFilter;
    }

    // Count for pagination
    const total = await db.shop.count({ where });

    // Get shops sorted by creditBalance desc (highest exposure first)
    const shops = await db.shop.findMany({
      where,
      orderBy: { creditBalance: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        district: true,
        province: true,
        creditLimit: true,
        creditBalance: true,
        creditStatus: true,
        loyaltyTier: true,
        totalOrders: true,
        createdAt: true,
      },
    });

    // Get last transaction date for each shop and days until due
    const shopCreditData = await Promise.all(
      shops.map(async (shop) => {
        const available = calculateAvailableCredit(shop);
        const daysUntilDue = shop.creditBalance > 0
          ? await getDaysUntilDue(shop.id)
          : null;

        // Get last transaction date
        const lastTransaction = await db.transaction.findFirst({
          where: { shopId: shop.id },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        return {
          shopId: shop.id,
          shopName: shop.name,
          district: shop.district,
          province: shop.province,
          creditLimit: shop.creditLimit,
          creditUsed: shop.creditBalance,
          creditAvailable: available,
          creditStatus: shop.creditStatus,
          utilizationPercent: shop.creditLimit > 0
            ? Math.round((shop.creditBalance / shop.creditLimit) * 100)
            : 0,
          daysUntilDue,
          lastTransactionDate: lastTransaction?.createdAt || null,
          totalOrders: shop.totalOrders,
          loyaltyTier: shop.loyaltyTier,
        };
      })
    );

    return NextResponse.json(
      successResponse({
        items: shopCreditData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    console.error('[CREDIT SHOPS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shop credit data'),
      { status: 500 }
    );
  }
}
