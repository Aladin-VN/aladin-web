// ALADIN Manufacturer API
// Sprint 5B: Manufacturer CRUD

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

// GET /api/manufacturers — List all manufacturers
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameEn: { contains: search } },
        { contactPerson: { contains: search } },
        { province: { contains: search } },
      ];
    }

    const [manufacturers, total] = await Promise.all([
      db.manufacturer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { products: true, promotions: true } },
        },
      }),
      db.manufacturer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json(successResponse({
      items: manufacturers,
      pagination: { page, limit, total, totalPages },
    }));
  } catch (error) {
    console.error('[MANUFACTURERS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch manufacturers'),
      { status: 500 }
    );
  }
}

// POST /api/manufacturers — Create manufacturer (ADMIN only)
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
    const { name, nameEn, contactPerson, contactPhone, email, address, province, commissionRate } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Manufacturer name is required (min 2 characters)'),
        { status: 400 }
      );
    }

    const rate = commissionRate !== undefined ? parseFloat(commissionRate) : 0.15;
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Commission rate must be between 0 and 1 (e.g., 0.15 = 15%)'),
        { status: 400 }
      );
    }

    const manufacturer = await db.manufacturer.create({
      data: {
        name: name.trim(),
        nameEn: nameEn?.trim() || null,
        contactPerson: contactPerson?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        province: province?.trim() || null,
        commissionRate: rate,
      },
    });

    return NextResponse.json(successResponse(manufacturer), { status: 201 });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        errorResponse('DUPLICATE', 'Manufacturer with this name already exists'),
        { status: 409 }
      );
    }
    console.error('[MANUFACTURER CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create manufacturer'),
      { status: 500 }
    );
  }
}
