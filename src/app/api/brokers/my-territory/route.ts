// ALADIN Broker My-Territory API
// GET /api/brokers/my-territory — Broker's own territory details with shops & nearby opportunities

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/get-auth-user';
import { successResponse, errorResponse } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // 1. Auth check
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const user = authResult;

    // 2. Find broker record
    const broker = await db.broker.findFirst({
      where: { userId: user.userId },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    if (!broker) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Broker profile not found'),
        { status: 404 }
      );
    }

    // 3. Get assigned ward
    const ward = broker.wardId
      ? await db.ward.findUnique({ where: { id: broker.wardId } })
      : null;

    // 4. Get shops in broker's ward with order stats
    const shopsInWard = broker.wardId
      ? await db.shop.findMany({
          where: { wardId: broker.wardId, deletedAt: null },
          select: {
            id: true,
            name: true,
            district: true,
            user: { select: { phone: true } },
            _count: {
              select: { orders: true },
            },
            orders: {
              select: { totalAmount: true, createdAt: true },
              where: { status: { not: 'CANCELLED' } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
      : [];

    const shops = shopsInWard.map((shop) => {
      const totalGmv = shop.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      const lastOrderDate = shop.orders[0]?.createdAt ?? null;
      return {
        id: shop.id,
        name: shop.name,
        phone: shop.user.phone,
        district: shop.district,
        orderCount: shop._count.orders,
        totalGmv,
        totalGmvFormatted: new Intl.NumberFormat('vi-VN').format(totalGmv) + ' ₫',
        lastOrderDate,
      };
    });

    // 5. Get uncovered nearby wards (same district, no broker assigned)
    let nearbyOpportunities: Array<{ wardId: string; wardName: string; district: string; shopCount: number }> = [];
    if (ward) {
      const uncoveredWards = await db.ward.findMany({
        where: {
          district: ward.district,
          id: { not: ward.id },
          brokers: { none: {} },
        },
        include: {
          _count: { select: { shops: true } },
        },
      });

      nearbyOpportunities = uncoveredWards.map((w) => ({
        wardId: w.id,
        wardName: w.name,
        district: w.district,
        shopCount: w._count.shops,
      }));
    }

    // 6. Calculate performance rank among all brokers by commission
    const totalBrokers = await db.broker.count();
    const brokersRanked = await db.broker.findMany({
      orderBy: { totalCommissionEarned: 'desc' },
      select: { id: true },
    });
    const performanceRank =
      brokersRanked.findIndex((b) => b.id === broker.id) + 1;

    // Format VND
    const formatVND = (amount: number) =>
      new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

    // 7. Build response
    return NextResponse.json(
      successResponse({
        broker: {
          id: broker.id,
          name: broker.user.name,
          phone: broker.user.phone,
          tier: broker.tier,
          commissionRate: broker.commissionRate,
          totalShopsReferred: broker.totalShopsReferred,
          totalGmvGenerated: broker.totalGmvGenerated,
          totalGmvGeneratedFormatted: formatVND(broker.totalGmvGenerated),
          totalCommissionEarned: broker.totalCommissionEarned,
          totalCommissionEarnedFormatted: formatVND(broker.totalCommissionEarned),
        },
        territory: {
          ward: ward
            ? {
                id: ward.id,
                name: ward.name,
                district: ward.district,
                province: ward.province,
              }
            : null,
          shopCount: shops.length,
          shops,
        },
        nearbyOpportunities,
        performanceRank: performanceRank > 0 ? performanceRank : totalBrokers,
        totalBrokers,
      })
    );
  } catch (error) {
    console.error('[BROKER MY-TERRITORY ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch territory details'),
      { status: 500 }
    );
  }
}