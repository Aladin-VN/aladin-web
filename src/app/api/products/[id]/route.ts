// ALADIN Product API — Get, Update, Delete single product
// GET /api/products/[id]
// PUT /api/products/[id]
// DELETE /api/products/[id] (soft delete)
// PATCH /api/products/[id]/toggle — toggle active status

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { sanitizeInput, isValidVNDAmount, successResponse, errorResponse, rateLimit } from '@/lib/security';

// ============================================
// GET /api/products/[id] — Get Single Product
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;

    const product = await db.product.findUnique({
      where: { id },
      include: {
        category: true,
        manufacturer: { select: { id: true, name: true, contactPerson: true, contactPhone: true } },
        distributor: { select: { id: true, name: true, contactPhone: true, address: true } },
        orderItems: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderId: true, quantity: true, unitPrice: true, createdAt: true },
        },
        groupDeals: {
          where: { status: 'ACTIVE' },
          take: 3,
          select: { id: true, title: true, discountPrice: true, expiresAt: true },
        },
      },
    });

    if (!product || product.deletedAt) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Product not found'), { status: 404 });
    }

    return NextResponse.json(successResponse({ product }));
  } catch (error) {
    console.error('[PRODUCT GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch product'), { status: 500 });
  }
}

// ============================================
// PUT /api/products/[id] — Update Product
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const rl = rateLimit(`product:update:${payload.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check product exists
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Product not found'), { status: 404 });
    }

    // Validation
    const errors: string[] = [];
    if (body.sku && body.sku.trim().length < 3) errors.push('SKU must be at least 3 characters');
    if (body.name && body.name.trim().length < 2) errors.push('Product name must be at least 2 characters');
    if (body.basePrice !== undefined && (!isValidVNDAmount(body.basePrice) || body.basePrice < 100)) {
      errors.push('Valid base price is required (min 100 VND)');
    }
    if (body.groupBuyPrice !== undefined && body.groupBuyPrice !== null) {
      const price = body.basePrice || existing.basePrice;
      if (body.groupBuyPrice >= price || body.groupBuyPrice < 100) {
        errors.push('Group buy price must be less than base price and at least 100 VND');
      }
    }

    // SKU uniqueness check (if changed)
    if (body.sku && body.sku.trim() !== existing.sku) {
      const dupSku = await db.product.findUnique({ where: { sku: body.sku.trim() } });
      if (dupSku) errors.push('SKU already exists');
    }

    // Barcode uniqueness check (if changed)
    if (body.barcode && body.barcode !== existing.barcode) {
      const dupBarcode = await db.product.findFirst({ where: { barcode: body.barcode } });
      if (dupBarcode) errors.push('Barcode already exists');
    }

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // Build update data (only include provided fields)
    const updateData: Record<string, unknown> = {};
    const updatableFields = [
      'sku', 'name', 'nameEn', 'description', 'descriptionEn', 'categoryId',
      'brand', 'unit', 'unitEn', 'basePrice', 'groupBuyPrice', 'stockQuantity',
      'minOrderQty', 'maxOrderQty', 'weightKg', 'barcode', 'manufacturerId',
      'distributorId', 'isPrivateLabel', 'imageUrl', 'isActive',
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        if (typeof body[field] === 'string') {
          updateData[field] = sanitizeInput(body[field].trim());
        } else {
          updateData[field] = body[field];
        }
      }
    }

    // Round numeric fields
    if (updateData.basePrice) updateData.basePrice = Math.round(updateData.basePrice as number);
    if (updateData.groupBuyPrice) updateData.groupBuyPrice = Math.round(updateData.groupBuyPrice as number);

    const product = await db.product.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, nameEn: true, slug: true } },
        manufacturer: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(successResponse({ product }));
  } catch (error) {
    console.error('[PRODUCT UPDATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update product'), { status: 500 });
  }
}

// ============================================
// DELETE /api/products/[id] — Soft Delete Product
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const rl = rateLimit(`product:delete:${payload.userId}`, { maxRequests: 10, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const { id } = await params;

    // Check for active orders referencing this product
    const activeOrders = await db.orderItem.count({
      where: {
        productId: id,
        order: { status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY'] } },
      },
    });

    if (activeOrders > 0) {
      return NextResponse.json(
        errorResponse('HAS_ACTIVE_ORDERS', `Cannot delete product with ${activeOrders} active order(s). Deactivate instead.`),
        { status: 409 }
      );
    }

    // Soft delete
    const product = await db.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return NextResponse.json(successResponse({ id: product.id, deleted: true }));
  } catch (error) {
    console.error('[PRODUCT DELETE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to delete product'), { status: 500 });
  }
}

// ============================================
// PATCH /api/products/[id] — Toggle Active Status
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action === 'toggle_active') {
      const product = await db.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) {
        return NextResponse.json(errorResponse('NOT_FOUND', 'Product not found'), { status: 404 });
      }

      const updated = await db.product.update({
        where: { id },
        data: { isActive: !product.isActive },
      });

      return NextResponse.json(successResponse({ id: updated.id, isActive: updated.isActive }));
    }

    return NextResponse.json(errorResponse('INVALID_ACTION', 'Unknown action'), { status: 400 });
  } catch (error) {
    console.error('[PRODUCT PATCH ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update product'), { status: 500 });
  }
}
