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

    const body = (await request.json()) as { saleId?: string; shiftId?: string; saleSequence?: number };
    const { shiftId, saleSequence } = body;

    if (!shiftId || !saleSequence) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Thiếu thông tin hóa đơn.'), { status: 400 });
    }

    // Get all items for this sale
    const saleItems = await db.posSaleItem.findMany({
      where: {
        posShiftId: shiftId,
        saleSequence,
      },
    });

    if (saleItems.length === 0) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy hóa đơn.'), { status: 404 });
    }

    // Verify ownership
    if (saleItems[0].distributorId !== distId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Không có quyền xem hóa đơn này.'), { status: 403 });
    }

    // Get distributor info
    const distributor = await db.distributor.findUnique({
      where: { id: distId },
      select: { name: true, address: true, contactPhone: true, taxId: true },
    });

    return NextResponse.json(
      successResponse({
        receipt: {
          shiftId,
          saleSequence,
          saleDate: saleItems[0].createdAt,
          paymentMethod: saleItems[0].paymentMethod,
          customerName: saleItems[0].customerName,
          customerPhone: saleItems[0].customerPhone,
          items: saleItems.map((si) => ({
            productName: si.productName,
            productSku: si.productSku,
            unitPrice: si.unitPrice,
            quantity: si.quantity,
            totalPrice: si.totalPrice,
          })),
          subtotal: saleItems.reduce((sum, si) => sum + si.totalPrice, 0),
          total: saleItems[0].saleTotal,
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