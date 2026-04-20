// ALADIN Broker Stats API
// GET /api/brokers/stats — Aggregate broker statistics

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

export async function GET() {
  try {
    const [
      totalBrokers,
      activeBrokers,
      totalCommissionEarned,
      totalGmvGenerated,
    ] = await Promise.all([
      db.broker.count(),
      db.broker.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      db.broker.aggregate({
        _sum: { totalCommissionEarned: true },
      }),
      db.broker.aggregate({
        _sum: { totalGmvGenerated: true },
      }),
    ]);

    // Tier distribution
    const tierDistribution = await db.broker.groupBy({
      by: ['tier'],
      _count: { id: true },
    });

    return NextResponse.json(successResponse({
      totalBrokers,
      activeBrokers,
      totalCommissionEarned: totalCommissionEarned._sum.totalCommissionEarned || 0,
      totalCommissionEarnedFormatted: formatVND(totalCommissionEarned._sum.totalCommissionEarned || 0),
      totalGmvGenerated: totalGmvGenerated._sum.totalGmvGenerated || 0,
      totalGmvGeneratedFormatted: formatVND(totalGmvGenerated._sum.totalGmvGenerated || 0),
      tierDistribution: tierDistribution.reduce<Record<string, number>>((acc, item) => {
        acc[item.tier] = item._count.id;
        return acc;
      }, {}),
    }));
  } catch (error) {
    console.error('[BROKERS STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch broker stats'),
      { status: 500 }
    );
  }
}
