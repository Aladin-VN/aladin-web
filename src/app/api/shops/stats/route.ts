// ALADIN Shop Stats API
// Sprint 5A: Aggregate shop statistics for dashboard cards

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

    const [totalShops, activeShops, lockedShops, overdueShops, platinumShops, totalGmv, totalCreditExposure, newThisMonth] = await Promise.all([
      db.shop.count({ where: { deletedAt: null } }),
      db.shop.count({ where: { deletedAt: null, creditStatus: 'ACTIVE' } }),
      db.shop.count({ where: { deletedAt: null, creditStatus: 'LOCKED' } }),
      db.shop.count({ where: { deletedAt: null, creditStatus: 'OVERDUE' } }),
      db.shop.count({ where: { deletedAt: null, loyaltyTier: 'PLATINUM' } }),
      db.shop.aggregate({
        where: { deletedAt: null },
        _sum: { totalGmv: true, creditBalance: true },
      }),
      db.shop.aggregate({
        where: { deletedAt: null },
        _sum: { creditBalance: true },
      }),
      db.shop.count({
        where: {
          deletedAt: null,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    // Loyalty tier distribution
    const tierDistribution = await db.shop.groupBy({
      by: ['loyaltyTier'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    // Credit status distribution
    const creditDistribution = await db.shop.groupBy({
      by: ['creditStatus'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    // Top districts by shop count
    const topDistricts = await db.shop.groupBy({
      by: ['district'],
      where: { deletedAt: null, district: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Shop type distribution
    const shopTypeDistribution = await db.shop.groupBy({
      by: ['shopType'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    return NextResponse.json(successResponse({
      totalShops,
      activeShops,
      lockedShops,
      overdueShops,
      platinumShops,
      newThisMonth,
      totalGmv: totalGmv._sum.totalGmv || 0,
      totalGmvFormatted: formatVND(totalGmv._sum.totalGmv || 0),
      totalCreditExposure: totalCreditExposure._sum.creditBalance || 0,
      totalCreditExposureFormatted: formatVND(totalCreditExposure._sum.creditBalance || 0),
      tierDistribution: tierDistribution.reduce<Record<string, number>>((acc, item) => {
        acc[item.loyaltyTier] = item._count.id;
        return acc;
      }, {}),
      creditDistribution: creditDistribution.reduce<Record<string, number>>((acc, item) => {
        acc[item.creditStatus] = item._count.id;
        return acc;
      }, {}),
      topDistricts: topDistricts.map((d) => ({
        district: d.district,
        count: d._count.id,
      })),
      shopTypeDistribution: shopTypeDistribution.reduce<Record<string, number>>((acc, item) => {
        acc[item.shopType] = item._count.id;
        return acc;
      }, {}),
    }));
  } catch (error) {
    console.error('[SHOPS STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shop stats'),
      { status: 500 }
    );
  }
}
