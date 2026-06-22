// GET /api/distributor/orders — List distributor's orders
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
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = { distributorId: distId };
    if (status) where.status = status;
    if (search) where.orderNumber = { contains: search, mode: 'insensitive' };

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          shop: { select: { name: true, district: true, province: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      items: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        shopName: o.shop?.name ?? '',
        shopDistrict: o.shop?.district,
        shopProvince: o.shop?.province,
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        itemCount: o._count.items,
        createdAt: o.createdAt,
        fulfilledByDistributorAt: o.fulfilledByDistributorAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR ORDERS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}