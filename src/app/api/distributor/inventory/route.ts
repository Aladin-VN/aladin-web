// GET /api/distributor/inventory — List distributor's inventory
// POST /api/distributor/inventory — Stock adjustment (RECEIPT / ADJUSTMENT)
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
    const search = searchParams.get('search');
    const lowStock = searchParams.get('lowStock') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = { distributorId: distId };
    if (search) {
      where.product = { name: { contains: search, mode: 'insensitive' } };
    }
    if (lowStock) {
      where.quantity = { lte: db.distributorInventory.fields.minStockLevel };
    }

    const [inventory, total] = await Promise.all([
      db.distributorInventory.findMany({
        where,
        include: {
          product: {
            select: { name: true, sku: true, basePrice: true, category: { select: { name: true } } },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.distributorInventory.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      items: inventory.map((inv) => ({
        id: inv.id,
        productId: inv.productId,
        productName: inv.product.name,
        productSku: inv.product.sku,
        quantity: inv.quantity,
        reservedQty: inv.reservedQty,
        availableQty: inv.quantity - inv.reservedQty,
        minStockLevel: inv.minStockLevel,
        isLowStock: inv.quantity <= inv.minStockLevel,
        costPrice: inv.costPrice,
        basePrice: inv.product.basePrice,
        category: inv.product.category.name,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR INVENTORY GET ERROR]', error);
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
    const { productId, type, quantity, reason, costPrice } = body as {
      productId: string; type: string; quantity: number; reason?: string; costPrice?: number;
    };

    if (!productId || !type || !quantity || quantity <= 0) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Thiếu thông tin bắt buộc.'), { status: 400 });
    }
    if (!['RECEIPT', 'ADJUSTMENT', 'DAMAGE'].includes(type)) {
      return NextResponse.json(errorResponse('INVALID_TYPE', 'Loại điều chỉnh không hợp lệ.'), { status: 400 });
    }

    // For DAMAGE: decrement stock
    if (type === 'DAMAGE') {
      const inv = await db.distributorInventory.findUnique({
        where: { distributorId_productId: { distributorId: distId, productId } },
      });
      if (!inv || inv.quantity < quantity) {
        return NextResponse.json(errorResponse('INSUFFICIENT_STOCK', 'Tồn kho không đủ.'), { status: 400 });
      }
      const updated = await db.distributorInventory.update({
        where: { distributorId_productId: { distributorId: distId, productId } },
        data: { quantity: { decrement: quantity } },
      });

      await db.inventoryMovement.create({
        data: {
          distributorId: distId,
          productId,
          type: 'DAMAGE',
          quantity: -quantity,
          previousQty: inv.quantity,
          newQty: updated.quantity,
          reason: sanitizeInput(reason || `Hư hỏng -${quantity}`),
          performedBy: user.userId,
        },
      });

      return NextResponse.json(successResponse({
        id: updated.id,
        quantity: updated.quantity,
        availableQty: updated.quantity - updated.reservedQty,
      }));
    }

    // Upsert inventory (RECEIPT / ADJUSTMENT)
    const inv = await db.distributorInventory.upsert({
      where: { distributorId_productId: { distributorId: distId, productId } },
      create: {
        distributorId: distId,
        productId,
        quantity: type === 'RECEIPT' ? quantity : 0,
        reservedQty: 0,
        minStockLevel: 20,
        costPrice: costPrice ?? null,
      },
      update: {
        quantity: { increment: quantity },
        ...(costPrice != null ? { costPrice } : {}),
      },
    });

    // Create movement record
    const prevQty = inv.quantity - (type === 'RECEIPT' ? quantity : 0);
    await db.inventoryMovement.create({
      data: {
        distributorId: distId,
        productId,
        type,
        quantity,
        previousQty: Math.max(0, prevQty),
        newQty: inv.quantity,
        reason: sanitizeInput(reason || `${type === 'RECEIPT' ? 'Nhập kho' : 'Điều chỉnh'} +${quantity}`),
        performedBy: user.userId,
      },
    });

    return NextResponse.json(successResponse({
      id: inv.id,
      quantity: inv.quantity,
      availableQty: inv.quantity - inv.reservedQty,
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR INVENTORY POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}