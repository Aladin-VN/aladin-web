// ALADIN — Price Lookup Endpoint
// GET /api/distributor/price-tiers/lookup?productId=xxx&customerTier=BRONZE&orderValue=500000
//
// Determines which tiered price applies to a product for a given context.
// Priority: LOYALTY_BASED > VOLUME_BASED > CUSTOM
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

/**
 * Price lookup result returned to the caller.
 */
interface PriceLookupResult {
  tierId: string;
  tierName: string;
  price: number;
  discountPercent: number;
}

// Priority order: LOYALTY_BASED first, then VOLUME_BASED, then CUSTOM
const TIER_PRIORITY: Record<string, number> = {
  LOYALTY_BASED: 0,
  VOLUME_BASED: 1,
  CUSTOM: 2,
};

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
    const productId = searchParams.get('productId');
    const customerTier = searchParams.get('customerTier'); // e.g. BRONZE, SILVER, GOLD
    const orderValueParam = searchParams.get('orderValue');
    const orderValue = orderValueParam ? parseInt(orderValueParam, 10) : null;

    // productId is required
    if (!productId) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'productId là bắt buộc.'), { status: 400 });
    }

    // Validate orderValue if provided
    if (orderValue !== null && (isNaN(orderValue) || orderValue < 0)) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'orderValue phải là số >= 0.'), { status: 400 });
    }

    // Build the where clause to find matching active tiers
    // We need tiers that:
    //   - Belong to this distributor
    //   - Are active
    //   - Match one of the following conditions:
    //     a) LOYALTY_BASED with loyaltyTier matching customerTier (if customerTier provided)
    //     b) VOLUME_BASED with minOrderValue null OR minOrderValue <= orderValue (if orderValue provided)
    //     c) CUSTOM (always considered)
    const orConditions: Record<string, unknown>[] = [];

    // Condition a: LOYALTY_BASED tiers matching customerTier
    if (customerTier) {
      orConditions.push({
        tierType: 'LOYALTY_BASED',
        loyaltyTier: customerTier,
      });
    }

    // Condition b: VOLUME_BASED tiers where order qualifies
    if (orderValue !== null) {
      orConditions.push({
        tierType: 'VOLUME_BASED',
        OR: [
          { minOrderValue: null },
          { minOrderValue: { lte: orderValue } },
        ],
      });
    }

    // Condition c: CUSTOM tiers (always included)
    orConditions.push({
      tierType: 'CUSTOM',
    });

    // If nothing to search (no customerTier and no orderValue), only CUSTOM would match
    // which is fine — that's the default behavior.

    // Fetch matching tiers that have a specific price for this product
    const matchingItems = await db.priceTierItem.findMany({
      where: {
        productId,
        priceTier: {
          distributorId: distId,
          isActive: true,
          OR: orConditions,
        },
      },
      include: {
        priceTier: {
          select: {
            id: true,
            name: true,
            tierType: true,
            discountPercent: true,
            minOrderValue: true,
            loyaltyTier: true,
          },
        },
      },
    });

    if (matchingItems.length === 0) {
      // No matching tiered price found — caller should use base price
      return NextResponse.json(successResponse(null));
    }

    // Sort by priority: LOYALTY_BASED (0) > VOLUME_BASED (1) > CUSTOM (2)
    // Within the same priority, pick the tier with the lowest price (best for customer)
    matchingItems.sort((a, b) => {
      const priorityA = TIER_PRIORITY[a.priceTier.tierType] ?? 99;
      const priorityB = TIER_PRIORITY[b.priceTier.tierType] ?? 99;
      if (priorityA !== priorityB) return priorityA - priorityB;
      // Same priority: prefer lower price (better deal for customer)
      return a.price - b.price;
    });

    // Pick the best match (first after sort)
    const best = matchingItems[0];

    const result: PriceLookupResult = {
      tierId: best.priceTier.id,
      tierName: best.priceTier.name,
      price: best.price,
      discountPercent: best.priceTier.discountPercent,
    };

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('[PRICE TIERS LOOKUP ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}