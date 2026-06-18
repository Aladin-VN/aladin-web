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

    const role = payload.role;
    const shopWhereBase: Record<string, unknown> = { deletedAt: null };
    if (role === 'SHOP_OWNER' && payload.shopId) {
      shopWhereBase.id = payload.shopId;
    } else if (role === 'BROKER') {
      const brokerShops = await db.shop.findMany({ where: { broker: { userId: payload.userId } }, select: { id: true } });
      if (brokerShops.length > 0) {
        shopWhereBase.id = { in: brokerShops.map(s => s.id) };
      } else {
        shopWhereBase.id = 'NONE'; // No shops visible
      }
    }

    const [totalShops, activeShops, lockedShops, overdueShops, platinumShops, totalGmv, totalCreditExposure, newThisMonth] = await Promise.all([
      db.shop.count({ where: shopWhereBase }),
      db.shop.count({ where: { ...shopWhereBase, creditStatus: 'ACTIVE' } }),
      db.shop.count({ where: { ...shopWhereBase, creditStatus: 'LOCKED' } }),
      db.shop.count({ where: { ...shopWhereBase, creditStatus: 'OVERDUE' } }),
      db.shop.count({ where: { ...shopWhereBase, loyaltyTier: 'PLATINUM' } }),
      db.shop.aggregate({
        where: shopWhereBase,
        _sum: { totalGmv: true, creditBalance: true },
      }),
      db.shop.aggregate({
        where: shopWhereBase,
        _sum: { creditBalance: true },
      }),
      db.shop.count({
        where: {
          ...shopWhereBase,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    // Loyalty tier distribution
    const tierDistribution = await db.shop.groupBy({
      by: ['loyaltyTier'],
      where: shopWhereBase,
      _count: { id: true },
    });

    // Credit status distribution
    const creditDistribution = await db.shop.groupBy({
      by: ['creditStatus'],
      where: shopWhereBase,
      _count: { id: true },
    });

    // Top districts by shop count
    const topDistricts = await db.shop.groupBy({
      by: ['district'],
      where: { ...shopWhereBase, district: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Shop type distribution
    const shopTypeDistribution = await db.shop.groupBy({
      by: ['shopType'],
      where: shopWhereBase,
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
