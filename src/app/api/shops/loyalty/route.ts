// ALADIN Loyalty Program API
// GET /api/shops/loyalty — Loyalty tier details and progress for shop owners

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse, formatVND, LOYALTY_TIERS } from '@/lib/security';

const TIER_ORDER = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
type TierKey = typeof TIER_ORDER[number];

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

    const shop = await db.shop.findUnique({
      where: { id: shopId, deletedAt: null },
    });
    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }

    const currentTierKey = shop.loyaltyTier as TierKey;
    const currentIndex = TIER_ORDER.indexOf(currentTierKey);
    const currentTierConfig = LOYALTY_TIERS[currentTierKey];
    const nextTierKey = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;
    const nextTierConfig = nextTierKey ? LOYALTY_TIERS[nextTierKey] : null;

    // ============================================
    // All tiers with progress indicators
    // ============================================
    const allTiers = TIER_ORDER.map((tierKey, index) => {
      const config = LOYALTY_TIERS[tierKey];
      const isUnlocked = index <= currentIndex;
      const isCurrent = tierKey === currentTierKey;
      const isNext = tierKey === nextTierKey;

      // Progress within this tier range
      let progressPercent = 0;
      if (isUnlocked) {
        progressPercent = 100;
      } else if (index === currentIndex + 1 && nextTierConfig) {
        const prevMin = currentTierConfig.minOrders;
        const thisMin = config.minOrders;
        progressPercent = Math.min(
          Math.round(((shop.totalOrders - prevMin) / (thisMin - prevMin)) * 100),
          100
        );
      }

      return {
        tier: tierKey,
        name: config.name,
        nameVi: config.nameVi,
        minOrders: config.minOrders,
        minGmv: config.minGmv,
        discount: config.discount,
        creditLimitMax: config.creditLimitMax,
        creditLimitMaxFormatted: formatVND(config.creditLimitMax),
        benefits: config.benefits,
        isUnlocked,
        isCurrent,
        isNext,
        progressPercent,
      };
    });

    // ============================================
    // Current tier details
    // ============================================
    const currentTier = {
      tier: currentTierKey,
      name: currentTierConfig.name,
      nameVi: currentTierConfig.nameVi,
      discount: currentTierConfig.discount,
      discountLabel: `${Math.round(currentTierConfig.discount * 100)}%`,
      creditLimitMax: currentTierConfig.creditLimitMax,
      creditLimitMaxFormatted: formatVND(currentTierConfig.creditLimitMax),
      benefits: currentTierConfig.benefits,
      reachedAt: null as string | null,
    };

    // ============================================
    // Next tier details
    // ============================================
    const nextTier = nextTierConfig
      ? {
          tier: nextTierKey,
          name: nextTierConfig.name,
          nameVi: nextTierConfig.nameVi,
          discount: nextTierConfig.discount,
          discountLabel: `${Math.round(nextTierConfig.discount * 100)}%`,
          creditLimitMax: nextTierConfig.creditLimitMax,
          creditLimitMaxFormatted: formatVND(nextTierConfig.creditLimitMax),
          benefits: nextTierConfig.benefits,
          ordersNeeded: Math.max(0, nextTierConfig.minOrders - shop.totalOrders),
          spendNeeded: Math.max(0, nextTierConfig.minGmv - shop.totalGmv),
          spendNeededFormatted: formatVND(Math.max(0, nextTierConfig.minGmv - shop.totalGmv)),
        }
      : null;

    // ============================================
    // Progress to next tier
    // ============================================
    const progressToNext = nextTierConfig
      ? {
          ordersProgress: Math.min(
            Math.round(
              ((shop.totalOrders - currentTierConfig.minOrders) /
                (nextTierConfig.minOrders - currentTierConfig.minOrders)) *
                100
            ),
            100
          ),
          gmvProgress: nextTierConfig.minGmv > currentTierConfig.minGmv
            ? Math.min(
                Math.round(
                  ((shop.totalGmv - currentTierConfig.minGmv) /
                    (nextTierConfig.minGmv - currentTierConfig.minGmv)) *
                    100
                ),
                100
              )
            : 100,
        }
      : null;

    // ============================================
    // Tier history (based on order count milestones)
    // ============================================
    // We derive tier history from the shop's total orders and current tier
    const tierHistory: Array<{ tier: string; name: string; nameVi: string; reachedOrders: number; estimatedDate: string }> = [];

    // For each tier the shop has passed, estimate when it was reached
    // by looking at when the nth order was placed
    for (let i = 0; i <= currentIndex; i++) {
      const tierKey = TIER_ORDER[i];
      const config = LOYALTY_TIERS[tierKey];
      if (config.minOrders === 0) {
        tierHistory.push({
          tier: tierKey,
          name: config.name,
          nameVi: config.nameVi,
          reachedOrders: 0,
          estimatedDate: shop.createdAt.toISOString(),
        });
        continue;
      }

      // Find the order that pushed them into this tier
      const nthOrder = await db.order.findFirst({
        where: { shopId },
        orderBy: { createdAt: 'asc' },
        skip: config.minOrders - 1,
        select: { createdAt: true },
      });

      tierHistory.push({
        tier: tierKey,
        name: config.name,
        nameVi: config.nameVi,
        reachedOrders: config.minOrders,
        estimatedDate: nthOrder?.createdAt?.toISOString() || shop.createdAt.toISOString(),
      });

      // Set reachedAt for current tier
      if (tierKey === currentTierKey) {
        currentTier.reachedAt = nthOrder?.createdAt?.toISOString() || shop.createdAt.toISOString();
      }
    }

    return NextResponse.json(successResponse({
      currentTier,
      nextTier,
      progressToNext,
      allTiers,
      tierHistory,
      shopStats: {
        totalOrders: shop.totalOrders,
        totalGmv: shop.totalGmv,
        totalGmvFormatted: formatVND(shop.totalGmv),
      },
    }));
  } catch (error) {
    console.error('[SHOP LOYALTY ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch loyalty info'),
      { status: 500 }
    );
  }
}