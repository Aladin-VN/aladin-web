// ALADIN — Multi-tier Pricing API (Odoo Pricelists concept)
// GET    /api/distributor/price-tiers          — List all price tiers with items
// POST   /api/distributor/price-tiers          — Create a new price tier
// PUT    /api/distributor/price-tiers          — Update an existing price tier
// DELETE /api/distributor/price-tiers          — Soft-delete a price tier
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse, sanitizeInput } from '@/lib/security';
import { db } from '@/lib/db';

// ---------------------------------------------------------------------------
// Valid tier types
// ---------------------------------------------------------------------------
const VALID_TIER_TYPES = ['LOYALTY_BASED', 'VOLUME_BASED', 'CUSTOM'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check that the given value is a valid tier type string */
function isValidTierType(t: unknown): t is string {
  return typeof t === 'string' && (VALID_TIER_TYPES as readonly string[]).includes(t);
}

/** Validate a single price-tier item payload */
function validateItem(item: unknown, index: number): { valid: boolean; error?: string } {
  if (!item || typeof item !== 'object') {
    return { valid: false, error: `items[${index}]: phải là object.` };
  }
  const { productId, price } = item as Record<string, unknown>;
  if (!productId || typeof productId !== 'string') {
    return { valid: false, error: `items[${index}]: productId bắt buộc.` };
  }
  if (typeof price !== 'number' || price <= 0 || !Number.isInteger(price)) {
    return { valid: false, error: `items[${index}]: price phải là số nguyên > 0 (VND).` };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// GET — List all price tiers for this distributor
// ---------------------------------------------------------------------------
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
    const includeProducts = searchParams.get('includeProducts') !== 'false'; // default true

    const tiers = await db.priceTier.findMany({
      where: { distributorId: distId },
      orderBy: { createdAt: 'desc' },
      include: {
        ...(includeProducts
          ? {
              items: {
                include: {
                  product: {
                    select: { id: true, name: true, sku: true, basePrice: true },
                  },
                },
                orderBy: { createdAt: 'asc' },
              },
            }
          : {
              items: true,
            }),
      },
    });

    const items = tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      nameEn: tier.nameEn,
      tierType: tier.tierType,
      discountPercent: tier.discountPercent,
      minOrderValue: tier.minOrderValue,
      loyaltyTier: tier.loyaltyTier,
      isActive: tier.isActive,
      itemCount: tier.items.length,
      items: tier.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        price: item.price,
        productName: includeProducts && 'product' in item && item.product ? item.product.name : undefined,
        productSku: includeProducts && 'product' in item && item.product ? item.product.sku : undefined,
        basePrice: includeProducts && 'product' in item && item.product ? item.product.basePrice : undefined,
      })),
      createdAt: tier.createdAt,
      updatedAt: tier.updatedAt,
    }));

    return NextResponse.json(successResponse({ items }));
  } catch (error) {
    console.error('[PRICE TIERS GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new price tier with items
// ---------------------------------------------------------------------------
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

    const body = await request.json();
    const { name, nameEn, tierType, discountPercent, minOrderValue, loyaltyTier, items } = body as {
      name: string;
      nameEn?: string;
      tierType: string;
      discountPercent?: number;
      minOrderValue?: number | null;
      loyaltyTier?: string;
      items?: { productId: string; price: number }[];
    };

    // --- Validate name ---
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Tên bảng giá là bắt buộc.'), { status: 400 });
    }

    // --- Validate tierType ---
    if (!isValidTierType(tierType)) {
      return NextResponse.json(
        errorResponse('INVALID_INPUT', `tierType phải là một trong: ${VALID_TIER_TYPES.join(', ')}.`),
        { status: 400 },
      );
    }

    // --- Validate loyaltyTier requirement ---
    if (tierType === 'LOYALTY_BASED' && (!loyaltyTier || typeof loyaltyTier !== 'string' || loyaltyTier.trim().length === 0)) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'LOYALTY_BASED tier yêu cầu loyaltyTier.'), { status: 400 });
    }

    // --- Validate discountPercent ---
    if (discountPercent !== undefined && (typeof discountPercent !== 'number' || discountPercent < 0 || discountPercent > 100)) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'discountPercent phải từ 0 đến 100.'), { status: 400 });
    }

    // --- Validate minOrderValue ---
    if (minOrderValue !== undefined && minOrderValue !== null) {
      if (typeof minOrderValue !== 'number' || minOrderValue < 0 || !Number.isInteger(minOrderValue)) {
        return NextResponse.json(errorResponse('INVALID_INPUT', 'minOrderValue phải là số nguyên >= 0.'), { status: 400 });
      }
    }

    // --- Validate items ---
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Phải có ít nhất 1 sản phẩm trong bảng giá.'), { status: 400 });
    }

    for (let i = 0; i < items.length; i++) {
      const validation = validateItem(items[i], i);
      if (!validation.valid) {
        return NextResponse.json(errorResponse('INVALID_INPUT', validation.error!), { status: 400 });
      }
    }

    // --- Verify all productIds exist ---
    const productIds = items.map((it) => it.productId);
    const existingProducts = await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const existingIds = new Set(existingProducts.map((p) => p.id));
    const missingIds = productIds.filter((pid) => !existingIds.has(pid));
    if (missingIds.length > 0) {
      return NextResponse.json(
        errorResponse('PRODUCT_NOT_FOUND', `Sản phẩm không tồn tại: ${missingIds.join(', ')}.`),
        { status: 400 },
      );
    }

    // --- Check for duplicate productIds in items ---
    const seenPids = new Set<string>();
    for (const item of items) {
      if (seenPids.has(item.productId)) {
        return NextResponse.json(
          errorResponse('DUPLICATE_PRODUCT', `Sản phẩm ${item.productId} xuất hiện nhiều lần trong bảng giá.`),
          { status: 400 },
        );
      }
      seenPids.add(item.productId);
    }

    // --- Create tier + items in a transaction ---
    const tier = await db.$transaction(async (tx) => {
      const created = await tx.priceTier.create({
        data: {
          distributorId: distId,
          name: sanitizeInput(name.trim()),
          nameEn: nameEn ? sanitizeInput(nameEn.trim()) : null,
          tierType,
          discountPercent: discountPercent ?? 0,
          minOrderValue: minOrderValue ?? null,
          loyaltyTier: tierType === 'LOYALTY_BASED' ? sanitizeInput(loyaltyTier!.trim()) : null,
          isActive: true,
        },
      });

      await tx.priceTierItem.createMany({
        data: items.map((item) => ({
          priceTierId: created.id,
          productId: item.productId,
          price: item.price,
        })),
      });

      return created;
    });

    // --- Fetch the created tier with items for the response ---
    const fullTier = await db.priceTier.findUniqueOrThrow({
      where: { id: tier.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, basePrice: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(
      successResponse({
        id: fullTier.id,
        name: fullTier.name,
        nameEn: fullTier.nameEn,
        tierType: fullTier.tierType,
        discountPercent: fullTier.discountPercent,
        minOrderValue: fullTier.minOrderValue,
        loyaltyTier: fullTier.loyaltyTier,
        isActive: fullTier.isActive,
        itemCount: fullTier.items.length,
        items: fullTier.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          price: item.price,
          productName: item.product.name,
          productSku: item.product.sku,
          basePrice: item.product.basePrice,
        })),
        createdAt: fullTier.createdAt,
        updatedAt: fullTier.updatedAt,
      }),
      { status: 201 },
    );
  } catch (error) {
    console.error('[PRICE TIERS POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT — Update an existing price tier (and optionally its items)
// ---------------------------------------------------------------------------
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const {
      id,
      name,
      nameEn,
      tierType,
      discountPercent,
      minOrderValue,
      loyaltyTier,
      isActive,
      items,
    } = body as {
      id: string;
      name?: string;
      nameEn?: string;
      tierType?: string;
      discountPercent?: number;
      minOrderValue?: number | null;
      loyaltyTier?: string;
      isActive?: boolean;
      items?: { id?: string; productId?: string; price?: number; _delete?: boolean }[];
    };

    // --- id is required ---
    if (!id || typeof id !== 'string') {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'id là bắt buộc.'), { status: 400 });
    }

    // --- Verify ownership ---
    const existing = await db.priceTier.findUnique({
      where: { id },
    });
    if (!existing || existing.distributorId !== distId) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Bảng giá không tồn tại.'), { status: 404 });
    }

    // --- Validate tierType if provided ---
    if (tierType !== undefined && !isValidTierType(tierType)) {
      return NextResponse.json(
        errorResponse('INVALID_INPUT', `tierType phải là một trong: ${VALID_TIER_TYPES.join(', ')}.`),
        { status: 400 },
      );
    }

    // --- Validate loyaltyTier requirement when changing to LOYALTY_BASED ---
    const effectiveTierType = tierType ?? existing.tierType;
    if (effectiveTierType === 'LOYALTY_BASED') {
      const effectiveLoyaltyTier = loyaltyTier ?? existing.loyaltyTier;
      if (!effectiveLoyaltyTier) {
        return NextResponse.json(errorResponse('INVALID_INPUT', 'LOYALTY_BASED tier yêu cầu loyaltyTier.'), { status: 400 });
      }
    }

    // --- Validate discountPercent ---
    if (discountPercent !== undefined && (typeof discountPercent !== 'number' || discountPercent < 0 || discountPercent > 100)) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'discountPercent phải từ 0 đến 100.'), { status: 400 });
    }

    // --- Validate minOrderValue ---
    if (minOrderValue !== undefined && minOrderValue !== null) {
      if (typeof minOrderValue !== 'number' || minOrderValue < 0 || !Number.isInteger(minOrderValue)) {
        return NextResponse.json(errorResponse('INVALID_INPUT', 'minOrderValue phải là số nguyên >= 0.'), { status: 400 });
      }
    }

    // --- Validate items array if provided ---
    if (items !== undefined) {
      if (!Array.isArray(items)) {
        return NextResponse.json(errorResponse('INVALID_INPUT', 'items phải là mảng.'), { status: 400 });
      }

      // Validate non-delete items
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // Skip validation for items marked for deletion
        if (item._delete) {
          if (!item.id) {
            return NextResponse.json(errorResponse('INVALID_INPUT', `items[${i}]: _delete=true cần có id.`), { status: 400 });
          }
          continue;
        }

        if (!item.productId || typeof item.productId !== 'string') {
          return NextResponse.json(errorResponse('INVALID_INPUT', `items[${i}]: productId bắt buộc.`), { status: 400 });
        }
        if (typeof item.price !== 'number' || item.price <= 0 || !Number.isInteger(item.price)) {
          return NextResponse.json(errorResponse('INVALID_INPUT', `items[${i}]: price phải là số nguyên > 0 (VND).`), { status: 400 });
        }
      }

      // Verify new productIds exist (for items without id = new items)
      const newItemProductIds = items.filter((it) => !it.id && !it._delete && it.productId).map((it) => it.productId!);
      if (newItemProductIds.length > 0) {
        const existingProducts = await db.product.findMany({
          where: { id: { in: newItemProductIds } },
          select: { id: true },
        });
        const existingIds = new Set(existingProducts.map((p) => p.id));
        const missingIds = newItemProductIds.filter((pid) => !existingIds.has(pid));
        if (missingIds.length > 0) {
          return NextResponse.json(
            errorResponse('PRODUCT_NOT_FOUND', `Sản phẩm không tồn tại: ${missingIds.join(', ')}.`),
            { status: 400 },
          );
        }
      }
    }

    // --- Perform update in a transaction ---
    const updatedTier = await db.$transaction(async (tx) => {
      // Update the tier itself
      const updated = await tx.priceTier.update({
        where: { id },
        data: {
          ...(name !== undefined ? { name: sanitizeInput(name.trim()) } : {}),
          ...(nameEn !== undefined ? { nameEn: nameEn ? sanitizeInput(nameEn.trim()) : null } : {}),
          ...(tierType !== undefined ? { tierType } : {}),
          ...(discountPercent !== undefined ? { discountPercent } : {}),
          ...(minOrderValue !== undefined ? { minOrderValue } : {}),
          ...(loyaltyTier !== undefined ? { loyaltyTier: loyaltyTier ? sanitizeInput(loyaltyTier.trim()) : null } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      });

      // If items array is provided, handle item modifications
      if (items !== undefined) {
        // 1. Delete items marked with _delete: true
        const toDelete = items.filter((it) => it._delete && it.id).map((it) => it.id!);
        if (toDelete.length > 0) {
          await tx.priceTierItem.deleteMany({
            where: { id: { in: toDelete }, priceTierId: id },
          });
        }

        // 2. Update existing items (have id, not _delete)
        const toUpdate = items.filter((it) => it.id && !it._delete);
        for (const item of toUpdate) {
          await tx.priceTierItem.update({
            where: { id: item.id },
            data: {
              productId: item.productId!,
              price: item.price!,
            },
          });
        }

        // 3. Create new items (no id, not _delete)
        const toCreate = items.filter((it) => !it.id && !it._delete && it.productId && it.price);
        if (toCreate.length > 0) {
          await tx.priceTierItem.createMany({
            data: toCreate.map((item) => ({
              priceTierId: id,
              productId: item.productId!,
              price: item.price!,
            })),
          });
        }
      }

      return updated;
    });

    // --- Fetch the updated tier with items for the response ---
    const fullTier = await db.priceTier.findUniqueOrThrow({
      where: { id: updatedTier.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, basePrice: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return NextResponse.json(
      successResponse({
        id: fullTier.id,
        name: fullTier.name,
        nameEn: fullTier.nameEn,
        tierType: fullTier.tierType,
        discountPercent: fullTier.discountPercent,
        minOrderValue: fullTier.minOrderValue,
        loyaltyTier: fullTier.loyaltyTier,
        isActive: fullTier.isActive,
        itemCount: fullTier.items.length,
        items: fullTier.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          price: item.price,
          productName: item.product.name,
          productSku: item.product.sku,
          basePrice: item.product.basePrice,
        })),
        createdAt: fullTier.createdAt,
        updatedAt: fullTier.updatedAt,
      }),
    );
  } catch (error) {
    console.error('[PRICE TIERS PUT ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DELETE — Soft-delete (set isActive = false)
// ---------------------------------------------------------------------------
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'id là bắt buộc.'), { status: 400 });
    }

    // Verify ownership before deleting
    const existing = await db.priceTier.findUnique({
      where: { id },
    });
    if (!existing || existing.distributorId !== distId) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Bảng giá không tồn tại.'), { status: 404 });
    }

    if (!existing.isActive) {
      return NextResponse.json(errorResponse('ALREADY_INACTIVE', 'Bảng giá đã được vô hiệu hóa.'), { status: 400 });
    }

    await db.priceTier.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(successResponse({ id, deactivated: true }));
  } catch (error) {
    console.error('[PRICE TIERS DELETE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}