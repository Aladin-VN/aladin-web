// POST /api/distributor/pos/receipt — Get receipt data for a sale
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as { orderId?: string; orderNumber?: string };
    const { orderId, orderNumber } = body;

    if (!orderId && !orderNumber) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Thiếu thông tin hóa đơn.'), { status: 400 });
    }

    // Find the order — POS orders are stored as regular Orders with orderNumber starting with 'POS-'
    const order = await db.order.findFirst({
      where: {
        id: orderId || undefined,
        orderNumber: orderNumber || undefined,
        distributorId: distId,
      },
      include: {
        items: true,
        shop: { select: { name: true, address: true, district: true, province: true } },
      },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy hóa đơn.'), { status: 404 });
    }

    // Get distributor info
    const distributor = await db.distributor.findUnique({
      where: { id: distId },
      select: { name: true, address: true, contactPhone: true, taxId: true },
    });

    // Parse shop snapshot for walk-in customer info
    let customerName: string | undefined;
    let customerPhone: string | undefined;
    try {
      const snapshot = typeof order.shopSnapshot === 'string' ? JSON.parse(order.shopSnapshot) : order.shopSnapshot;
      customerName = snapshot?.customerName;
      customerPhone = snapshot?.customerPhone;
    } catch { /* ignore parse errors */ }

    return NextResponse.json(
      successResponse({
        receipt: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          saleDate: order.createdAt,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          customerName: customerName || order.shop?.name || '',
          customerPhone: customerPhone || '',
          shopAddress: order.shop?.address || '',
          items: order.items.map((item) => ({
            productName: item.productName,
            productSku: item.productSku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
          })),
          subtotal: order.subtotalAmount,
          total: order.totalAmount,
          distributor: {
            name: distributor?.name || '',
            address: distributor?.address || '',
            phone: distributor?.contactPhone || '',
            taxId: distributor?.taxId || '',
          },
        },
      })
    );
  } catch (error) {
    console.error('[POS RECEIPT POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}