// ALADIN Shop API — Simple List & Search
// GET /api/shops — paginated shop list for order creation

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

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
    const search = searchParams.get('search') || '';
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { user: { phone: { contains: search } } },
      ];
    }

    const shops = await db.shop.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        nameEn: true,
        district: true,
        province: true,
        creditStatus: true,
        creditLimit: true,
        creditBalance: true,
        user: { select: { phone: true, name: true } },
      },
    });

    return NextResponse.json(successResponse({
      items: shops,
    }));
  } catch (error) {
    console.error('[SHOPS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shops'),
      { status: 500 }
    );
  }
}
