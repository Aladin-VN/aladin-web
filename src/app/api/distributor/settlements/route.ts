// GET /api/distributor/settlements — Distributor's settlement history
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Phân quyền nhà phân phối yêu cầu.'), { status: 403 });
    }

    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = { distributorId: distId };
    if (status) where.status = status;

    const [settlements, total] = await Promise.all([
      db.settlement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.settlement.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      items: settlements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR SETTLEMENTS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}