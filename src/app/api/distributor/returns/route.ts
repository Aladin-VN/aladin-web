// GET|POST /api/distributor/returns — List & create returns
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse, sanitizeInput } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Phân quyền nhà phân phối yêu cầu.'), { status: 403 });
    }

    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = { distributorId: distId };

    const [returns, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where: { ...where, type: 'RETURN' },
        include: {
          product: { select: { name: true, sku: true } },
          order: { select: { orderNumber: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.inventoryMovement.count({ where: { ...where, type: 'RETURN' } }),
    ]);

    return NextResponse.json(successResponse({
      items: returns.map((r) => ({
        id: r.id,
        productName: r.product.name,
        productSku: r.product.sku,
        orderNumber: r.order?.orderNumber || null,
        quantity: r.quantity,
        previousQty: r.previousQty,
        newQty: r.newQty,
        reason: r.reason,
        performedBy: r.performer?.name || null,
        createdAt: r.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR RETURNS GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Phân quyền nhà phân phối yêu cầu.'), { status: 403 });
    }

    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    const body = await request.json();
    const { orderNumber, reason, notes, items: itemsText } = body as {
      orderNumber: string; reason: string; notes?: string; items?: string;
    };

    if (!orderNumber || !reason) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Thiếu mã đơn hàng hoặc lý do.'), { status: 400 });
    }

    // Find the order
    const order = await db.order.findFirst({
      where: {
        orderNumber: { contains: orderNumber },
        distributorId: distId,
      },
      include: { orderItems: { include: { product: true } } },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy đơn hàng.'), { status: 404 });
    }

    // For simplicity, create a return movement for each order item
    // In production, the items text would be parsed to match specific SKUs
    const movements = [];
    for (const item of order.orderItems) {
      const inv = await db.distributorInventory.findUnique({
        where: { distributorId_productId: { distributorId: distId, productId: item.productId } },
      });

      const prevQty = inv?.quantity || 0;
      const returnQty = item.quantity; // Return full line item quantity

      const updated = await db.distributorInventory.upsert({
        where: { distributorId_productId: { distributorId: distId, productId: item.productId } },
        create: {
          distributorId: distId,
          productId: item.productId,
          quantity: returnQty, // Returned items go back to stock
          reservedQty: 0,
          minStockLevel: 20,
        },
        update: {
          quantity: { increment: returnQty },
        },
      });

      const movement = await db.inventoryMovement.create({
        data: {
          distributorId: distId,
          productId: item.productId,
          type: 'RETURN',
          quantity: returnQty,
          previousQty: prevQty,
          newQty: updated.quantity,
          reason: sanitizeInput(`${reason}${notes ? ' - ' + notes : ''}${itemsText ? ' | ' + itemsText : ''}`),
          orderId: order.id,
          performedBy: user.userId,
        },
        include: { product: { select: { name: true, sku: true } } },
      });

      movements.push(movement);
    }

    return NextResponse.json(successResponse({
      id: movements[0]?.id,
      orderNumber: order.orderNumber,
      itemsReturned: movements.map((m) => ({
        productName: m.product.name,
        productSku: m.product.sku,
        quantity: m.quantity,
      })),
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR RETURNS POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}