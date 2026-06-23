// ALADIN Reorder Suggestions API
// GET /api/shops/reorder-suggestions — Smart reorder suggestions based on order history

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

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
    if (!hasRole(payload.role, ['SHOP_OWNER'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Shop owner access required'), { status: 403 });
    }

    const shopId = payload.shopId;
    if (!shopId) {
      return NextResponse.json(errorResponse('NO_SHOP', 'Tài khoản chưa liên kết cửa hàng'), { status: 400 });
    }

    // ============================================
    // Get all order items grouped by product for this shop
    // Only consider delivered/confirmed orders
    // ============================================
    const orderItems = await db.orderItem.findMany({
      where: {
        order: {
          shopId,
          status: { in: ['DELIVERED', 'CONFIRMED', 'PROCESSING', 'PACKED'] },
        },
      },
      select: {
        productId: true,
        productName: true,
        productSku: true,
        quantity: true,
        unitPrice: true,
        order: {
          select: { createdAt: true },
        },
      },
      orderBy: { order: { createdAt: 'desc' } },
    });

    if (orderItems.length === 0) {
      return NextResponse.json(successResponse({ suggestions: [] }));
    }

    // ============================================
    // Analyze each product's ordering pattern
    // ============================================
    const productAnalysis = new Map<string, {
      productId: string;
      productName: string;
      sku: string;
      lastOrderedDate: Date;
      avgQty: number;
      avgFrequencyDays: number;
      totalOrders: number;
      lastPrice: number;
      totalQuantity: number;
    }>();

    for (const item of orderItems) {
      const existing = productAnalysis.get(item.productId);

      if (!existing) {
        productAnalysis.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          sku: item.productSku,
          lastOrderedDate: item.order.createdAt,
          avgQty: item.quantity,
          avgFrequencyDays: 0,
          totalOrders: 1,
          lastPrice: item.unitPrice,
          totalQuantity: item.quantity,
        });
      } else {
        // Update last ordered date if newer
        if (item.order.createdAt > existing.lastOrderedDate) {
          existing.lastOrderedDate = item.order.createdAt;
          existing.lastPrice = item.unitPrice;
        }
        existing.totalOrders += 1;
        existing.totalQuantity += item.quantity;
        existing.avgQty = Math.round(existing.totalQuantity / existing.totalOrders);
      }
    }

    // Calculate average frequency for products with 2+ orders
    for (const [, analysis] of productAnalysis) {
      if (analysis.totalOrders >= 2) {
        // Get all order dates for this product
        const productOrders = orderItems
          .filter((i) => i.productId === analysis.productId)
          .map((i) => i.order.createdAt.getTime())
          .sort((a, b) => b - a); // newest first

        // Calculate average gap between orders
        let totalGap = 0;
        let gapCount = 0;
        for (let i = 0; i < productOrders.length - 1; i++) {
          totalGap += productOrders[i] - productOrders[i + 1];
          gapCount++;
        }
        analysis.avgFrequencyDays = gapCount > 0
          ? Math.round(totalGap / gapCount / (24 * 60 * 60 * 1000))
          : 90; // default 90 days if only 1 order
      } else {
        analysis.avgFrequencyDays = 90; // default for 1 order
      }
    }

    // ============================================
    // Determine which products need reorder
    // ============================================
    const now = Date.now();
    const suggestions: Array<{
      productId: string;
      productName: string;
      sku: string;
      lastOrdered: string;
      lastOrderedFormatted: string;
      avgQty: number;
      avgFrequencyDays: number;
      daysSinceOrder: number;
      suggestedQty: number;
      estimatedPrice: number;
      estimatedPriceFormatted: string;
      hasPromotion: boolean;
      promotionTitle?: string;
      urgency: 'overdue' | 'due_soon' | 'normal';
    }> = [];

    for (const [, analysis] of productAnalysis) {
      const daysSinceOrder = Math.floor((now - analysis.lastOrderedDate.getTime()) / (24 * 60 * 60 * 1000));
      const threshold = Math.round(analysis.avgFrequencyDays * 1.2);

      // Only suggest if overdue or close to due
      if (daysSinceOrder >= threshold * 0.7) {
        suggestions.push({
          productId: analysis.productId,
          productName: analysis.productName,
          sku: analysis.sku,
          lastOrdered: analysis.lastOrderedDate.toISOString(),
          lastOrderedFormatted: analysis.lastOrderedDate.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }),
          avgQty: analysis.avgQty,
          avgFrequencyDays: analysis.avgFrequencyDays,
          daysSinceOrder,
          suggestedQty: analysis.avgQty,
          estimatedPrice: analysis.lastPrice * analysis.avgQty,
          estimatedPriceFormatted: formatVND(analysis.lastPrice * analysis.avgQty),
          hasPromotion: false,
          urgency: daysSinceOrder >= threshold ? 'overdue' : daysSinceOrder >= threshold * 0.85 ? 'due_soon' : 'normal',
        });
      }
    }

    // ============================================
    // Check for active promotions on suggested products
    // ============================================
    const productIds = suggestions.map((s) => s.productId);
    if (productIds.length > 0) {
      const activePromotions = await db.promotionItem.findMany({
        where: {
          productId: { in: productIds },
          promotion: {
            isActive: true,
            startsAt: { lte: new Date() },
            expiresAt: { gte: new Date() },
          },
        },
        include: {
          promotion: {
            select: { id: true, title: true, titleEn: true, promoType: true, discountPercent: true, expiresAt: true },
          },
        },
      });

      const promoMap = new Map<string, { title: string; expiresAt: Date }>();
      for (const pi of activePromotions) {
        if (!promoMap.has(pi.productId)) {
          promoMap.set(pi.productId, {
            title: pi.promotion.titleEn || pi.promotion.title,
            expiresAt: pi.promotion.expiresAt,
          });
        }
      }

      for (const suggestion of suggestions) {
        const promo = promoMap.get(suggestion.productId);
        if (promo) {
          suggestion.hasPromotion = true;
          suggestion.promotionTitle = promo.title;
        }
      }
    }

    // Sort: overdue first, then by days since order desc
    suggestions.sort((a, b) => {
      const urgencyOrder = { overdue: 0, due_soon: 1, normal: 2 };
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.daysSinceOrder - a.daysSinceOrder;
    });

    return NextResponse.json(successResponse({ suggestions }));
  } catch (error) {
    console.error('[SHOP REORDER SUGGESTIONS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to generate reorder suggestions'),
      { status: 500 }
    );
  }
}