// ALADIN Broker Commissions API
// GET /api/brokers/commissions — Commission ledger, payout summary

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
    const brokerId = searchParams.get('brokerId') || '';
    const tier = searchParams.get('tier') || '';
    const hasEarnings = searchParams.get('hasEarnings') === 'true';
    const sortBy = searchParams.get('sortBy') || 'totalCommissionEarned';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Build where
    const where: Record<string, unknown> = {};
    if (brokerId) where.id = brokerId;
    if (tier) where.tier = tier;
    if (hasEarnings) where.totalCommissionEarned = { gt: 0 };

    // Build order by
    const orderBy: Record<string, string> = {};
    if (sortBy === 'totalCommissionEarned') orderBy.totalCommissionEarned = sortOrder;
    else if (sortBy === 'totalGmvGenerated') orderBy.totalGmvGenerated = sortOrder;
    else if (sortBy === 'totalShopsReferred') orderBy.totalShopsReferred = sortOrder;
    else if (sortBy === 'commissionRate') orderBy.commissionRate = sortOrder;
    else orderBy.createdAt = sortOrder;

    const [brokers, total] = await Promise.all([
      db.broker.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              status: true,
              createdAt: true,
            },
          },
          ward: {
            select: { id: true, name: true, district: true },
          },
        },
      }),
      db.broker.count({ where }),
    ]);

    // Commission summary across all brokers
    const totalCommissionSummary = await db.broker.aggregate({
      _sum: { totalCommissionEarned: true },
      where: { totalCommissionEarned: { gt: 0 } },
    });

    const totalGmvSummary = await db.broker.aggregate({
      _sum: { totalGmvGenerated: true },
    });

    const brokersWithEarnings = await db.broker.count({
      where: { totalCommissionEarned: { gt: 0 } },
    });

    return NextResponse.json(successResponse({
      items: brokers.map(b => ({
        id: b.id,
        userId: b.user.id,
        name: b.user.name,
        phone: b.user.phone,
        status: b.user.status,
        tier: b.tier,
        commissionRate: b.commissionRate,
        commissionRatePercent: `${(b.commissionRate * 100).toFixed(1)}%`,
        totalShopsReferred: b.totalShopsReferred,
        totalCommissionEarned: b.totalCommissionEarned,
        totalCommissionEarnedFormatted: formatVND(b.totalCommissionEarned),
        totalGmvGenerated: b.totalGmvGenerated,
        totalGmvGeneratedFormatted: formatVND(b.totalGmvGenerated),
        effectiveRate: b.totalGmvGenerated > 0
          ? ((b.totalCommissionEarned / b.totalGmvGenerated) * 100).toFixed(2)
          : '0.00',
        ward: b.ward ? { id: b.ward.id, name: b.ward.name, district: b.ward.district } : null,
        joinedAt: b.user.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalUnpaidCommission: totalCommissionSummary._sum.totalCommissionEarned || 0,
        totalUnpaidCommissionFormatted: formatVND(totalCommissionSummary._sum.totalCommissionEarned || 0),
        totalGmvGenerated: totalGmvSummary._sum.totalGmvGenerated || 0,
        totalGmvGeneratedFormatted: formatVND(totalGmvSummary._sum.totalGmvGenerated || 0),
        brokersWithEarnings,
        brokersWithoutEarnings: total - brokersWithEarnings,
      },
    }));
  } catch (error) {
    console.error('[BROKER COMMISSIONS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch commissions'),
      { status: 500 }
    );
  }
}
