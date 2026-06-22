// ALADIN Distributor API
// Sprint 5B: Distributor CRUD

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

// GET /api/distributors — List all distributors
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
    const status = searchParams.get('status') || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameEn: { contains: search } },
        { contactPerson: { contains: search } },
        { address: { contains: search } },
      ];
    }
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [distributors, total] = await Promise.all([
      db.distributor.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { products: true } },
        },
      }),
      db.distributor.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(successResponse({
      items: distributors,
      pagination: { page, limit, total, totalPages },
    }));
  } catch (error) {
    console.error('[DISTRIBUTORS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch distributors'),
      { status: 500 }
    );
  }
}

// POST /api/distributors — Create distributor (ADMIN only)
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
    if (!hasRole(payload, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const body = await request.json();
    const { name, nameEn, contactPerson, contactPhone, email, address, lat, lng,
            bankName, bankAccount, bankHolder, taxId, commissionRate, deliveryFeeShare } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Distributor name is required (min 2 characters)'),
        { status: 400 }
      );
    }

    if (lat !== undefined && (isNaN(parseFloat(lat)) || parseFloat(lat) < -90 || parseFloat(lat) > 90)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Latitude must be between -90 and 90'),
        { status: 400 }
      );
    }

    if (lng !== undefined && (isNaN(parseFloat(lng)) || parseFloat(lng) < -180 || parseFloat(lng) > 180)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Longitude must be between -180 and 180'),
        { status: 400 }
      );
    }

    // Validate commission rate (0 to 1)
    let parsedCommissionRate = 0.03; // default 3%
    if (commissionRate !== undefined) {
      parsedCommissionRate = parseFloat(commissionRate);
      if (isNaN(parsedCommissionRate) || parsedCommissionRate < 0 || parsedCommissionRate > 1) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Commission rate must be between 0 and 1 (e.g. 0.03 for 3%)'),
          { status: 400 }
        );
      }
    }

    // Validate delivery fee share (0 to 1)
    let parsedDeliveryFeeShare = 0.5; // default 50%
    if (deliveryFeeShare !== undefined) {
      parsedDeliveryFeeShare = parseFloat(deliveryFeeShare);
      if (isNaN(parsedDeliveryFeeShare) || parsedDeliveryFeeShare < 0 || parsedDeliveryFeeShare > 1) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Delivery fee share must be between 0 and 1'),
          { status: 400 }
        );
      }
    }

    const distributor = await db.distributor.create({
      data: {
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        lat: lat !== undefined ? parseFloat(lat) : null,
        lng: lng !== undefined ? parseFloat(lng) : null,
        bankName: bankName?.trim() || null,
        bankAccount: bankAccount?.trim() || null,
        bankHolder: bankHolder?.trim() || null,
        taxId: taxId?.trim() || null,
        commissionRate: parsedCommissionRate,
        deliveryFeeShare: parsedDeliveryFeeShare,
        isActive: true,
      },
    });

    return NextResponse.json(successResponse(distributor), { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        errorResponse('DUPLICATE', 'Distributor with this name already exists'),
        { status: 409 }
      );
    }
    console.error('[DISTRIBUTOR CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create distributor'),
      { status: 500 }
    );
  }
}
