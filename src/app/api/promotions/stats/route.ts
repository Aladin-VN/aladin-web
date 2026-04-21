// ALADIN Promotions Stats API — Aggregate statistics
// Sprint 5C: Promotions & Trade Marketing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
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

    const now = new Date();

    // Parallel aggregation queries
    const [
      totalPromotions,
      activePromotions,
      upcomingPromotions,
      expiredPromotions,
      allPromotions,
      typeDistribution,
      topByRedemptions,
      budgetSummary,
    ] = await Promise.all([
      // Total promotions
      db.promotion.count(),

      // Active promotions
      db.promotion.count({
        where: { isActive: true, startsAt: { lte: now }, expiresAt: { gte: now } },
      }),

      // Upcoming promotions
      db.promotion.count({
        where: { isActive: true, startsAt: { gt: now } },
      }),

      // Expired promotions
      db.promotion.count({
        where: { expiresAt: { lt: now } },
      }),

      // All promotions for aggregated stats
      db.promotion.findMany({
        select: {
          promoType: true,
          usedBudget: true,
          totalBudget: true,
          totalRedemptions: true,
        },
      }),

      // Distribution by type
      db.promotion.groupBy({
        by: ['promoType'],
        _count: true,
      }),

      // Top promotions by redemptions
      db.promotion.findMany({
        where: { totalRedemptions: { gt: 0 } },
        orderBy: { totalRedemptions: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          promoType: true,
          totalRedemptions: true,
          usedBudget: true,
          manufacturer: { select: { name: true } },
        },
      }),

      // Budget summary
      db.promotion.aggregate({
        _sum: { totalBudget: true, usedBudget: true, totalRedemptions: true },
      }),
    ]);

    // Compute type distribution
    const typeMap: Record<string, { count: number; label: string; labelVi: string }> = {
      BUY_X_GET_Y: { count: 0, label: 'Buy X Get Y', labelVi: 'Mua X Tang Y' },
      PERCENT_OFF: { count: 0, label: 'Percentage Off', labelVi: 'Giam theo %' },
      FIXED_DISCOUNT: { count: 0, label: 'Fixed Discount', labelVi: 'Giam co dinh' },
    };
    typeDistribution.forEach((item) => {
      if (typeMap[item.promoType]) {
        typeMap[item.promoType].count = item._count;
      }
    });

    return NextResponse.json(successResponse({
      totalPromotions,
      activePromotions,
      upcomingPromotions,
      expiredPromotions,
      typeDistribution: typeMap,
      topByRedemptions,
      budgetSummary: {
        totalBudget: budgetSummary._sum.totalBudget || 0,
        totalBudgetFormatted: formatVND(budgetSummary._sum.totalBudget || 0),
        totalUsedBudget: budgetSummary._sum.usedBudget || 0,
        totalUsedBudgetFormatted: formatVND(budgetSummary._sum.usedBudget || 0),
        budgetUtilizationPercent: budgetSummary._sum.totalBudget
          ? Math.round(((budgetSummary._sum.usedBudget || 0) / budgetSummary._sum.totalBudget) * 100)
          : 0,
        totalRedemptions: budgetSummary._sum.totalRedemptions || 0,
      },
    }));
  } catch (error) {
    console.error('[PROMOTIONS STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch promotion stats'),
      { status: 500 }
    );
  }
}
