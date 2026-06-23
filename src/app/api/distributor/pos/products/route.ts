// GET /api/distributor/pos/products — Fast POS product search
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
    const q = (searchParams.get('q') || '').trim();
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = { distributorId: distId };
    if (q) {
      where.OR = [
        { product: { name: { contains: q, mode: 'insensitive' } } },
        { product: { sku: { contains: q, mode: 'insensitive' } } },
        { product: { barcode: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const items = await db.distributorInventory.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, basePrice: true, unit: true, imageUrl: true, category: { select: { name: true } } },
        },
      },
      take: limit,
      orderBy: { product: { name: 'asc' } },
    });

    return NextResponse.json(successResponse(items.map(i => ({
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      barcode: i.product.barcode,
      unit: i.product.unit,
      price: i.product.basePrice,
      costPrice: i.costPrice,
      stock: i.quantity,
      available: i.quantity - i.reservedQty,
      category: i.product.category?.name || '',
      imageUrl: i.product.imageUrl,
    }))));
  } catch (error) {
    console.error('[POS PRODUCTS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}