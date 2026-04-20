// ALADIN Broker API
// GET /api/brokers — Paginated list with search, filters
// POST /api/brokers — Create broker

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  rateLimit,
  formatVND,
} from '@/lib/security';

// GET /api/brokers
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
    const tier = searchParams.get('tier') || '';
    const status = searchParams.get('status') || '';
    const wardId = searchParams.get('wardId') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { user: { nameEn: { contains: search } } },
        { user: { phone: { contains: search } } },
        { ward: { name: { contains: search } } },
      ];
    }

    if (tier && ['WARD_LEVEL', 'CATEGORY_SPECIALIST', 'FACTORY_GATE'].includes(tier)) {
      where.tier = tier;
    }

    if (status) {
      where.user = { ...(where.user as Record<string, unknown> || {}), status };
    }

    if (wardId) {
      where.wardId = wardId;
    }

    const [brokers, total] = await Promise.all([
      db.broker.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              name: true,
              nameEn: true,
              email: true,
              status: true,
              avatarUrl: true,
              createdAt: true,
            },
          },
          ward: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              district: true,
              province: true,
            },
          },
        },
      }),
      db.broker.count({ where }),
    ]);

    // Fetch filter options
    const [allWards, tierCounts] = await Promise.all([
      db.ward.findMany({
        select: { id: true, name: true, district: true },
        orderBy: { name: 'asc' },
        take: 50,
      }),
      db.broker.groupBy({
        by: ['tier'],
        _count: { id: true },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(successResponse({
      items: brokers,
      pagination: { page, limit, total, totalPages },
      filters: {
        wards: allWards.map(w => ({ id: w.id, name: w.name, district: w.district })),
        tiers: tierCounts.map(tc => ({ tier: tc.tier, count: tc._count.id })),
      },
    }));
  } catch (error) {
    console.error('[BROKERS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch brokers'),
      { status: 500 }
    );
  }
}

// POST /api/brokers — Create broker
export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin or Sales Rep access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`broker:create:${payload.userId}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const body = await request.json();
    const { userId, tier, wardId, commissionRate } = body;

    // Validation
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'User ID is required'),
        { status: 400 }
      );
    }

    const validTiers = ['WARD_LEVEL', 'CATEGORY_SPECIALIST', 'FACTORY_GATE'];
    if (!tier || !validTiers.includes(tier)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Tier must be one of: ${validTiers.join(', ')}`),
        { status: 400 }
      );
    }

    // Check user exists
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'User not found'),
        { status: 404 }
      );
    }

    // Check user doesn't already have a broker
    const existingBroker = await db.broker.findUnique({ where: { userId } });
    if (existingBroker) {
      return NextResponse.json(
        errorResponse('DUPLICATE', 'This user already has a broker profile'),
        { status: 409 }
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

    const rate = commissionRate !== undefined ? parseFloat(commissionRate) : 0.03;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Commission rate must be between 0 and 1 (e.g., 0.03 = 3%)'),
        { status: 400 }
      );
    }

    const broker = await db.broker.create({
      data: {
        userId,
        tier,
        wardId: wardId || null,
        commissionRate: rate,
      },
      include: {
        user: {
          select: { id: true, phone: true, name: true, nameEn: true, email: true, status: true },
        },
        ward: {
          select: { id: true, name: true, nameEn: true, district: true, province: true },
        },
      },
    });

    return NextResponse.json(successResponse(broker), { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        errorResponse('DUPLICATE', 'Broker with this user already exists'),
        { status: 409 }
      );
    }
    console.error('[BROKER CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create broker'),
      { status: 500 }
    );
  }
}
