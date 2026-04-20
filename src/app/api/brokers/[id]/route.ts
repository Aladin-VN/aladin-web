// ALADIN Broker Detail API
// GET /api/brokers/[id] — Full detail
// PATCH /api/brokers/[id] — Update broker
// DELETE /api/brokers/[id] — Remove broker (keep user)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// GET /api/brokers/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json(successResponse(broker));
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
