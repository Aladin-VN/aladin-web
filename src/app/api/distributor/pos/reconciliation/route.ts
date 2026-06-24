// GET|POST /api/distributor/pos/reconciliation — Shift reconciliation
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) return NextResponse.json(errorResponse('FORBIDDEN', ''), { status: 403 });
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Check if there's an active shift for today
    const activeShift = await db.posShift.findFirst({
      where: { distributorId: distId, status: 'OPEN', openedAt: { gte: today } },
      orderBy: { openedAt: 'desc' },
    });

    // Get actual order amounts for today's POS sales
    const todayOrders = await db.order.findMany({
      where: { distributorId: distId, createdAt: { gte: today }, orderNumber: { startsWith: 'POS-' } },
      select: { totalAmount: true, paymentMethod: true, createdAt: true, orderNumber: true, id: true },
    });

    const summary = { CASH: 0, BANK_TRANSFER: 0, CREDIT: 0, total: 0, count: todayOrders.length };
    for (const o of todayOrders) {
      const method = o.paymentMethod === 'CREDIT' ? 'CREDIT' : o.paymentMethod;
      (summary as any)[method] += o.totalAmount;
      summary.total += o.totalAmount;
    }

    return NextResponse.json(successResponse({
      summary,
      transactions: todayOrders,
      activeShift: activeShift ? {
        id: activeShift.id,
        openedAt: activeShift.openedAt,
        salesCount: activeShift.salesCount,
        cashTotal: activeShift.cashTotal,
        bankTransferTotal: activeShift.bankTransferTotal,
        debtTotal: activeShift.debtTotal,
      } : null,
    }));
  } catch (error) {
    console.error('[POS RECONCILIATION GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) return NextResponse.json(errorResponse('FORBIDDEN', ''), { status: 403 });
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });

    const body = await request.json();
    const { closingCash } = body as { closingCash: number };

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const now = new Date();

    // Find or create today's shift
    let shift = await db.posShift.findFirst({
      where: { distributorId: distId, status: 'OPEN', openedAt: { gte: today } },
      orderBy: { openedAt: 'desc' },
    });

    if (!shift) {
      // Auto-create shift for today with first sale time
      const firstSale = await db.order.findFirst({
        where: { distributorId: distId, createdAt: { gte: today }, orderNumber: { startsWith: 'POS-' } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      shift = await db.posShift.create({
        data: {
          distributorId: distId,
          openedAt: firstSale?.createdAt || now,
          openedBy: user.userId,
          status: 'OPEN',
        },
      });
    }

    // Get today's POS sales for this shift
    const todayOrders = await db.order.findMany({
      where: {
        distributorId: distId,
        createdAt: { gte: shift.openedAt },
        orderNumber: { startsWith: 'POS-' },
      },
      select: { totalAmount: true, paymentMethod: true, id: true },
    });

    const cashTotal = todayOrders.filter(o => o.paymentMethod === 'CASH').reduce((s, o) => s + o.totalAmount, 0);
    const bankTransferTotal = todayOrders.filter(o => o.paymentMethod === 'BANK_TRANSFER').reduce((s, o) => s + o.totalAmount, 0);
    const debtTotal = todayOrders.filter(o => o.paymentMethod === 'CREDIT').reduce((s, o) => s + o.totalAmount, 0);
    const totalSales = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
    const cashDifference = closingCash - cashTotal;

    // Persist the closed shift using actual schema field names
    const closedShift = await db.posShift.update({
      where: { id: shift.id },
      data: {
        status: 'CLOSED',
        closedAt: now,
        closedBy: user.userId,
        closingBalance: closingCash,
        expectedCash: cashTotal,
        cashDifference,
        cashTotal,
        bankTransferTotal,
        debtTotal,
        salesCount: todayOrders.length,
        closingNotes: `Đóng ca bởi ${user.userId}`,
      },
    });

    return NextResponse.json(successResponse({
      shiftId: closedShift.id,
      date: today.toISOString().slice(0, 10),
      totalSales,
      cashSales: cashTotal,
      bankSales: bankTransferTotal,
      debtSales: debtTotal,
      totalTransactions: todayOrders.length,
      closingCash,
      difference: cashDifference,
      closedBy: user.userId,
      closedAt: now.toISOString(),
      shiftNumber: closedShift.id.slice(-6).toUpperCase(),
    }));
  } catch (error) {
    console.error('[POS RECONCILIATION POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}