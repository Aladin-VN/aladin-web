// ALADIN Distributor Detail API
// Sprint 5B: Distributor GET/PUT/DELETE

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

// GET /api/distributors/[id] — Distributor detail with products
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

    const distributor = await db.distributor.findUnique({
      where: { id },
      include: {
        products: {
          take: 50,
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            basePrice: true,
            stockQuantity: true,
            isActive: true,
            category: { select: { name: true } },
          },
        },
        _count: { select: { products: true } },
      },
    });

    if (!distributor) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Distributor not found'), { status: 404 });
    }

    return NextResponse.json(successResponse(distributor));
  } catch (error) {
    console.error('[DISTRIBUTOR DETAIL ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch distributor'), { status: 500 });
  }
}

// PUT /api/distributors/[id] — Update distributor (ADMIN only)
export async function PUT(
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
    if (!hasRole(payload, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, nameEn, contactPerson, contactPhone, email, address, lat, lng, isActive } = body;

    // Validate distributor exists
    const existing = await db.distributor.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Distributor not found'), { status: 404 });
    }

    // Validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Distributor name must be at least 2 characters'),
        { status: 400 }
      );
    }

    if (lat !== undefined) {
      const latVal = parseFloat(lat);
      if (isNaN(latVal) || latVal < -90 || latVal > 90) {
        return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Latitude must be between -90 and 90'), { status: 400 });
      }
    }

    if (lng !== undefined) {
      const lngVal = parseFloat(lng);
      if (isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
        return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Longitude must be between -180 and 180'), { status: 400 });
      }
    }

    const updated = await db.distributor.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(nameEn !== undefined ? { nameEn: nameEn?.trim() || null } : {}),
        ...(contactPerson !== undefined ? { contactPerson: contactPerson?.trim() || null } : {}),
        ...(contactPhone !== undefined ? { contactPhone: contactPhone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(lat !== undefined ? { lat: parseFloat(lat) } : {}),
        ...(lng !== undefined ? { lng: parseFloat(lng) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    console.error('[DISTRIBUTOR UPDATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update distributor'), { status: 500 });
  }
}

// DELETE /api/distributors/[id] — Delete distributor (ADMIN only)
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
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }
    if (!hasRole(payload, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;

    // Check if distributor has products
    const productCount = await db.product.count({ where: { distributorId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Cannot delete: ${productCount} product(s) are linked to this distributor. Remove the association first.`),
        { status: 400 }
      );
    }

    await db.distributor.delete({ where: { id } });

    return NextResponse.json(successResponse({ id }));
  } catch (error) {
    console.error('[DISTRIBUTOR DELETE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to delete distributor'), { status: 500 });
  }
}
