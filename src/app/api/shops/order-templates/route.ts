// ALADIN Order Templates API
// GET /api/shops/order-templates — Recent orders as templates + frequent items

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/get-auth-user';
import { successResponse, errorResponse } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // ============================================
    // Auth
    // ============================================
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    // ============================================
    // Find shop for this user
    // ============================================
    const shop = await db.shop.findFirst({
      where: { userId: user.userId },
    });

    if (!shop) {
      return NextResponse.json(
        errorResponse('NO_SHOP', 'Tài khoản chưa liên kết cửa hàng / No shop linked'),
        { status: 400 }
      );
    }

    const shopId = shop.id;
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // ============================================
    // Helper: format VND
    // ============================================
    const fmt = (n: number) =>
      new Intl.NumberFormat('vi-VN').format(n) + ' ₫';

    // ============================================
    // 1. Get recent delivered orders (last 90 days, last 5)
    // ============================================
    const recentOrders = await db.order.findMany({
      where: {
        shopId,
        status: 'DELIVERED',
        createdAt: { gte: ninetyDaysAgo },
      },
      include: {
        items: {
          select: {
            productId: true,
            productName: true,
            productSku: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // ============================================
    // 2. Build "recent order" templates
    // ============================================
    const recentTemplates = recentOrders.map((order) => {
      const date = new Date(order.createdAt);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return {
        id: order.id,
        type: 'RECENT_ORDER' as const,
        name: `Đơn hàng ngày ${day}/${month}/${year}`,
        createdAt: order.createdAt.toISOString(),
        itemCount: order.items.length,
        totalAmount: order.totalAmount,
        totalAmountFormatted: fmt(order.totalAmount),
        items: order.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.productSku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitPriceFormatted: fmt(item.unitPrice),
        })),
      };
    });

    // ============================================
    // 3. Build "frequent items": aggregate by productId
    // ============================================
    const productMap = new Map<
      string,
      {
        productId: string;
        productName: string;
        sku: string;
        totalQuantity: number;
        orderCount: number;
        lastPrice: number;
      }
    >();

    for (const order of recentOrders) {
      for (const item of order.items) {
        const existing = productMap.get(item.productId);
        if (!existing) {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            sku: item.productSku,
            totalQuantity: item.quantity,
            orderCount: 1,
            lastPrice: item.unitPrice,
          });
        } else {
          existing.totalQuantity += item.quantity;
          existing.orderCount += 1;
          // Orders sorted desc → first encounter is most recent price
          existing.lastPrice = item.unitPrice;
        }
      }
    }

    // Sort by frequency desc, then by total qty desc
    const frequentProducts = Array.from(productMap.values())
      .sort(
        (a, b) =>
          b.orderCount - a.orderCount || b.totalQuantity - a.totalQuantity
      )
      .map((p) => ({
        productId: p.productId,
        productName: p.productName,
        sku: p.sku,
        lastPrice: p.lastPrice,
        lastPriceFormatted: fmt(p.lastPrice),
        avgQty: Math.round(p.totalQuantity / p.orderCount),
        orderFrequency: p.orderCount,
      }));

    // ============================================
    // Return
    // ============================================
    return NextResponse.json(
      successResponse({
        recentTemplates,
        frequentProducts,
      })
    );
  } catch (error) {
    console.error('[ORDER TEMPLATES ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load order templates'),
      { status: 500 }
    );
  }
}