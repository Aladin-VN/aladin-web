// ALADIN Promotions API — Full List with Pagination, Filters & Create
// Sprint 5C: Promotions & Trade Marketing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND, sanitizeInput } from '@/lib/security';

// GET /api/promotions — paginated promotion list with filters
export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const promoType = searchParams.get('promoType') || '';
    const manufacturerId = searchParams.get('manufacturerId') || '';
    const isActive = searchParams.get('isActive') || '';
    const status = searchParams.get('status') || ''; // active, expired, upcoming
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build WHERE clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { titleEn: { contains: search } },
        { description: { contains: search } },
        { manufacturer: { name: { contains: search } } },
      ];
    }

    if (promoType) {
      where.promoType = promoType;
    }

    if (manufacturerId) {
      where.manufacturerId = manufacturerId;
    }

    if (isActive === 'true') {
      where.isActive = true;
    } else if (isActive === 'false') {
      where.isActive = false;
    }

    // Status filter based on dates
    if (status === 'active') {
      where.isActive = true;
      where.startsAt = { lte: new Date() };
      where.expiresAt = { gte: new Date() };
    } else if (status === 'expired') {
      where.expiresAt = { lt: new Date() };
    } else if (status === 'upcoming') {
      where.startsAt = { gt: new Date() };
    }

    // Build ORDER BY
    type SortField = 'createdAt' | 'title' | 'startsAt' | 'expiresAt' | 'totalRedemptions' | 'usedBudget';
    const validSortFields: SortField[] = ['createdAt', 'title', 'startsAt', 'expiresAt', 'totalRedemptions', 'usedBudget'];
    const sortField: SortField = validSortFields.includes(sortBy as SortField) ? (sortBy as SortField) : 'createdAt';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    // Parallel queries
    const [promotions, total] = await Promise.all([
      db.promotion.findMany({
        where,
        orderBy: { [sortField]: orderDir },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          titleEn: true,
          promoType: true,
          buyQty: true,
          getQty: true,
          discountPercent: true,
          discountAmount: true,
          startsAt: true,
          expiresAt: true,
          totalBudget: true,
          usedBudget: true,
          totalRedemptions: true,
          isActive: true,
          createdAt: true,
          manufacturer: { select: { id: true, name: true } },
          _count: { select: { items: true, orderItems: true } },
        },
      }),
      db.promotion.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    const now = new Date();

    // Compute derived status and budget percentage
    const items = promotions.map((promo) => {
      const startDate = new Date(promo.startsAt);
      const expiryDate = new Date(promo.expiresAt);

      let computedStatus: 'upcoming' | 'active' | 'expired' = 'active';
      if (expiryDate < now) computedStatus = 'expired';
      else if (startDate > now) computedStatus = 'upcoming';
      else if (!promo.isActive) computedStatus = 'expired';

      const budgetPercent = promo.totalBudget ? Math.round((promo.usedBudget / promo.totalBudget) * 100) : 0;
      const budgetRemaining = promo.totalBudget ? promo.totalBudget - promo.usedBudget : 0;

      return {
        ...promo,
        computedStatus,
        budgetPercent,
        budgetRemaining,
        budgetRemainingFormatted: formatVND(budgetRemaining),
        usedBudgetFormatted: formatVND(promo.usedBudget),
        totalBudgetFormatted: promo.totalBudget ? formatVND(promo.totalBudget) : null,
        productCount: promo._count.items,
        orderItemCount: promo._count.orderItems,
      };
    });

    // Also get manufacturers for filter dropdown
    const manufacturers = await db.manufacturer.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(successResponse({
      items,
      pagination: { page, limit, total, totalPages },
      filters: { manufacturers },
    }));
  } catch (error) {
    console.error('[PROMOTIONS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch promotions'),
      { status: 500 }
    );
  }
}

// POST /api/promotions — Create new promotion
export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const body = await request.json();
    const { title, titleEn, description, manufacturerId, promoType, buyQty, getQty, discountPercent, discountAmount, startsAt, expiresAt, totalBudget, productIds } = body;

    // Validation
    if (!title || !manufacturerId || !promoType || !startsAt || !expiresAt) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Missing required fields: title, manufacturerId, promoType, startsAt, expiresAt'),
        { status: 400 }
      );
    }

    // Validate promoType
    const validTypes = ['BUY_X_GET_Y', 'PERCENT_OFF', 'FIXED_DISCOUNT'];
    if (!validTypes.includes(promoType)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `promoType must be one of: ${validTypes.join(', ')}`),
        { status: 400 }
      );
    }

    // Type-specific validation
    if (promoType === 'BUY_X_GET_Y' && (!buyQty || !getQty)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'buyQty and getQty are required for BUY_X_GET_Y'),
        { status: 400 }
      );
    }

    if (promoType === 'PERCENT_OFF' && (discountPercent == null || discountPercent <= 0 || discountPercent > 100)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'discountPercent must be between 0 and 100'),
        { status: 400 }
      );
    }

    if (promoType === 'FIXED_DISCOUNT' && (!discountAmount || discountAmount <= 0)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'discountAmount must be a positive number'),
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(startsAt);
    const expiryDate = new Date(expiresAt);
    if (expiryDate <= startDate) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'expiresAt must be after startsAt'),
        { status: 400 }
      );
    }

    // Check manufacturer exists
    const manufacturer = await db.manufacturer.findUnique({ where: { id: manufacturerId } });
    if (!manufacturer) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Manufacturer not found'),
        { status: 404 }
      );
    }

    // Create promotion with items
    const promotion = await db.promotion.create({
      data: {
        title: sanitizeInput(title),
        titleEn: titleEn ? sanitizeInput(titleEn) : null,
        description: description ? sanitizeInput(description) : null,
        manufacturerId,
        promoType,
        buyQty: promoType === 'BUY_X_GET_Y' ? buyQty : null,
        getQty: promoType === 'BUY_X_GET_Y' ? getQty : null,
        discountPercent: promoType === 'PERCENT_OFF' ? discountPercent : null,
        discountAmount: promoType === 'FIXED_DISCOUNT' ? discountAmount : null,
        startsAt: startDate,
        expiresAt: expiryDate,
        totalBudget: totalBudget ? parseInt(totalBudget) : null,
        items: productIds && productIds.length > 0 ? {
          create: productIds.map((productId: string) => ({ productId })),
        } : undefined,
      },
      include: {
        manufacturer: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    return NextResponse.json(successResponse(promotion), { status: 201 });
  } catch (error) {
    console.error('[PROMOTION CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create promotion'),
      { status: 500 }
    );
  }
}
