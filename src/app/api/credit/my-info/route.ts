// ALADIN Credit My-Info API
// GET /api/credit/my-info — Shop owner's own credit summary
// Auto-derives shopId from JWT token

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { getShopCreditInfo } from '@/lib/credit-engine';

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

    // Only SHOP_OWNER can access their own credit info
    if (!hasRole(payload.role, ['SHOP_OWNER'])) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Shop owner access required'),
        { status: 403 }
      );
    }

    // Auto-derive shopId from token
    const shopId = payload.shopId;
    if (!shopId) {
      return NextResponse.json(
        errorResponse('NO_SHOP', 'Tài khoản chưa liên kết cửa hàng. Vui lòng liên hệ quản trị viên.'),
        { status: 400 }
      );
    }

    const creditInfo = await getShopCreditInfo(shopId);

    return NextResponse.json(successResponse(creditInfo));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch credit info';
    console.error('[CREDIT MY-INFO ERROR]', error);

    if (message.includes('not found')) {
      return NextResponse.json(errorResponse('NOT_FOUND', message), { status: 404 });
    }

    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', message),
      { status: 500 }
    );
  }
}
