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
    const movements = await db.inventoryMovement.findMany({
      where: { distributorId: distId, type: 'POS_SALE', createdAt: { gte: today } },
      include: {
        product: { select: { name: true, sku: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const cashTotal = movements.reduce((s, m) => {
      const order = m.quantity; // negative for sales
      return s + Math.abs(m.quantity) * 0; // will sum from actual order amounts
    }, 0);

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

    return NextResponse.json(successResponse({ summary, transactions: todayOrders }));
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
    const todayOrders = await db.order.findMany({
      where: { distributorId: distId, createdAt: { gte: today }, orderNumber: { startsWith: 'POS-' } },
      select: { totalAmount: true, paymentMethod: true },
    });

    const totalCash = todayOrders.filter(o => o.paymentMethod === 'CASH').reduce((s, o) => s + o.totalAmount, 0);
    const totalBank = todayOrders.filter(o => o.paymentMethod === 'BANK_TRANSFER').reduce((s, o) => s + o.totalAmount, 0);
    const totalDebt = todayOrders.filter(o => o.paymentMethod === 'CREDIT').reduce((s, o) => s + o.totalAmount, 0);
    const totalSales = todayOrders.reduce((s, o) => s + o.totalAmount, 0);
    const difference = closingCash - totalCash;

    return NextResponse.json(successResponse({
      date: today.toISOString().slice(0, 10),
      totalSales,
      cashSales: totalCash,
      bankSales: totalBank,
      debtSales: totalDebt,
      totalTransactions: todayOrders.length,
      closingCash,
      difference,
      closedBy: user.userId,
      closedAt: new Date(),
    }));
  } catch (error) {
    console.error('[POS RECONCILIATION POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}