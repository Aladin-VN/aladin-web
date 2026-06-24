// GET /api/distributor/ar-ledger — Accounts Receivable for distributor
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền NPP.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Không liên kết NPP.'), { status: 400 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const agingFilter = searchParams.get('aging') || ''; // 0-7, 8-14, 15-30, 30+

    // Find delivered orders NOT in any PAID settlement
    const paidSettlementOrderIds = await db.settlementLineItem.findMany({
      where: { settlement: { status: 'PAID' } },
      select: { orderId: true },
    });
    const paidOrderIds = new Set(paidSettlementOrderIds.map(s => s.orderId));

    const where: Record<string, unknown> = {
      distributorId: distId,
      status: 'DELIVERED',
      id: { notIn: Array.from(paidOrderIds) },
    };

    // Aging filter
    if (agingFilter) {
      const now = new Date();
      let minDays: number, maxDays: number;
      if (agingFilter === '0-7') { minDays = 0; maxDays = 7; }
      else if (agingFilter === '8-14') { minDays = 8; maxDays = 14; }
      else if (agingFilter === '15-30') { minDays = 15; maxDays = 30; }
      else { minDays = 31; maxDays = 9999; }
      const minDate = new Date(now); minDate.setDate(minDate.getDate() - maxDays);
      const maxDate = new Date(now); maxDate.setDate(maxDate.getDate() - minDays);
      where.deliveredAt = { gte: minDate, lt: maxDate };
    }

    const [arOrders, totalAR, allAR] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          shop: { select: { name: true, district: true, province: true } },
        },
        orderBy: { deliveredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.aggregate({
        where: { distributorId: distId, status: 'DELIVERED', id: { notIn: Array.from(paidOrderIds) } },
        _sum: { totalAmount: true },
      }),
      db.order.findMany({
        where: { distributorId: distId, status: 'DELIVERED', id: { notIn: Array.from(paidOrderIds) } },
        select: { totalAmount: true, deliveredAt: true },
      }),
    ]);

    // Calculate aging buckets
    const now = new Date();
    const agingBuckets = { current: 0, overdue8: 0, overdue15: 0, overdue30: 0 };
    for (const order of allAR) {
      const days = order.deliveredAt ? Math.floor((now.getTime() - order.deliveredAt.getTime()) / 86400000) : 0;
      if (days <= 7) agingBuckets.current += order.totalAmount;
      else if (days <= 14) agingBuckets.overdue8 += order.totalAmount;
      else if (days <= 30) agingBuckets.overdue15 += order.totalAmount;
      else agingBuckets.overdue30 += order.totalAmount;
    }

    const items = arOrders.map(o => {
      const days = o.deliveredAt ? Math.floor((now.getTime() - o.deliveredAt.getTime()) / 86400000) : 0;
      return {
        id: o.id,
        orderNumber: o.orderNumber,
        shopId: o.shopId,
        shopName: o.shop?.name || 'Unknown',
        shopDistrict: o.shop?.district || '',
        amount: o.totalAmount,
        deliveredAt: o.deliveredAt,
        agingDays: days,
        agingBucket: days <= 7 ? 'current' : days <= 14 ? 'overdue8' : days <= 30 ? 'overdue15' : 'overdue30',
      };
    });

    const totalPages = Math.ceil((allAR.length) / limit);

    return NextResponse.json(successResponse({
      items,
      pagination: { page, totalPages, total: allAR.length },
      summary: {
        totalAR: totalAR._sum.totalAmount || 0,
        ...agingBuckets,
      },
    }));
  } catch (error) {
    console.error('[AR LEDGER ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}