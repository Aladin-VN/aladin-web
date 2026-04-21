// ALADIN Merchandising Audits API — List with pagination & filters
// Sprint 5C: Promotions & Trade Marketing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

// GET /api/merchandising — paginated audit list
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
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build WHERE clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { shop: { name: { contains: search } } },
        { shop: { user: { name: { contains: search } } } },
        { shop: { district: { contains: search } } },
        { reviewNotes: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    // Build ORDER BY
    type SortField = 'createdAt' | 'reviewedAt' | 'status';
    const validSortFields: SortField[] = ['createdAt', 'reviewedAt', 'status'];
    const sortField: SortField = validSortFields.includes(sortBy as SortField) ? (sortBy as SortField) : 'createdAt';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const [audits, total] = await Promise.all([
      db.merchandisingAudit.findMany({
        where,
        orderBy: { [sortField]: orderDir },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          photoUrl: true,
          status: true,
          reviewNotes: true,
          reviewedAt: true,
          createdAt: true,
          shopId: true,
          productId: true,
          promotionId: true,
          reviewerId: true,
          shop: {
            select: { id: true, name: true, district: true, shopType: true },
          },
          product: {
            select: { id: true, name: true, sku: true, imageUrl: true },
          },
          promotion: {
            select: { id: true, title: true, promoType: true },
          },
        },
      }),
      db.merchandisingAudit.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(successResponse({
      items: audits,
      pagination: { page, limit, total, totalPages },
    }));
  } catch (error) {
    console.error('[MERCHANDISING LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch merchandising audits'),
      { status: 500 }
    );
  }
}
