// ALADIN Group Deal Detail API — Get, Update, Delete single group deal
// Sprint 5D: Group Buy Engine (Mua Chung)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND, sanitizeInput } from '@/lib/security';

// GET /api/group-deals/[id] — Full group deal detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deal = await db.groupDeal.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, sku: true, basePrice: true, imageUrl: true, isActive: true } },
        ward: { select: { id: true, name: true, district: true } },
        participants: {
          orderBy: { createdAt: 'desc' },
          include: {
            shop: { select: { id: true, name: true, district: true, loyaltyTier: true } },
          },
        },
        orders: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true },
        },
      },
    });

    if (!deal) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Group deal not found'), { status: 404 });
    }

    const now = new Date();
    const progressPercent = deal.targetQty > 0
      ? Math.min(100, Math.round((deal.currentQty / deal.targetQty) * 100))
      : 0;
    const savingsPercent = deal.originalPrice > 0
      ? Math.round(((deal.originalPrice - deal.discountPrice) / deal.originalPrice) * 100)
      : 0;
    const savingsPerUnit = deal.originalPrice - deal.discountPrice;

    const expiryDate = new Date(deal.expiresAt);
    const msRemaining = expiryDate.getTime() - now.getTime();
    let timeRemaining = '';
    if (msRemaining <= 0) {
      timeRemaining = 'Đã hết hạn';
    } else {
      const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
      const daysRemaining = Math.floor(hoursRemaining / 24);
      if (daysRemaining > 0) {
        timeRemaining = `${daysRemaining} ngày`;
      } else if (hoursRemaining > 0) {
        timeRemaining = `${hoursRemaining} giờ`;
      } else {
        const minsRemaining = Math.floor(msRemaining / (1000 * 60));
        timeRemaining = `${minsRemaining} phút`;
      }
    }

    const totalCommitted = deal.participants
      .filter((p) => p.isActive)
      .reduce((sum, p) => sum + p.committedQty, 0);

    return NextResponse.json(successResponse({
      ...deal,
      progressPercent,
      savingsPercent,
      savingsPerUnit,
      savingsPerUnitFormatted: formatVND(savingsPerUnit),
      originalPriceFormatted: formatVND(deal.originalPrice),
      discountPriceFormatted: formatVND(deal.discountPrice),
      totalPotentialSavings: savingsPerUnit * deal.targetQty,
      totalPotentialSavingsFormatted: formatVND(savingsPerUnit * deal.targetQty),
      timeRemaining,
      participantCount: deal.participants.length,
      activeParticipantCount: deal.participants.filter((p) => p.isActive).length,
      totalCommitted,
      totalCommittedFormatted: formatVND(totalCommitted),
    }));
  } catch (error) {
    console.error('[GROUP DEAL DETAIL ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch group deal'),
      { status: 500 }
    );
  }
}

// PATCH /api/group-deals/[id] — Update group deal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check deal exists
    const existing = await db.groupDeal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Group deal not found'), { status: 404 });
    }

    // Build update data
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = sanitizeInput(body.title);
    if (body.titleEn !== undefined) data.titleEn = body.titleEn ? sanitizeInput(body.titleEn) : null;
    if (body.description !== undefined) data.description = body.description ? sanitizeInput(body.description) : null;
    if (body.targetQty !== undefined) data.targetQty = body.targetQty;
    if (body.discountPrice !== undefined) data.discountPrice = body.discountPrice;
    if (body.maxParticipants !== undefined) data.maxParticipants = body.maxParticipants ? parseInt(body.maxParticipants) : null;
    if (body.expiresAt !== undefined) data.expiresAt = new Date(body.expiresAt);

    // Validate status transition
    if (body.status !== undefined) {
      const validTransitions: Record<string, string[]> = {
        ACTIVE: ['COMPLETED', 'CANCELLED', 'EXPIRED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
      };
      const allowed = validTransitions[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', `Cannot transition from ${existing.status} to ${body.status}`),
          { status: 400 }
        );
      }
      data.status = body.status;
    }

    // Update in transaction (status change may affect product.groupBuyPrice)
    const deal = await db.$transaction(async (tx) => {
      const updated = await tx.groupDeal.update({
        where: { id },
        data,
        include: {
          product: { select: { id: true, name: true, sku: true, basePrice: true } },
          ward: { select: { id: true, name: true, district: true } },
        },
      });

      // When status changes to COMPLETED, set product.groupBuyPrice = discountPrice
      if (body.status === 'COMPLETED') {
        await tx.product.update({
          where: { id: updated.productId },
          data: { groupBuyPrice: updated.discountPrice },
        });
      }

      return updated;
    });

    return NextResponse.json(successResponse(deal));
  } catch (error) {
    console.error('[GROUP DEAL UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update group deal'),
      { status: 500 }
    );
  }
}

// DELETE /api/group-deals/[id] — Delete group deal
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.groupDeal.findUnique({
      where: { id },
      include: { _count: { select: { participants: true, orders: true } } },
    });

    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Group deal not found'), { status: 404 });
    }

    // Check if deal has active participants
    const activeParticipants = await db.groupDealParticipant.count({
      where: { groupDealId: id, isActive: true },
    });
    if (activeParticipants > 0) {
      return NextResponse.json(
        errorResponse('CONFLICT', `This deal has ${activeParticipants} active participant(s) and cannot be deleted. Cancel it instead.`),
        { status: 409 }
      );
    }

    // Delete in transaction — clear product.groupBuyPrice if it matches this deal
    await db.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: existing.productId } });
      if (product && product.groupBuyPrice === existing.discountPrice) {
        await tx.product.update({
          where: { id: existing.productId },
          data: { groupBuyPrice: null },
        });
      }

      await tx.groupDealParticipant.deleteMany({ where: { groupDealId: id } });
      await tx.groupDeal.delete({ where: { id } });
    });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    console.error('[GROUP DEAL DELETE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to delete group deal'),
      { status: 500 }
    );
  }
}
