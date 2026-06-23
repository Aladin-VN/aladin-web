// GET /api/ai/reorder-suggestions — Smart reorder for distributors
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) return NextResponse.json(errorResponse('FORBIDDEN', ''), { status: 403 });
    const distId = getDistributorId(user);
    if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });

    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const inventory = await db.distributorInventory.findMany({
      where: { distributorId: distId },
      include: { product: { select: { id: true, name: true, sku: true, basePrice: true, unit: true } } },
    });

    // Get daily sales velocity for each product
    const salesData: any[] = await db.$queryRaw`
      SELECT oi."productId", SUM(oi.quantity)::float as totalQty, COUNT(DISTINCT DATE(o."createdAt"))::float as orderDays
      FROM "OrderItem" oi
      JOIN "Order" o ON oi."orderId" = o.id
      WHERE o."distributorId" = ${distId} AND o."status" = 'DELIVERED' AND o."createdAt" >= ${thirtyDaysAgo.toISOString()}
      GROUP BY oi."productId"
    `;
    const salesMap = new Map(salesData.map(s => [s.productId, s]));

    const suggestions = inventory.map(inv => {
      const sales = salesMap.get(inv.productId);
      const avgDailySales = sales && sales.orderDays > 0 ? sales.totalQty / sales.orderDays : 0;
      const daysOfStock = avgDailySales > 0 ? Math.floor(inv.quantity / avgDailySales) : 999;
      const suggestedQty = avgDailySales > 0 ? Math.ceil(avgDailySales * 14) - inv.quantity : 0;
      const urgency = daysOfStock <= 3 ? 'CRITICAL' : daysOfStock <= 7 ? 'WARNING' : 'INFO';

      return {
        productId: inv.productId,
        productName: inv.product.name,
        sku: inv.product.sku,
        currentStock: inv.quantity,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        daysOfStock,
        suggestedQty: Math.max(0, suggestedQty),
        urgency,
        costPrice: inv.costPrice,
        sellingPrice: inv.product.basePrice,
      };
    }).filter(s => s.urgency !== 'INFO').sort((a, b) => a.daysOfStock - b.daysOfStock);

    return NextResponse.json(successResponse({ suggestions }));
  } catch (error) {
    console.error('[REORDER SUGGESTIONS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}