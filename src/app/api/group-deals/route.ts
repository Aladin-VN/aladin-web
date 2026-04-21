// ALADIN Group Deals API — Full List with Pagination, Filters & Create
// Sprint 5D: Group Buy Engine (Mua Chung)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND, sanitizeInput } from '@/lib/security';

// GET /api/group-deals — paginated group deal list with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const wardId = searchParams.get('wardId') || '';
    const productId = searchParams.get('productId') || '';

    // Build WHERE clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { titleEn: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { sku: { contains: search } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (wardId) {
      where.wardId = wardId;
    }

    if (productId) {
      where.productId = productId;
    }

    // Parallel queries
    const [deals, total] = await Promise.all([
      db.groupDeal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          titleEn: true,
          productId: true,
          targetQty: true,
          currentQty: true,
          originalPrice: true,
          discountPrice: true,
          maxParticipants: true,
          startsAt: true,
          expiresAt: true,
          wardId: true,
          status: true,
          createdAt: true,
          product: { select: { id: true, name: true, sku: true, basePrice: true } },
          ward: { select: { id: true, name: true, district: true } },
          _count: { select: { participants: true } },
        },
      }),
      db.groupDeal.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const now = new Date();

    const items = deals.map((deal) => {
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

      return {
        ...deal,
        progressPercent,
        savingsPercent,
        savingsPerUnit,
        savingsPerUnitFormatted: formatVND(savingsPerUnit),
        originalPriceFormatted: formatVND(deal.originalPrice),
        discountPriceFormatted: formatVND(deal.discountPrice),
        timeRemaining,
        participantCount: deal._count.participants,
      };
    });

    // Get wards and products for filter dropdowns
    const [wards, products] = await Promise.all([
      db.ward.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      db.product.findMany({
        select: { id: true, name: true, sku: true },
        orderBy: { name: 'asc' },
        where: { isActive: true },
      }),
    ]);

    return NextResponse.json(successResponse({
      items,
      pagination: { page, limit, total, totalPages },
      filters: { wards, products },
    }));
  } catch (error) {
    console.error('[GROUP DEALS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch group deals'),
      { status: 500 }
    );
  }
}

// POST /api/group-deals — Create new group deal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title, titleEn, description, productId, targetQty,
      originalPrice, discountPrice, startsAt, expiresAt,
      wardId, maxParticipants,
    } = body;

    // Validation
    if (!title || !productId || !targetQty || !originalPrice || !discountPrice || !startsAt || !expiresAt) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Missing required fields: title, productId, targetQty, originalPrice, discountPrice, startsAt, expiresAt'),
        { status: 400 }
      );
    }

    // Validate target quantity
    if (targetQty <= 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'targetQty must be a positive number'),
        { status: 400 }
      );
    }

    // Validate discount < original
    if (discountPrice >= originalPrice) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'discountPrice must be less than originalPrice'),
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(startsAt);
    const expiryDate = new Date(expiresAt);
    const now = new Date();

    if (expiryDate <= startDate) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'expiresAt must be after startsAt'),
        { status: 400 }
      );
    }

    if (startDate < now) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'startsAt must be in the future'),
        { status: 400 }
      );
    }

    // Check product exists
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Product not found'),
        { status: 404 }
      );
    }

    // Check ward exists if provided
    if (wardId) {
      const ward = await db.ward.findUnique({ where: { id: wardId } });
      if (!ward) {
        return NextResponse.json(
          errorResponse('NOT_FOUND', 'Ward not found'),
          { status: 404 }
        );
      }
    }

    // Create group deal and update product.groupBuyPrice in transaction
    const deal = await db.$transaction(async (tx) => {
      const newDeal = await tx.groupDeal.create({
        data: {
          title: sanitizeInput(title),
          titleEn: titleEn ? sanitizeInput(titleEn) : null,
          description: description ? sanitizeInput(description) : null,
          productId,
          targetQty,
          originalPrice,
          discountPrice,
          startsAt: startDate,
          expiresAt: expiryDate,
          wardId: wardId || null,
          maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, basePrice: true } },
          ward: { select: { id: true, name: true, district: true } },
        },
      });

      // Set product.groupBuyPrice = discountPrice
      await tx.product.update({
        where: { id: productId },
        data: { groupBuyPrice: discountPrice },
      });

      return newDeal;
    });

    return NextResponse.json(successResponse(deal), { status: 201 });
  } catch (error) {
    console.error('[GROUP DEAL CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create group deal'),
      { status: 500 }
    );
  }
}
