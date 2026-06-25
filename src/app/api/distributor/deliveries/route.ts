// GET /api/distributor/deliveries — List distributor's delivery-trackable orders
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

const DELIVERY_STATUSES = ['PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

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

    const where: Record<string, unknown> = {
      distributorId: distId,
      status: { in: DELIVERY_STATUSES },
    };

    // If a specific status filter is requested, narrow down within delivery statuses
    if (status && DELIVERY_STATUSES.includes(status)) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          shop: {
            select: {
              name: true,
              district: true,
              province: true,
              address: true,
              phone: true,
            },
          },
          shipment: true,
          items: {
            select: {
              productName: true,
              quantity: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      items: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        shopName: o.shop?.name ?? '',
        shopDistrict: o.shop?.district ?? '',
        shopAddress: o.shop?.address ?? '',
        shopPhone: o.shop?.phone ?? '',
        itemCount: o.items.length,
        totalAmount: o.totalAmount,
        shipmentStatus: o.shipment?.status ?? null,
        deliveredAt: o.deliveredAt,
        packedAt: o.packedAt,
        fulfilledByDistributorAt: o.fulfilledByDistributorAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR DELIVERIES ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}