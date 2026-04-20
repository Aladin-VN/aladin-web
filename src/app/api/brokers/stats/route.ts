// ALADIN Broker Stats API — Enhanced with monthly trends
// GET /api/brokers/stats — Aggregate broker statistics with period data

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

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // all, month, quarter

    // Date range for period
    let dateFilter: Record<string, unknown> = {};
    if (period === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { gte: startOfMonth } };
    } else if (period === 'quarter') {
      const quarterStart = new Date();
      quarterStart.setMonth(quarterStart.getMonth() - 3);
      dateFilter = { createdAt: { gte: quarterStart } };
    }

    const [
      totalBrokers,
      activeBrokers,
      totalCommissionEarned,
      totalGmvGenerated,
      tierDistribution,
    ] = await Promise.all([
      db.broker.count(),
      db.broker.count({
        where: { user: { status: 'ACTIVE' } },
      }),
      db.broker.aggregate({
        _sum: { totalCommissionEarned: true },
        where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      }),
      db.broker.aggregate({
        _sum: { totalGmvGenerated: true },
        where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      }),
      db.broker.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
    ]);

    // Top performers (by GMV generated)
    const topPerformers = await db.broker.findMany({
      where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      orderBy: { totalGmvGenerated: 'desc' },
      take: 5,
      select: {
        id: true,
        tier: true,
        totalGmvGenerated: true,
        totalCommissionEarned: true,
        totalShopsReferred: true,
        user: {
          select: { name: true, phone: true },
        },
      },
    });

    // Territory coverage
    const assignedWards = await db.broker.groupBy({
      by: ['wardId'],
      where: { wardId: { not: null } },
      _count: { id: true },
    });

    const totalWards = await db.ward.count();
    const coveredWards = assignedWards.length;

    // Monthly trends (last 6 months)
    const monthlyTrends = await db.$queryRaw<
      { month: string; brokers: number; gmv: number; commission: number }[]
    >`
      WITH RECURSIVE months(month) AS (
        SELECT date('now', '-5 months') UNION ALL
        SELECT date(month, '+1 month') FROM months WHERE month < date('now', '+1 month')
      )
      SELECT
        strftime('%Y-%m', m.month) as month,
        COUNT(DISTINCT b.id) as brokers,
        COALESCE(SUM(b.totalGmvGenerated), 0) as gmv,
        COALESCE(SUM(b.totalCommissionEarned), 0) as commission
      FROM months m
      LEFT JOIN Broker b ON strftime('%Y-%m', b.createdAt) <= m.month
        AND (strftime('%Y-%m', b."updatedAt") >= m.month OR b."updatedAt" IS NULL)
      GROUP BY m.month
      ORDER BY m.month
    `;

    // New brokers this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newBrokersThisMonth = await db.broker.count({
      where: { createdAt: { gte: startOfMonth } },
    });

    return NextResponse.json(successResponse({
      totalBrokers,
      activeBrokers,
      newBrokersThisMonth,
      totalCommissionEarned: totalCommissionEarned._sum.totalCommissionEarned || 0,
      totalCommissionEarnedFormatted: formatVND(totalCommissionEarned._sum.totalCommissionEarned || 0),
      totalGmvGenerated: totalGmvGenerated._sum.totalGmvGenerated || 0,
      totalGmvGeneratedFormatted: formatVND(totalGmvGenerated._sum.totalGmvGenerated || 0),
      avgCommissionPerBroker: totalBrokers > 0
        ? Math.round((totalCommissionEarned._sum.totalCommissionEarned || 0) / totalBrokers)
        : 0,
      avgGmvPerBroker: totalBrokers > 0
        ? Math.round((totalGmvGenerated._sum.totalGmvGenerated || 0) / totalBrokers)
        : 0,
      tierDistribution: tierDistribution.reduce<Record<string, number>>((acc, item) => {
        acc[item.tier] = item._count.id;
        return acc;
      }, {}),
      topPerformers: topPerformers.map(p => ({
        id: p.id,
        name: p.user.name,
        phone: p.user.phone,
        tier: p.tier,
        gmvGenerated: p.totalGmvGenerated,
        gmvGeneratedFormatted: formatVND(p.totalGmvGenerated),
        commissionEarned: p.totalCommissionEarned,
        commissionEarnedFormatted: formatVND(p.totalCommissionEarned),
        shopsReferred: p.totalShopsReferred,
      })),
      territoryCoverage: {
        totalWards,
        coveredWards,
        uncoveredWards: totalWards - coveredWards,
        coveragePercent: totalWards > 0 ? Math.round((coveredWards / totalWards) * 100) : 0,
      },
      monthlyTrends: monthlyTrends.map(m => ({
        month: m.month,
        brokers: m.brokers,
        gmv: m.gmv,
        gmvFormatted: formatVND(m.gmv),
        commission: m.commission,
        commissionFormatted: formatVND(m.commission),
      })),
    }));
  } catch (error) {
    console.error('[BROKERS STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch broker stats'),
      { status: 500 }
    );
  }
}
