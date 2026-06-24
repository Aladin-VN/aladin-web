// GET /api/distributor/inventory/movements — Inventory movement history
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', ''), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const type = searchParams.get('type') || undefined;
    const search = searchParams.get('search') || undefined;

    const where: Record<string, unknown> = { distributorId: distId };
    if (type) (where as any).type = type;
    if (search) {
      (where as any).product = { name: { contains: search, mode: 'insensitive' } };
    }

    const [items, total] = await Promise.all([
      db.inventoryMovement.findMany({
        where,
        include: {
          product: { select: { name: true, sku: true, category: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.inventoryMovement.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      items: items.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product?.name || '',
        productSku: m.product?.sku || '',
        category: (m.product?.category as any)?.name || '',
        type: m.type,
        quantity: m.quantity,
        previousQty: m.previousQty,
        newQty: m.newQty,
        reason: m.reason,
        orderId: m.orderId,
        performedBy: m.performedBy,
        createdAt: m.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('[INVENTORY MOVEMENTS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}