// ALADIN Sales Rep API — My Assigned Shops
// GET /api/sales-rep/shops?page=&limit=&search=&district=

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.SALES_REP && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Sales Rep or Admin access required'), { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const district = searchParams.get('district') || '';

    // Build WHERE
    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { user: { phone: { contains: search } } },
      ];
    }

    if (district) {
      where.district = { contains: district, mode: 'insensitive' };
    }

    // ADMIN sees all shops; SALES_REP also sees all (territory managed by wards if needed)
    const [shops, total] = await Promise.all([
      db.shop.findMany({
        where,
        select: {
          id: true,
          name: true,
          address: true,
          district: true,
          province: true,
          shopType: true,
          loyaltyTier: true,
          creditStatus: true,
          totalOrders: true,
          totalGmv: true,
          avgOrderValue: true,
          user: { select: { phone: true, name: true } },
          ward: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.shop.count({ where }),
    ]);

    const items = shops.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.user?.phone || '',
      ownerName: s.user?.name || '',
      address: s.address || '',
      district: s.district || '',
      province: s.province,
      wardName: s.ward?.name || '',
      shopType: s.shopType,
      loyaltyTier: s.loyaltyTier,
      creditStatus: s.creditStatus,
      totalOrders: s.totalOrders,
      totalGmv: s.totalGmv,
      avgOrderValue: s.avgOrderValue,
    }));

    return NextResponse.json(
      successResponse(items, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    console.error('[SALES_REP SHOPS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load shops'),
      { status: 500 }
    );
  }
}