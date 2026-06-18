// ALADIN Shop API — Full List with Pagination, Filters & Stats
// Sprint 5A: Shops Management

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { getShopFilter, type AuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, formatVND, ROLES } from '@/lib/security';

// GET /api/shops — paginated shop list with filters (role-filtered)
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

    // Build auth user for role filtering
    const authUser: AuthUser = {
      userId: payload.userId,
      phone: payload.phone,
      name: '',
      role: payload.role,
      shopId: payload.shopId,
    };

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const creditStatus = searchParams.get('creditStatus') || '';
    const loyaltyTier = searchParams.get('loyaltyTier') || '';
    const shopType = searchParams.get('shopType') || '';
    const district = searchParams.get('district') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build WHERE clause — start with role filter
    const roleFilter = getShopFilter(authUser);
    const where: Record<string, unknown> = { deletedAt: null, ...roleFilter };

    if (search) {
      const searchConditions = [
        { name: { contains: search } },
        { nameEn: { contains: search } },
        { address: { contains: search } },
        { district: { contains: search } },
        { user: { phone: { contains: search } } },
        { user: { name: { contains: search } } },
      ];
      // Use AND to preserve role filter's conditions
      if (Object.keys(roleFilter).length > 0) {
        where.AND = [
          roleFilter,
          { OR: searchConditions },
        ];
      } else {
        where.OR = searchConditions;
      }
    }

    if (creditStatus) {
      where.creditStatus = creditStatus;
    }

    if (loyaltyTier) {
      where.loyaltyTier = loyaltyTier;
    }

    if (shopType) {
      where.shopType = shopType;
    }

    if (district) {
      where.district = district;
    }

    // Build ORDER BY
    type SortField = 'createdAt' | 'name' | 'creditLimit' | 'totalGmv' | 'totalOrders' | 'avgOrderValue' | 'creditBalance';
    const validSortFields: SortField[] = ['createdAt', 'name', 'creditLimit', 'totalGmv', 'totalOrders', 'avgOrderValue', 'creditBalance'];
    const sortField: SortField = validSortFields.includes(sortBy as SortField) ? (sortBy as SortField) : 'createdAt';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const orderBy = { [sortField]: orderDir };

    // Parallel queries
    const [shops, total] = await Promise.all([
      db.shop.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          nameEn: true,
          district: true,
          province: true,
          address: true,
          shopType: true,
          loyaltyTier: true,
          creditStatus: true,
          creditLimit: true,
          creditBalance: true,
          totalOrders: true,
          totalGmv: true,
          avgOrderValue: true,
          createdAt: true,
          ward: { select: { id: true, name: true } },
          user: { select: { id: true, phone: true, name: true, status: true, zaloId: true } },
        },
      }),
      db.shop.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Format response with formatted currency values
    const items = shops.map((shop) => ({
      ...shop,
      creditLimitFormatted: formatVND(shop.creditLimit),
      creditBalanceFormatted: formatVND(shop.creditBalance),
      creditAvailable: Math.max(0, shop.creditLimit - shop.creditBalance),
      creditAvailableFormatted: formatVND(Math.max(0, shop.creditLimit - shop.creditBalance)),
      totalGmvFormatted: formatVND(shop.totalGmv),
      avgOrderValueFormatted: formatVND(shop.avgOrderValue),
    }));

    return NextResponse.json(successResponse({
      items,
      pagination: { page, limit, total, totalPages },
    }));
  } catch (error) {
    console.error('[SHOPS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shops'),
      { status: 500 }
    );
  }
}

// GET /api/shops/stats — Aggregate shop statistics
export async function POST(request: NextRequest) {
  // Reserved for future shop creation endpoint
  return NextResponse.json(
    errorResponse('NOT_IMPLEMENTED', 'Use Zalo bot for shop registration'),
    { status: 501 }
  );
}
