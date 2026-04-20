// ALADIN Group Deals Stats API — Aggregate statistics
// Sprint 5D: Group Buy Engine (Mua Chung)

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

export async function GET() {
  try {
    const [
      totalDeals,
      activeDeals,
      completedDeals,
      expiredDeals,
      cancelledDeals,
      totalSavingsAgg,
      uniqueParticipants,
      allDealsForAvg,
      topDeals,
      wardDistribution,
    ] = await Promise.all([
      // Total deals
      db.groupDeal.count(),

      // Active deals
      db.groupDeal.count({ where: { status: 'ACTIVE' } }),

      // Completed deals
      db.groupDeal.count({ where: { status: 'COMPLETED' } }),

      // Expired deals
      db.groupDeal.count({ where: { status: 'EXPIRED' } }),

      // Cancelled deals
      db.groupDeal.count({ where: { status: 'CANCELLED' } }),

      // Total savings for completed deals
      db.groupDeal.aggregate({
        _sum: { currentQty: true },
        where: { status: 'COMPLETED' },
      }),

      // Unique participants across all active deals
      db.groupDealParticipant.groupBy({
        by: ['shopId'],
        where: {
          isActive: true,
          groupDeal: { status: 'ACTIVE' },
        },
      }),

      // All deals for avg completion rate
      db.groupDeal.findMany({
        select: { targetQty: true, currentQty: true, status: true },
      }),

      // Top deals by participation
      db.groupDeal.findMany({
        orderBy: { currentQty: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          targetQty: true,
          currentQty: true,
          originalPrice: true,
          discountPrice: true,
          status: true,
          _count: { select: { participants: true } },
          product: { select: { name: true, sku: true } },
        },
      }),

      // Ward distribution
      db.groupDeal.groupBy({
        by: ['wardId'],
        where: { wardId: { not: null } },
        _count: true,
      }),
    ]);

    // Compute total savings: (originalPrice - discountPrice) * currentQty for completed deals
    const completedDealsForSavings = await db.groupDeal.findMany({
      where: { status: 'COMPLETED' },
      select: { originalPrice: true, discountPrice: true, currentQty: true },
    });
    const totalSavings = completedDealsForSavings.reduce(
      (sum, d) => sum + (d.originalPrice - d.discountPrice) * d.currentQty,
      0
    );

    // Avg completion rate
    const completedRates = allDealsForAvg.filter((d) => d.status === 'COMPLETED');
    const avgCompletionRate = completedRates.length > 0
      ? Math.round(
          completedRates.reduce((sum, d) =>
            sum + (d.targetQty > 0 ? (d.currentQty / d.targetQty) * 100 : 0), 0
          ) / completedRates.length
        )
      : 0;

    // Top deals with computed fields
    const topDealsFormatted = topDeals.map((d) => ({
      ...d,
      progressPercent: d.targetQty > 0 ? Math.min(100, Math.round((d.currentQty / d.targetQty) * 100)) : 0,
      savingsPerUnit: d.originalPrice - d.discountPrice,
      savingsPerUnitFormatted: formatVND(d.originalPrice - d.discountPrice),
      participantCount: d._count.participants,
    }));

    // Ward distribution with names
    const wardIds = wardDistribution.map((w) => w.wardId!).filter(Boolean);
    const wards = wardIds.length > 0
      ? await db.ward.findMany({
          where: { id: { in: wardIds } },
          select: { id: true, name: true, district: true },
        })
      : [];
    const wardMap = new Map(wards.map((w) => [w.id, w]));
    const wardDistributionFormatted = wardDistribution.map((w) => ({
      wardId: w.wardId,
      wardName: wardMap.get(w.wardId!)?.name || 'Unknown',
      district: wardMap.get(w.wardId!)?.district || '',
      count: w._count,
    }));

    // Status distribution
    const statusDistribution = {
      ACTIVE: { count: activeDeals, label: 'Active', labelVi: 'Hoat dong' },
      COMPLETED: { count: completedDeals, label: 'Completed', labelVi: 'Hoan thanh' },
      EXPIRED: { count: expiredDeals, label: 'Expired', labelVi: 'Het han' },
      CANCELLED: { count: cancelledDeals, label: 'Cancelled', labelVi: 'Da huy' },
    };

    return NextResponse.json(successResponse({
      totalDeals,
      activeDeals,
      completedDeals,
      expiredDeals,
      cancelledDeals,
      totalSavings,
      totalSavingsFormatted: formatVND(totalSavings),
      totalParticipants: uniqueParticipants.length,
      avgCompletionRate,
      topDealsByParticipation: topDealsFormatted,
      wardDistribution: wardDistributionFormatted,
      statusDistribution,
    }));
  } catch (error) {
    console.error('[GROUP DEALS STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch group deal stats'),
      { status: 500 }
    );
  }
}
