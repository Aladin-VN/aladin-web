// ALADIN Credit Transaction Ledger API
// GET /api/credit/transactions — Paginated transaction ledger

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, canAccessShop } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { formatRunningBalance } from '@/lib/credit-engine';
import type { TransactionType } from '@/types';

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

    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId');
    const type = searchParams.get('type') as TransactionType | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (!shopId) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'shopId is required'),
        { status: 400 }
      );
    }

    // Verify access
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { userId: true },
    });
    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }
    if (!canAccessShop(payload.role, payload.userId, shop.userId)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Access denied'), { status: 403 });
    }

    // Build WHERE clause
    const where: Record<string, unknown> = { shopId };

    if (type) {
      where.type = type;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = endDate;
      }
    }

    // Parallel queries
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            select: { orderNumber: true },
          },
        },
      }),
      db.transaction.count({ where }),
    ]);

    // Build response with collector names where applicable
    const items = await Promise.all(
      transactions.map(async (t) => {
        let collectorName: string | null = null;
        if (t.collectedBy) {
          const collector = await db.user.findUnique({
            where: { id: t.collectedBy },
            select: { name: true },
          });
          collectorName = collector?.name || null;
        }

        return {
          id: t.id,
          type: t.type,
          amount: t.amount,
          runningBalance: t.runningBalance,
          formattedBalance: formatRunningBalance(t.runningBalance),
          paymentMethod: t.paymentMethod,
          description: t.description,
          orderNumber: t.order?.orderNumber || null,
          collectedByName: collectorName,
          createdAt: t.createdAt,
        };
      })
    );

    return NextResponse.json(
      successResponse({
        items,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    console.error('[CREDIT TRANSACTIONS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch transactions'),
      { status: 500 }
    );
  }
}
