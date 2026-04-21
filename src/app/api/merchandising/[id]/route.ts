// ALADIN Merchandising Audit Detail API — Get & Review
// Sprint 5C: Promotions & Trade Marketing

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, sanitizeInput } from '@/lib/security';

// GET /api/merchandising/[id] — Full audit detail
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

    const audit = await db.merchandisingAudit.findUnique({
      where: { id },
      include: {
        shop: {
          select: { id: true, name: true, district: true, province: true, shopType: true, loyaltyTier: true },
        },
        product: {
          select: { id: true, name: true, sku: true, basePrice: true, imageUrl: true, category: { select: { name: true } } },
        },
        promotion: {
          select: { id: true, title: true, promoType: true, manufacturer: { select: { name: true } } },
        },
      },
    });

    if (!audit) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Audit not found'), { status: 404 });
    }

    return NextResponse.json(successResponse(audit));
  } catch (error) {
    console.error('[MERCHANDISING DETAIL ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch audit'),
      { status: 500 }
    );
  }
}

// PATCH /api/merchandising/[id] — Review audit (approve/reject)
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
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, reviewNotes } = body;

    // Validate status
    const validStatuses = ['PENDING_REVIEW', 'APPROVED', 'REJECTED'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Status must be one of: ${validStatuses.join(', ')}`),
        { status: 400 }
      );
    }

    // Check audit exists
    const existing = await db.merchandisingAudit.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Audit not found'), { status: 404 });
    }

    // Update audit
    const audit = await db.merchandisingAudit.update({
      where: { id },
      data: {
        status,
        reviewNotes: reviewNotes ? sanitizeInput(reviewNotes) : null,
        reviewerId: payload.userId,
        reviewedAt: status !== 'PENDING_REVIEW' ? new Date() : null,
      },
      include: {
        shop: { select: { name: true } },
        product: { select: { name: true } },
        promotion: { select: { title: true } },
      },
    });

    return NextResponse.json(successResponse(audit));
  } catch (error) {
    console.error('[MERCHANDISING UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update audit'),
      { status: 500 }
    );
  }
}
