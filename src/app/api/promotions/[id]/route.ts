// ALADIN Promotion Detail API — Get, Update, Delete single promotion
// Sprint 5C: Promotions & Trade Marketing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND, sanitizeInput } from '@/lib/security';

// GET /api/promotions/[id] — Full promotion detail
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

    const promotion = await db.promotion.findUnique({
      where: { id },
      include: {
        manufacturer: { select: { id: true, name: true, province: true, commissionRate: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, basePrice: true, imageUrl: true, isActive: true } },
          },
        },
        orderItems: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            order: { select: { id: true, orderNumber: true, status: true, shop: { select: { name: true, district: true } } } },
          },
        },
      },
    });

    if (!promotion) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Promotion not found'), { status: 404 });
    }

    const now = new Date();
    const startDate = new Date(promotion.startsAt);
    const expiryDate = new Date(promotion.expiresAt);

    let computedStatus: 'upcoming' | 'active' | 'expired' = 'active';
    if (expiryDate < now) computedStatus = 'expired';
    else if (startDate > now) computedStatus = 'upcoming';
    else if (!promotion.isActive) computedStatus = 'expired';

    const budgetPercent = promotion.totalBudget ? Math.round((promotion.usedBudget / promotion.totalBudget) * 100) : 0;

    return NextResponse.json(successResponse({
      ...promotion,
      computedStatus,
      budgetPercent,
      budgetRemaining: promotion.totalBudget ? promotion.totalBudget - promotion.usedBudget : 0,
      budgetRemainingFormatted: formatVND(promotion.totalBudget ? promotion.totalBudget - promotion.usedBudget : 0),
      usedBudgetFormatted: formatVND(promotion.usedBudget),
      totalBudgetFormatted: promotion.totalBudget ? formatVND(promotion.totalBudget) : null,
      manufacturerCommissionRate: promotion.manufacturer.commissionRate,
    }));
  } catch (error) {
    console.error('[PROMOTION DETAIL ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch promotion'),
      { status: 500 }
    );
  }
}

// PATCH /api/promotions/[id] — Update promotion
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
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check promotion exists
    const existing = await db.promotion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Promotion not found'), { status: 404 });
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = sanitizeInput(body.title);
    if (body.titleEn !== undefined) data.titleEn = body.titleEn ? sanitizeInput(body.titleEn) : null;
    if (body.description !== undefined) data.description = body.description ? sanitizeInput(body.description) : null;
    if (body.promoType !== undefined) data.promoType = body.promoType;
    if (body.buyQty !== undefined) data.buyQty = body.buyQty;
    if (body.getQty !== undefined) data.getQty = body.getQty;
    if (body.discountPercent !== undefined) data.discountPercent = body.discountPercent;
    if (body.discountAmount !== undefined) data.discountAmount = body.discountAmount;
    if (body.startsAt !== undefined) data.startsAt = new Date(body.startsAt);
    if (body.expiresAt !== undefined) data.expiresAt = new Date(body.expiresAt);
    if (body.totalBudget !== undefined) data.totalBudget = body.totalBudget ? parseInt(body.totalBudget) : null;
    if (body.isActive !== undefined) data.isActive = body.isActive;

    // Update product items if provided
    if (body.productIds !== undefined) {
      // Delete existing items and recreate
      await db.promotionItem.deleteMany({ where: { promotionId: id } });
      if (body.productIds.length > 0) {
        await db.promotionItem.createMany({
          data: body.productIds.map((productId: string) => ({ promotionId: id, productId })),
        });
      }
    }

    const promotion = await db.promotion.update({
      where: { id },
      data,
      include: {
        manufacturer: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    return NextResponse.json(successResponse(promotion));
  } catch (error) {
    console.error('[PROMOTION UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update promotion'),
      { status: 500 }
    );
  }
}

// DELETE /api/promotions/[id] — Delete promotion
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
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;

    const existing = await db.promotion.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });

    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Promotion not found'), { status: 404 });
    }

    // Check if promotion has been applied to orders
    if (existing._count.orderItems > 0) {
      return NextResponse.json(
        errorResponse('CONFLICT', `This promotion has been applied to ${existing._count.orderItems} order(s) and cannot be deleted. Deactivate it instead.`),
        { status: 409 }
      );
    }

    // Delete promotion items first
    await db.promotionItem.deleteMany({ where: { promotionId: id } });
    await db.promotion.delete({ where: { id } });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    console.error('[PROMOTION DELETE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to delete promotion'),
      { status: 500 }
    );
  }
}
