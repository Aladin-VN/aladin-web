// GET /api/ai/recommendations — Product & reorder recommendations
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    if (user.role === ROLES.DISTRIBUTOR) {
      // Distributor: recommend products to stock up
      const distId = getDistributorId(user);
      if (!distId) return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });

      const inventory = await db.distributorInventory.findMany({
        where: { distributorId: distId },
        include: { product: { select: { id: true, name: true, sku: true, basePrice: true, unit: true, imageUrl: true } } },
      });

      const recommendations = inventory
        .filter(i => i.quantity <= i.minStockLevel * 2)
        .map(i => ({
          productId: i.productId,
          productName: i.product.name,
          sku: i.product.sku,
          currentStock: i.quantity,
          minStock: i.minStockLevel,
          suggestedQty: Math.max(0, i.minStockLevel * 3 - i.quantity),
          urgency: i.quantity <= i.minStockLevel ? 'CRITICAL' : i.quantity <= i.minStockLevel * 1.5 ? 'WARNING' : 'INFO',
          reason: i.quantity <= i.minStockLevel ? 'Tồn kho dưới mức tối thiểu' : 'Sắp hết hàng',
          score: i.quantity <= i.minStockLevel ? 100 : 60,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      return NextResponse.json(successResponse({ recommendations }));
    } else if (user.role === ROLES.SHOP_OWNER) {
      // Shop owner: recommend products based on order history
      const recentOrders = await db.order.findMany({
        where: { shopId: user.shopId, status: 'DELIVERED' },
        include: { items: { select: { productId: true, productName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      const productFreq = new Map<string, { count: number; name: string; lastOrder: Date }>();
      for (const o of recentOrders) {
        for (const item of o.items) {
          const existing = productFreq.get(item.productId) || { count: 0, name: item.productName, lastOrder: new Date(0) };
          existing.count += item.quantity;
          if (o.createdAt && o.createdAt > existing.lastOrder) existing.lastOrder = o.createdAt;
          productFreq.set(item.productId, existing);
        }
      }

      const sorted = Array.from(productFreq.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

      const productIds = sorted.map(s => s[0]);
      const products = productIds.length > 0 ? await db.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        select: { id: true, name: true, sku: true, basePrice: true, unit: true, imageUrl: true },
      }) : [];
      const pMap = new Map(products.map(p => [p.id, p]));

      const recommendations = sorted.map(([id, freq]) => {
        const p = pMap.get(id);
        return {
          productId: id,
          productName: freq.name,
          sku: p?.sku || '',
          price: p?.basePrice || 0,
          imageUrl: p?.imageUrl || '',
          orderFrequency: freq.count,
          lastOrdered: freq.lastOrder.toISOString().slice(0, 10),
          reason: `Đã đặt ${freq.count} lần gần đây`,
          score: freq.count,
        };
      });

      return NextResponse.json(successResponse({ recommendations }));
    }

    return NextResponse.json(successResponse({ recommendations: [] }));
  } catch (error) {
    console.error('[RECOMMENDATIONS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}