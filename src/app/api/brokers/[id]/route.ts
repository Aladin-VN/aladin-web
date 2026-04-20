// ALADIN Broker Detail API
// GET /api/brokers/[id] — Full detail with referred shops
// PATCH /api/brokers/[id] — Update broker
// DELETE /api/brokers/[id] — Remove broker (keep user)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

// GET /api/brokers/[id]
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

    const broker = await db.broker.findUnique({
      where: { id },
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
            zaloId: true,
            createdAt: true,
            lastLoginAt: true,
            shop: {
              select: {
                id: true,
                name: true,
                district: true,
                province: true,
              },
            },
          },
        },
        ward: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            district: true,
            province: true,
            shopCount: true,
          },
        },
      },
    });

    if (!broker) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Broker not found'), { status: 404 });
    }

    // Fetch referred shops (shops in the same ward as broker, created after broker)
    let referredShops: unknown[] = [];
    if (broker.wardId) {
      referredShops = await db.shop.findMany({
        where: {
          wardId: broker.wardId,
          createdAt: { gte: broker.createdAt },
        },
        select: {
          id: true,
          name: true,
          district: true,
          province: true,
          loyaltyTier: true,
          totalOrders: true,
          totalGmv: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
    }

    return NextResponse.json(successResponse({
      ...broker,
      referredShops,
    }));
  } catch (error) {
    console.error('[BROKER DETAIL ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch broker'), { status: 500 });
  }
}

// PATCH /api/brokers/[id]
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
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin or Sales Rep access required'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { tier, wardId, commissionRate } = body;

    // Validate broker exists
    const existing = await db.broker.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Broker not found'), { status: 404 });
    }

    // Validate tier if provided
    if (tier !== undefined) {
      const validTiers = ['WARD_LEVEL', 'CATEGORY_SPECIALIST', 'FACTORY_GATE'];
      if (!validTiers.includes(tier)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', `Tier must be one of: ${validTiers.join(', ')}`),
          { status: 400 }
        );
      }
    }

    // Validate ward if provided
    if (wardId !== undefined && wardId !== null) {
      const ward = await db.ward.findUnique({ where: { id: wardId } });
      if (!ward) {
        return NextResponse.json(errorResponse('NOT_FOUND', 'Ward not found'), { status: 404 });
      }
    }

    // Validate commission rate
    if (commissionRate !== undefined) {
      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Commission rate must be between 0 and 1'),
          { status: 400 }
        );
      }
    }

    const updated = await db.broker.update({
      where: { id },
      data: {
        ...(tier !== undefined ? { tier } : {}),
        ...(wardId !== undefined ? { wardId: wardId || null } : {}),
        ...(commissionRate !== undefined ? { commissionRate: parseFloat(commissionRate) } : {}),
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

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    console.error('[BROKER UPDATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update broker'), { status: 500 });
  }
}

// DELETE /api/brokers/[id] — Remove broker (keep user)
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

    const { id } = await params;

    const existing = await db.broker.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Broker not found'), { status: 404 });
    }

    // Delete broker but keep user record
    await db.broker.delete({ where: { id } });

    return NextResponse.json(successResponse({ id }));
  } catch (error) {
    console.error('[BROKER DELETE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to delete broker'), { status: 500 });
  }
}
