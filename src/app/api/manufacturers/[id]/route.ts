// ALADIN Manufacturer Detail API
// Sprint 5B: Manufacturer GET/PUT/DELETE

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

// GET /api/manufacturers/[id] — Manufacturer detail with products & promotions
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

    const manufacturer = await db.manufacturer.findUnique({
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
        promotions: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            type: true,
            discountValue: true,
            validFrom: true,
            validTo: true,
            status: true,
          },
        },
        _count: { select: { products: true, promotions: true } },
      },
    });

    if (!manufacturer) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Manufacturer not found'), { status: 404 });
    }

    return NextResponse.json(successResponse(manufacturer));
  } catch (error) {
    console.error('[MANUFACTURER DETAIL ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch manufacturer'), { status: 500 });
  }
}

// PUT /api/manufacturers/[id] — Update manufacturer (ADMIN only)
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
    const { name, nameEn, contactPerson, contactPhone, email, address, province, commissionRate } = body;

    // Validate manufacturer exists
    const existing = await db.manufacturer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Manufacturer not found'), { status: 404 });
    }

    // Validation
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Manufacturer name must be at least 2 characters'),
        { status: 400 }
      );
    }

    if (commissionRate !== undefined) {
      const rate = parseFloat(commissionRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Commission rate must be between 0 and 1'),
          { status: 400 }
        );
      }
    }

    const updated = await db.manufacturer.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(nameEn !== undefined ? { nameEn: nameEn?.trim() || null } : {}),
        ...(contactPerson !== undefined ? { contactPerson: contactPerson?.trim() || null } : {}),
        ...(contactPhone !== undefined ? { contactPhone: contactPhone?.trim() || null } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(province !== undefined ? { province: province?.trim() || null } : {}),
        ...(commissionRate !== undefined ? { commissionRate: parseFloat(commissionRate) } : {}),
      },
    });

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    console.error('[MANUFACTURER UPDATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update manufacturer'), { status: 500 });
  }
}

// DELETE /api/manufacturers/[id] — Delete manufacturer (ADMIN only)
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

    // Check if manufacturer has products
    const productCount = await db.product.count({ where: { manufacturerId: id } });
    if (productCount > 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Cannot delete: ${productCount} product(s) are linked to this manufacturer. Remove the association first.`),
        { status: 400 }
      );
    }

    // Check active promotions
    const activePromotions = await db.promotion.count({
      where: { manufacturerId: id, status: 'ACTIVE' },
    });
    if (activePromotions > 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Cannot delete: ${activePromotions} active promotion(s) are linked to this manufacturer.`),
        { status: 400 }
      );
    }

    await db.manufacturer.delete({ where: { id } });

    return NextResponse.json(successResponse({ id }));
  } catch (error) {
    console.error('[MANUFACTURER DELETE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to delete manufacturer'), { status: 500 });
  }
}
