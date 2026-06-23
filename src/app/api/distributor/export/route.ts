// GET /api/distributor/export — CSV export for distributors
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

function csvEscape(val: unknown): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền NPP.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Không liên kết.'), { status: 400 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'orders';
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel

    let csv = '';
    let filename = 'export.csv';

    if (type === 'orders') {
      filename = `don-hang-npp-${new Date().toISOString().slice(0, 10)}.csv`;
      csv = 'Mã đơn,Cửa hàng,Quận,Tỉnh,Sản phẩm,Tổng tiền,Trạng thái,Ngày tạo\n';
      const orders = await db.order.findMany({
        where: { distributorId: distId },
        include: {
          shop: { select: { name: true, district: true, province: true } },
          items: { select: { productName: true, quantity: true, totalPrice: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1000,
      });
      for (const o of orders) {
        const itemStr = o.items.map(i => `${i.productName} x${i.quantity}`).join('; ');
        csv += `${csvEscape(o.orderNumber)},${csvEscape(o.shop?.name)},${csvEscape(o.shop?.district)},${csvEscape(o.shop?.province)},${csvEscape(itemStr)},${o.totalAmount},${o.status},${o.createdAt?.toISOString()}\n`;
      }
    } else if (type === 'inventory') {
      filename = `kho-hang-npp-${new Date().toISOString().slice(0, 10)}.csv`;
      csv = 'SKU,Sản phẩm,Tồn kho,Đã đặt,Có sẵn,Đã đặt tối thiểu,Giá vốn,Giá bán\n';
      const items = await db.distributorInventory.findMany({
        where: { distributorId: distId },
        include: { product: { select: { name: true, sku: true, basePrice: true } } },
      });
      for (const i of items) {
        csv += `${csvEscape(i.product.sku)},${csvEscape(i.product.name)},${i.quantity},${i.reservedQty},${i.quantity - i.reservedQty},${i.minStockLevel},${i.costPrice || 0},${i.product.basePrice}\n`;
      }
    } else if (type === 'settlements') {
      filename = `quyet-toan-npp-${new Date().toISOString().slice(0, 10)}.csv`;
      csv = 'Mã kỳ,Bắt đầu,Kết thúc,Tổng đơn,Doanh thu,Phí NT,Thu nhập ròng,Trạng thái,Ngày TT\n';
      const settlements = await db.settlement.findMany({
        where: { distributorId: distId },
        orderBy: { periodStart: 'desc' },
      });
      for (const s of settlements) {
        csv += `${csvEscape(s.settlementNumber)},${s.periodStart?.toISOString().slice(0, 10)},${s.periodEnd?.toISOString().slice(0, 10)},${s.totalOrders},${s.totalOrderValue},${s.totalPlatformFee},${s.distributorPayout},${s.status},${s.paidAt?.toISOString().slice(0, 10) || ''}\n`;
      }
    } else if (type === 'analytics') {
      filename = `phan-tich-npp-${new Date().toISOString().slice(0, 10)}.csv`;
      csv = 'Sản phẩm,SKU,Doanh thu 30 ngày,Số lượng,Giá vốn,Giá bán,Biên lợi nhuận (%),Tồn kho\n';
      const results: any[] = await db.$queryRaw`
        SELECT p.name, p.sku, COALESCE(SUM(oi."totalPrice"), 0) as revenue,
               COALESCE(SUM(oi.quantity), 0) as qty, di."costPrice", p."basePrice"
        FROM "OrderItem" oi
        JOIN "Order" o ON oi."orderId" = o.id
        JOIN "Product" p ON oi."productId" = p.id
        LEFT JOIN "DistributorInventory" di ON di."productId" = p.id AND di."distributorId" = ${distId}
        WHERE o."distributorId" = ${distId} AND o."status" = 'DELIVERED' AND o."deliveredAt" >= NOW() - INTERVAL '30 days'
        GROUP BY p.name, p.sku, di."costPrice", p."basePrice", di.quantity
        ORDER BY revenue DESC
      `;
      for (const r of results) {
        const margin = r.basePrice > 0 ? ((r.basePrice - (r.costPrice || 0)) / r.basePrice * 100).toFixed(1) : '0';
        csv += `${csvEscape(r.name)},${csvEscape(r.sku)},${r.revenue},${r.qty},${r.costPrice || 0},${r.basePrice},${margin},${r.quantity || 0}\n`;
      }
    }

    return new NextResponse(BOM + csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('[EXPORT ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi xuất file.'), { status: 500 });
  }
}