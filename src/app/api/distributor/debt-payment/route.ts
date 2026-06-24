import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse, sanitizeInput, isValidVNDAmount } from '@/lib/security';
import { db } from '@/lib/db';

const VALID_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER'] as const;

// ============================================================
// POST /api/distributor/debt-payment — Record a debt payment
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền NPP.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Không liên kết NPP.'), { status: 400 });
    }

    const body = await request.json();
    const { shopId, amount, paymentMethod, notes, orderIds } = body as {
      shopId?: string;
      amount?: number;
      paymentMethod?: string;
      notes?: string;
      orderIds?: string[];
    };

    // --- Validate inputs ---
    if (!shopId || typeof shopId !== 'string' || shopId.trim().length === 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Thiếu shopId.'), { status: 400 });
    }
    if (!amount || !isValidVNDAmount(amount) || amount <= 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Số tiền không hợp lệ.'), { status: 400 });
    }
    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Phương thức thanh toán không hợp lệ. Chọn: ${VALID_PAYMENT_METHODS.join(', ')}.`),
        { status: 400 },
      );
    }
    if (orderIds && !Array.isArray(orderIds)) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'orderIds phải là mảng.'), { status: 400 });
    }

    const sanitizedNotes = notes ? sanitizeInput(notes) : null;

    // --- Verify shop exists ---
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, creditBalance: true, creditLimit: true },
    });
    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy cửa hàng.'), { status: 404 });
    }

    // --- Look up outstanding debt for this shop & distributor ---
    // Outstanding = DELIVERED orders with CREDIT payment, for this distributor, not yet fully paid
    const outstandingOrders = await db.order.findMany({
      where: {
        shopId,
        distributorId: distId,
        status: 'DELIVERED',
        paymentMethod: 'CREDIT',
        paymentStatus: { not: 'PAID' },
      },
      select: { id: true, orderNumber: true, totalAmount: true },
      orderBy: { deliveredAt: 'asc' },
    });

    const totalOutstanding = outstandingOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    if (totalOutstanding <= 0) {
      return NextResponse.json(errorResponse('NO_DEBT', 'Cửa hàng này không có công nợ.'), { status: 400 });
    }

    if (amount > totalOutstanding) {
      return NextResponse.json(
        errorResponse('EXCEEDS_DEBT', `Số tiền thu vượt quá công nợ (${new Intl.NumberFormat('vi-VN').format(totalOutstanding)} ₫).`),
        { status: 400 },
      );
    }

    // --- If orderIds provided, validate they belong to outstanding orders ---
    let targetOrderIds: string[] = [];
    if (orderIds && orderIds.length > 0) {
      const outstandingIdSet = new Set(outstandingOrders.map(o => o.id));
      const invalidIds = orderIds.filter(id => !outstandingIdSet.has(id));
      if (invalidIds.length > 0) {
        return NextResponse.json(
          errorResponse('INVALID_ORDER_IDS', 'Một số orderId không thuộc công nợ chưa thanh toán.'),
          { status: 400 },
        );
      }
      const targetOrders = outstandingOrders.filter(o => orderIds.includes(o.id));
      const targetTotal = targetOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      if (amount > targetTotal) {
        return NextResponse.json(
          errorResponse('EXCEEDS_TARGET', `Số tiền vượt tổng các đơn được chọn (${new Intl.NumberFormat('vi-VN').format(targetTotal)} ₫).`),
          { status: 400 },
        );
      }
      targetOrderIds = orderIds;
    } else {
      // Auto-select orders FIFO (oldest first) up to the payment amount
      let remaining = amount;
      for (const order of outstandingOrders) {
        if (remaining <= 0) break;
        targetOrderIds.push(order.id);
        remaining -= order.totalAmount;
      }
    }

    // --- Calculate new credit balance ---
    const newCreditBalance = Math.max(0, shop.creditBalance - amount);

    // --- Create Transaction record ---
    const transaction = await db.transaction.create({
      data: {
        shopId,
        type: 'REPAYMENT',
        amount: -amount, // negative = credit to shop (reduces debt)
        runningBalance: newCreditBalance,
        paymentMethod,
        collectedBy: user.userId,
        description: sanitizedNotes || `Thu tiền nợ - ${paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}`,
        metadata: JSON.stringify({
          distributorId: distId,
          distributorName: user.distributor?.name || '',
          orderIds: targetOrderIds,
          paymentMethod,
        }),
      },
    });

    // --- Update orders to PAID ---
    let paymentRemaining = amount;
    const fullyPaidOrderIds: string[] = [];

    for (const orderId of targetOrderIds) {
      const order = outstandingOrders.find(o => o.id === orderId);
      if (!order) continue;

      if (paymentRemaining >= order.totalAmount) {
        fullyPaidOrderIds.push(orderId);
        paymentRemaining -= order.totalAmount;
      } else {
        // Partial payment on this last order
        await db.order.update({
          where: { id: orderId },
          data: { paidAmount: (order.paidAmount || 0) + paymentRemaining },
        });
        paymentRemaining = 0;
      }
    }

    // Mark fully paid orders — single batch update
    if (fullyPaidOrderIds.length > 0) {
      await db.order.updateMany({
        where: { id: { in: fullyPaidOrderIds } },
        data: {
          paymentMethod,
          paymentStatus: 'PAID',
        },
      });
    }

    // --- Update shop creditBalance (denormalized) + status ---
    const shopUpdateData: Record<string, unknown> = { creditBalance: newCreditBalance };
    if (newCreditBalance <= 0) {
      shopUpdateData.creditStatus = 'ACTIVE';
    }
    await db.shop.update({
      where: { id: shopId },
      data: shopUpdateData,
    });

    return NextResponse.json(successResponse({
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount,
        paymentMethod: transaction.paymentMethod,
        runningBalance: transaction.runningBalance,
        description: transaction.description,
        createdAt: transaction.createdAt,
      },
      shop: { id: shop.id, name: shop.name },
      ordersPaid: fullyPaidOrderIds.length,
      orderIds: targetOrderIds,
    }));
  } catch (error) {
    console.error('[DEBT PAYMENT ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống. Vui lòng thử lại.'), { status: 500 });
  }
}

// ============================================================
// GET /api/distributor/debt-payment — List recent debt payments
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền NPP.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Không liên kết NPP.'), { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const shopId = searchParams.get('shopId') || null;

    const where: Record<string, unknown> = {
      type: 'REPAYMENT',
    };
    if (shopId) {
      (where as Record<string, string>).shopId = shopId;
    }

    const [payments, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          shop: { select: { id: true, name: true, district: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transaction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Parse metadata JSON for each payment
    const items = payments.map(p => {
      let meta: Record<string, unknown> = {};
      try {
        meta = p.metadata ? JSON.parse(p.metadata) : {};
      } catch { /* ignore */ }

      // Only return payments for this distributor's shops
      // (filter in memory since metadata is JSON)
      if (distId && meta.distributorId && meta.distributorId !== distId) {
        return null;
      }

      return {
        id: p.id,
        amount: Math.abs(p.amount), // Show as positive
        paymentMethod: p.paymentMethod,
        runningBalance: p.runningBalance,
        description: p.description,
        collectedBy: p.collectedBy,
        shopId: p.shopId,
        shopName: p.shop?.name || 'Unknown',
        shopDistrict: p.shop?.district || '',
        orderIds: (meta.orderIds as string[]) || [],
        createdAt: p.createdAt,
      };
    }).filter(Boolean);

    return NextResponse.json(successResponse(
      { items, pagination: { page, totalPages, total } },
      { page, limit, total, totalPages },
    ));
  } catch (error) {
    console.error('[DEBT PAYMENT LIST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}