// POST /api/distributor/pos/sale — Process a POS sale
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', ''), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });

    const body = await request.json();
    const { items, shopId, paymentMethod, customerName, customerPhone } = body as {
      items: { productId: string; quantity: number }[];
      shopId?: string;
      paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'DEBT';
      customerName?: string;
      customerPhone?: string;
    };

    if (!items?.length || !paymentMethod) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Thiếu thông tin.'), { status: 400 });
    }

    // Validate stock and get product details
    const productIds = items.map(i => i.productId);
    const inventory = await db.distributorInventory.findMany({
      where: { distributorId: distId, productId: { in: productIds } },
      include: { product: { select: { id: true, name: true, sku: true, basePrice: true, unit: true, categoryId: true } } },
    });

    const invMap = new Map(inventory.map(i => [i.productId, i]));
    const lineItems = [];
    let subtotal = 0;

    for (const item of items) {
      const inv = invMap.get(item.productId);
      if (!inv || inv.quantity - inv.reservedQty < item.quantity) {
        return NextResponse.json(errorResponse('INSUFFICIENT_STOCK', `Sản phẩm ${inv?.product.name || item.productId} không đủ hàng.`), { status: 400 });
      }
      const lineTotal = inv.product.basePrice * item.quantity;
      lineItems.push({
        productId: item.productId,
        productName: inv.product.name,
        productSku: inv.product.sku,
        unitPrice: inv.product.basePrice,
        quantity: item.quantity,
        totalPrice: lineTotal,
      });
      subtotal += lineTotal;
    }

    // Create POS order (direct sale, no shipment needed)
    const order = await db.order.create({
      data: {
        orderNumber: `POS-${Date.now()}`,
        shopId: shopId || null,
        distributorId: distId,
        status: 'DELIVERED',
        paymentMethod: paymentMethod === 'DEBT' ? 'CREDIT' : paymentMethod,
        paymentStatus: paymentMethod === 'DEBT' ? 'PENDING' : 'PAID',
        subtotalAmount: subtotal,
        totalAmount: subtotal,
        paidAmount: paymentMethod === 'DEBT' ? 0 : subtotal,
        deliveredAt: new Date(),
        fulfilledByDistributorAt: new Date(),
        shopSnapshot: { customerName, customerPhone } as any,
        items: { create: lineItems },
      },
      include: { items: true },
    });

    // Deduct inventory
    for (const item of items) {
      const inv = invMap.get(item.productId)!;
      const prevQty = inv.quantity;
      const newQty = prevQty - item.quantity;
      await db.distributorInventory.update({
        where: { distributorId_productId: { distributorId: distId, productId: item.productId } },
        data: { quantity: newQty, reservedQty: { decrement: Math.min(item.quantity, inv.reservedQty) } },
      });
      await db.inventoryMovement.create({
        data: {
          distributorId: distId,
          productId: item.productId,
          type: 'POS_SALE',
          quantity: -item.quantity,
          previousQty: prevQty,
          newQty,
          reason: `POS sale ${order.orderNumber}`,
          orderId: order.id,
          performedBy: user.userId,
        },
      });
    }

    return NextResponse.json(successResponse({
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      paymentMethod,
      itemCount: lineItems.length,
      items: lineItems,
      createdAt: order.createdAt,
    }));
  } catch (error) {
    console.error('[POS SALE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}