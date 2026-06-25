// GET /api/distributor/group-buy — Group Buy batch tracking for distributors
// Lists group deals as unified batches with aggregated fulfillment progress.
// ?id=xxx returns detailed view with picking list and per-order tracking.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, GROUP_DEAL_STATUS, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ─── Valid GroupDeal statuses ───────────────────────────────────────
const VALID_GROUP_STATUSES = new Set(Object.values(GROUP_DEAL_STATUS));

// ─── Valid Order statuses (for byStatus breakdown keys) ─────────────
const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const;

type OrderStatusType = (typeof ORDER_STATUSES)[number];

// ─── GET handler ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // --- Auth & role guard ---
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Phân quyền nhà phân phối yêu cầu.'),
        { status: 403 },
      );
    }

    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(
        errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'),
        { status: 400 },
      );
    }

    // --- Parse query params ---
    const { searchParams } = new URL(request.url);
    const detailId = searchParams.get('id');
    const statusFilter = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Validate status filter
    if (statusFilter && !VALID_GROUP_STATUSES.has(statusFilter)) {
      return NextResponse.json(
        errorResponse(
          'INVALID_STATUS',
          `Trạng thái không hợp lệ. Giá trị cho phép: ${[...VALID_GROUP_STATUSES].join(', ')}`,
        ),
        { status: 400 },
      );
    }

    // ────────────────────────────────────────────────────────────────
    // DETAIL VIEW: ?id=xxx
    // ────────────────────────────────────────────────────────────────
    if (detailId) {
      return getGroupDealDetail(detailId, distId);
    }

    // ────────────────────────────────────────────────────────────────
    // LIST VIEW: paginated group deals
    // ────────────────────────────────────────────────────────────────
    return getGroupDealList(distId, statusFilter, page, limit);
  } catch (error) {
    console.error('[DISTRIBUTOR GROUP-BUY ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống. Vui lòng thử lại.'),
      { status: 500 },
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// LIST VIEW
// ════════════════════════════════════════════════════════════════════

async function getGroupDealList(
  distId: string,
  statusFilter: string | null,
  page: number,
  limit: number,
) {
  // Step 1: Find distinct groupDealIds from this distributor's orders
  const orderGroupDealRows = await db.order.findMany({
    where: {
      distributorId: distId,
      groupDealId: { not: null },
      status: { not: 'CANCELLED' }, // Exclude fully cancelled orders from batch visibility
    },
    select: { groupDealId: true },
    distinct: ['groupDealId'],
  });

  const distGroupDealIds = orderGroupDealRows
    .map((r) => r.groupDealId)
    .filter((id): id is string => id !== null);

  if (distGroupDealIds.length === 0) {
    return NextResponse.json(
      successResponse({
        items: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
      }),
    );
  }

  // Step 2: Build GroupDeal where clause
  const dealWhere: Prisma.GroupDealWhereInput = {
    id: { in: distGroupDealIds },
  };
  if (statusFilter) {
    dealWhere.status = statusFilter;
  }

  // Step 3: Count total matching deals
  const total = await db.groupDeal.count({ where: dealWhere });

  // Step 4: Fetch paginated group deals with product + participant count
  const deals = await db.groupDeal.findMany({
    where: dealWhere,
    include: {
      product: {
        select: { id: true, name: true, sku: true, unit: true },
      },
      ward: {
        select: { id: true, name: true, district: true },
      },
      participants: {
        where: { isActive: true },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Step 5: For each deal, fetch THIS distributor's orders + their items
  const dealIds = deals.map((d) => d.id);

  // Batch-fetch all orders for these group deals (filtered to this distributor)
  const allOrders = await db.order.findMany({
    where: {
      distributorId: distId,
      groupDealId: { in: dealIds },
    },
    select: {
      id: true,
      groupDealId: true,
      status: true,
      totalAmount: true,
      items: {
        select: { quantity: true },
      },
    },
  });

  // Group orders by groupDealId
  const ordersByDeal = new Map<string, typeof allOrders>();
  for (const order of allOrders) {
    if (!order.groupDealId) continue;
    const existing = ordersByDeal.get(order.groupDealId) || [];
    existing.push(order);
    ordersByDeal.set(order.groupDealId, existing);
  }

  // Step 6: Build response items
  const items = deals.map((deal) => {
    const orders = ordersByDeal.get(deal.id) || [];
    const totalOrders = orders.length;
    const totalDelivered = orders.filter((o) => o.status === 'DELIVERED').length;
    const nonCancelledOrders = orders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'REFUNDED');
    const fulfillmentPct =
      totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 1000) / 10 : 0;

    // Order status breakdown
    const byStatus: Record<string, number> = {};
    for (const os of ORDER_STATUSES) {
      byStatus[os] = 0;
    }
    for (const o of orders) {
      if (o.status in byStatus) {
        byStatus[o.status]++;
      }
    }
    // Remove zero entries for cleaner output
    for (const key of Object.keys(byStatus)) {
      if (byStatus[key] === 0) {
        delete byStatus[key];
      }
    }

    // Total quantity across all order items
    const totalQty = orders.reduce(
      (sum, o) => sum + o.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
      0,
    );

    // Total value
    const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

    return {
      id: deal.id,
      title: deal.title,
      titleEn: deal.titleEn ?? null,
      status: deal.status,
      product: {
        id: deal.product.id,
        name: deal.product.name,
        sku: deal.product.sku,
        unit: deal.product.unit,
      },
      originalPrice: deal.originalPrice,
      discountPrice: deal.discountPrice,
      targetQty: deal.targetQty,
      currentQty: deal.currentQty,
      participantCount: deal.participants.length,
      orderSummary: {
        total: totalOrders,
        byStatus,
        fulfillmentPct,
      },
      totalQty,
      totalValue,
      ward: deal.ward
        ? { id: deal.ward.id, name: deal.ward.name, district: deal.ward.district }
        : null,
      startsAt: deal.startsAt,
      expiresAt: deal.expiresAt,
      createdAt: deal.createdAt,
    };
  });

  return NextResponse.json(
    successResponse({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }),
  );
}

// ════════════════════════════════════════════════════════════════════
// DETAIL VIEW
// ════════════════════════════════════════════════════════════════════

async function getGroupDealDetail(groupDealId: string, distId: string) {
  // Step 1: Fetch the group deal with product, ward, participants
  const deal = await db.groupDeal.findUnique({
    where: { id: groupDealId },
    include: {
      product: {
        select: { id: true, name: true, nameEn: true, sku: true, unit: true, basePrice: true },
      },
      ward: {
        select: { id: true, name: true, nameEn: true, district: true, province: true },
      },
      participants: {
        where: { isActive: true },
        include: {
          shop: {
            select: { id: true, name: true, district: true, province: true, address: true },
          },
        },
      },
    },
  });

  if (!deal) {
    return NextResponse.json(
      errorResponse('NOT_FOUND', 'Không tìm thấy nhóm mua chung.'),
      { status: 404 },
    );
  }

  // Step 2: Fetch all orders in this group deal for THIS distributor
  const orders = await db.order.findMany({
    where: {
      groupDealId: deal.id,
      distributorId: distId,
    },
    include: {
      shop: {
        select: { id: true, name: true, district: true, province: true, address: true },
      },
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          productSku: true,
          unitPrice: true,
          quantity: true,
          totalPrice: true,
          freeQty: true,
        },
      },
      shipment: {
        select: {
          id: true,
          status: true,
          assignedDriverId: true,
          deliveredAt: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Step 3: Build order-level aggregations
  const totalOrders = orders.length;
  const totalDelivered = orders.filter((o) => o.status === 'DELIVERED').length;
  const fulfillmentPct =
    totalOrders > 0 ? Math.round((totalDelivered / totalOrders) * 1000) / 10 : 0;

  const byStatus: Record<string, number> = {};
  for (const os of ORDER_STATUSES) {
    byStatus[os] = 0;
  }
  for (const o of orders) {
    if (o.status in byStatus) {
      byStatus[o.status]++;
    }
  }
  for (const key of Object.keys(byStatus)) {
    if (byStatus[key] === 0) {
      delete byStatus[key];
    }
  }

  const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  // Step 4: Build consolidated picking list
  // Group all order items across all orders by productId
  const pickingMap = new Map<
    string,
    {
      productId: string;
      productName: string;
      productSku: string;
      totalQty: number;
      totalFreeQty: number;
      unitPrice: number;
      orderCount: number; // how many distinct orders contain this product
      orderIds: Set<string>;
    }
  >();

  for (const order of orders) {
    const orderItemIdSet = new Set<string>();
    for (const item of order.items) {
      if (pickingMap.has(item.productId)) {
        const entry = pickingMap.get(item.productId)!;
        entry.totalQty += item.quantity;
        entry.totalFreeQty += item.freeQty;
        // Use the latest unitPrice (they should all be the same for a group deal)
        entry.unitPrice = item.unitPrice;
        if (!entry.orderIds.has(order.id)) {
          entry.orderIds.add(order.id);
          entry.orderCount++;
        }
      } else {
        pickingMap.set(item.productId, {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          totalQty: item.quantity,
          totalFreeQty: item.freeQty,
          unitPrice: item.unitPrice,
          orderCount: 1,
          orderIds: new Set([order.id]),
        });
      }
    }
  }

  const pickingList = Array.from(pickingMap.values()).map((entry) => ({
    productId: entry.productId,
    productName: entry.productName,
    productSku: entry.productSku,
    totalQty: entry.totalQty,
    totalFreeQty: entry.totalFreeQty,
    unitPrice: entry.unitPrice,
    totalValue: entry.unitPrice * entry.totalQty,
    orderCount: entry.orderCount,
  }));

  // Sort picking list by totalQty descending
  pickingList.sort((a, b) => b.totalQty - a.totalQty);

  // Step 5: Build per-order delivery tracking
  const orderTracking = orders.map((order) => {
    // Build status timeline from order milestones
    const timeline: Array<{ status: string; timestamp: string | null }> = [];

    timeline.push({ status: 'CREATED', timestamp: order.createdAt.toISOString() });

    if (order.confirmedAt) {
      timeline.push({ status: 'CONFIRMED', timestamp: order.confirmedAt.toISOString() });
    }
    if (order.fulfilledByDistributorAt) {
      timeline.push({
        status: 'PROCESSING',
        timestamp: order.fulfilledByDistributorAt.toISOString(),
      });
    }
    if (order.packedAt) {
      timeline.push({ status: 'PACKED', timestamp: order.packedAt.toISOString() });
    }
    if (order.shipment) {
      if (order.shipment.status === 'PICKED_UP' || order.shipment.status === 'IN_TRANSIT') {
        timeline.push({
          status: 'OUT_FOR_DELIVERY',
          timestamp: order.updatedAt.toISOString(),
        });
      }
      if (order.shipment.deliveredAt) {
        timeline.push({
          status: 'DELIVERED',
          timestamp: order.shipment.deliveredAt.toISOString(),
        });
      }
    } else if (order.deliveredAt) {
      timeline.push({ status: 'DELIVERED', timestamp: order.deliveredAt.toISOString() });
    }
    if (order.cancelledAt) {
      timeline.push({ status: 'CANCELLED', timestamp: order.cancelledAt.toISOString() });
    }

    // Calculate order-level totals
    const orderTotalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const orderTotalFreeQty = order.items.reduce((sum, item) => sum + item.freeQty, 0);

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      shop: order.shop
        ? {
            id: order.shop.id,
            name: order.shop.name,
            district: order.shop.district,
            province: order.shop.province,
            address: order.shop.address,
          }
        : null,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      itemCount: order.items.length,
      totalQty: orderTotalQty,
      totalFreeQty: orderTotalFreeQty,
      deliveredAt: order.deliveredAt ?? order.shipment?.deliveredAt ?? null,
      shipmentStatus: order.shipment?.status ?? null,
      timeline,
      createdAt: order.createdAt,
    };
  });

  // Step 6: Aggregate participant summary
  const participantList = deal.participants.map((p) => ({
    id: p.id,
    shopId: p.shop.id,
    shopName: p.shop.name,
    shopDistrict: p.shop.district,
    shopProvince: p.shop.province,
  }));

  // Step 7: Build final response
  return NextResponse.json(
    successResponse({
      // Core group deal info
      id: deal.id,
      title: deal.title,
      titleEn: deal.titleEn ?? null,
      description: deal.description ?? null,
      status: deal.status,
      product: {
        id: deal.product.id,
        name: deal.product.name,
        nameEn: deal.product.nameEn ?? null,
        sku: deal.product.sku,
        unit: deal.product.unit,
        basePrice: deal.product.basePrice,
      },
      originalPrice: deal.originalPrice,
      discountPrice: deal.discountPrice,
      targetQty: deal.targetQty,
      currentQty: deal.currentQty,
      maxParticipants: deal.maxParticipants,
      ward: deal.ward
        ? {
            id: deal.ward.id,
            name: deal.ward.name,
            nameEn: deal.ward.nameEn ?? null,
            district: deal.ward.district,
            province: deal.ward.province,
          }
        : null,
      startsAt: deal.startsAt,
      expiresAt: deal.expiresAt,
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,

      // Batch summary
      orderSummary: {
        total: totalOrders,
        byStatus,
        fulfillmentPct,
      },
      totalValue,
      participantCount: deal.participants.length,

      // Participants list
      participants: participantList,

      // Per-order tracking
      orders: orderTracking,

      // Consolidated picking list
      pickingList: {
        items: pickingList,
        summary: {
          totalProducts: pickingList.length,
          totalQty: pickingList.reduce((sum, p) => sum + p.totalQty, 0),
          totalFreeQty: pickingList.reduce((sum, p) => sum + p.totalFreeQty, 0),
          totalValue: pickingList.reduce((sum, p) => sum + p.totalValue, 0),
        },
      },
    }),
  );
}