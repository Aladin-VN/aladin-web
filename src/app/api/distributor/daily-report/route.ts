// GET /api/distributor/daily-report?date=YYYY-MM-DD
// Comprehensive daily closing report for a distributor

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền nhà phân phối.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    // Parse date param, default to today
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const now = new Date();
    const reportDate = dateParam
      ? new Date(dateParam + 'T00:00:00')
      : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dayStart = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
    const dayEnd = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate(), 23, 59, 59, 999);

    const dateStr = dayStart.toISOString().slice(0, 10);

    // Run all queries in parallel
    const [
      posShifts,
      orderStatusGroups,
      deliveredOrders,
      inventoryMovements,
      shipmentStatusGroups,
    ] = await Promise.all([
      // 1. POS Shifts for the day
      db.posShift.findMany({
        where: {
          distributorId: distId,
          openedAt: { gte: dayStart, lte: dayEnd },
        },
        select: {
          id: true,
          openedAt: true,
          closedAt: true,
          openingBalance: true,
          closingBalance: true,
          expectedCash: true,
          cashDifference: true,
          cashTotal: true,
          bankTransferTotal: true,
          debtTotal: true,
          salesCount: true,
          status: true,
          openedBy: true,
          closedBy: true,
          closingNotes: true,
        },
        orderBy: { openedAt: 'asc' },
      }),

      // 2. Order count by status (all orders, not just POS)
      db.order.groupBy({
        by: ['status'],
        where: {
          distributorId: distId,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _count: true,
        _sum: { totalAmount: true },
      }),

      // 3. Delivered orders for revenue calculation
      db.order.findMany({
        where: {
          distributorId: distId,
          status: 'DELIVERED',
          deliveredAt: { gte: dayStart, lte: dayEnd },
        },
        select: { totalAmount: true, deliveredAt: true },
      }),

      // 4. Inventory movements by type
      db.inventoryMovement.groupBy({
        by: ['type'],
        where: {
          distributorId: distId,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        _count: true,
        _sum: { quantity: true },
      }),

      // 5. Deliveries (shipments) by status for orders belonging to this distributor
      db.shipment.findMany({
        where: {
          order: { distributorId: distId },
          createdAt: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true, status: true, createdAt: true, deliveredAt: true },
      }),
    ]);

    // ---- Process POS Summary ----
    const totalCash = posShifts.reduce((s, sh) => s + sh.cashTotal, 0);
    const totalBank = posShifts.reduce((s, sh) => s + sh.bankTransferTotal, 0);
    const totalDebt = posShifts.reduce((s, sh) => s + sh.debtTotal, 0);
    const totalTransactions = posShifts.reduce((s, sh) => s + sh.salesCount, 0);
    const totalCashDifference = posShifts.reduce((s, sh) => s + (sh.cashDifference ?? 0), 0);

    // ---- Process Order Summary ----
    const totalOrders = orderStatusGroups.reduce((s, g) => s + g._count, 0);
    const byStatus: Record<string, number> = {};
    for (const g of orderStatusGroups) {
      byStatus[g.status] = g._count;
    }
    const deliveredRevenue = deliveredOrders.reduce((s, o) => s + o.totalAmount, 0);

    // ---- Process Inventory Movements ----
    const totalMovements = inventoryMovements.reduce((s, g) => s + g._count, 0);
    const byType: Record<string, { count: number; quantity: number }> = {};
    for (const g of inventoryMovements) {
      byType[g.type] = { count: g._count, quantity: g._sum.quantity ?? 0 };
    }

    // ---- Process Delivery Summary ----
    const totalDeliveries = shipmentStatusGroups.length;
    const deliveryByStatus: Record<string, number> = {};
    for (const sh of shipmentStatusGroups) {
      deliveryByStatus[sh.status] = (deliveryByStatus[sh.status] || 0) + 1;
    }

    return NextResponse.json(successResponse({
      date: dateStr,
      pos: {
        shifts: posShifts,
        totalCash,
        totalBank,
        totalDebt,
        totalTransactions,
        cashDifference: totalCashDifference,
      },
      orders: {
        total: totalOrders,
        byStatus,
        deliveredRevenue,
      },
      inventory: {
        movements: totalMovements,
        byType,
      },
      deliveries: {
        total: totalDeliveries,
        byStatus: deliveryByStatus,
      },
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR DAILY REPORT ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}