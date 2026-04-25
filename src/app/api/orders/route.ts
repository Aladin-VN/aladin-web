// ALADIN Order API — List & Create
// GET /api/orders — paginated list with search, filter, sort
// POST /api/orders — create new order (admin/zalo)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import {
  sanitizeInput,
  successResponse,
  errorResponse,
  rateLimit,
  formatVND,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  TRANSACTION_TYPES,
  CREDIT_CONFIG,
} from '@/lib/security';

// ============================================
// GET /api/orders — List Orders
// ============================================

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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const paymentMethod = searchParams.get('paymentMethod') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build WHERE clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { shop: { name: { contains: search } } },
      ];
    }

    if (status && Object.values(ORDER_STATUS).includes(status as typeof ORDER_STATUS[keyof typeof ORDER_STATUS])) {
      where.status = status;
    }

    if (paymentMethod && Object.values(PAYMENT_METHOD).includes(paymentMethod as typeof PAYMENT_METHOD[keyof typeof PAYMENT_METHOD])) {
      where.paymentMethod = paymentMethod;
    }

    if (paymentStatus && Object.values(PAYMENT_STATUS).includes(paymentStatus as typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS])) {
      where.paymentStatus = paymentStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Include the entire end day by adding 1 day
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        (where.createdAt as Record<string, unknown>).lt = endDate;
      }
    }

    // Build ORDER BY
    const orderBy: Record<string, string> = {};
    if (sortBy === 'orderNumber') {
      orderBy.orderNumber = sortOrder;
    } else if (sortBy === 'totalAmount') {
      orderBy.totalAmount = sortOrder;
    } else if (sortBy === 'status') {
      orderBy.status = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Parallel queries for performance
    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          shop: { select: { name: true } },
          items: { select: { id: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json(
      successResponse({
        items: orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          shopName: o.shop.name,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          totalAmount: o.totalAmount,
          totalAmountFormatted: formatVND(o.totalAmount),
          itemCount: o.items.length,
          createdAt: o.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    console.error('[ORDERS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch orders'),
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/orders — Create Order
// ============================================

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP', 'SHOP_OWNER'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin, Sales Rep, or Shop Owner access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`order:create:${payload.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const body = await request.json();
    let { shopId, items, paymentMethod, customerNotes, idempotencyKey } = body;

    // --- Validation ---
    const errors: string[] = [];

    // SHOP_OWNER: auto-derive shopId from their user record if not provided
    if (payload.role === 'SHOP_OWNER' && !shopId) {
      const ownerShop = await db.shop.findFirst({
        where: { userId: payload.userId },
        select: { id: true },
      });
      if (ownerShop) shopId = ownerShop.id;
    }

    if (!shopId) errors.push('shopId is required');
    if (!items || !Array.isArray(items) || items.length === 0) {
      errors.push('items is required and must be a non-empty array');
    }
    if (!paymentMethod || !Object.values(PAYMENT_METHOD).includes(paymentMethod)) {
      errors.push('Valid paymentMethod is required (CREDIT, DIGITAL, COD)');
    }

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // SHOP_OWNER: verify they own this shop
    if (payload.role === 'SHOP_OWNER') {
      const ownerShop = await db.shop.findFirst({
        where: { id: shopId, userId: payload.userId },
        select: { id: true },
      });
      if (!ownerShop) {
        return NextResponse.json(
          errorResponse('FORBIDDEN', 'You can only create orders for your own shop'),
          { status: 403 }
        );
      }
    }

    // Validate individual items
    for (const item of items) {
      if (!item.productId) errors.push('Each item must have a productId');
      if (!item.quantity || item.quantity < 1) errors.push('Each item must have quantity >= 1');
    }
    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // --- Idempotency check ---
    if (idempotencyKey) {
      const existingOrder = await db.order.findUnique({ where: { idempotencyKey } });
      if (existingOrder) {
        // Return the existing order instead of creating a duplicate
        const existingItems = await db.orderItem.findMany({
          where: { orderId: existingOrder.id },
        });
        return NextResponse.json(
          successResponse({
            order: existingOrder,
            items: existingItems,
            message: 'Order already exists (idempotent)',
          })
        );
      }
    }

    // --- Verify shop exists and get details ---
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: { user: { select: { phone: true } } },
    });
    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }

    // --- Verify products and check stock ---
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));
    let subtotalAmount = 0;
    const orderItems: { productId: string; productName: string; productSku: string; unitPrice: number; quantity: number; totalPrice: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        errors.push(`Product ${item.productId} not found`);
        continue;
      }
      if (!product.isActive) {
        errors.push(`Product "${product.name}" is not active`);
      }
      if (product.stockQuantity < item.quantity) {
        errors.push(`Insufficient stock for "${product.name}" (available: ${product.stockQuantity}, requested: ${item.quantity})`);
      }
      if (product.minOrderQty && item.quantity < product.minOrderQty) {
        errors.push(`Quantity for "${product.name}" is below minimum (${product.minOrderQty})`);
      }
      if (product.maxOrderQty && item.quantity > product.maxOrderQty) {
        errors.push(`Quantity for "${product.name}" exceeds maximum (${product.maxOrderQty})`);
      }

      const unitPrice = product.basePrice;
      const totalPrice = unitPrice * item.quantity;
      subtotalAmount += totalPrice;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitPrice,
        quantity: item.quantity,
        totalPrice,
      });
    }

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // --- Apply 2% Pay Now discount for DIGITAL payment ---
    let discountAmount = 0;
    if (paymentMethod === PAYMENT_METHOD.DIGITAL) {
      discountAmount = Math.round(subtotalAmount * CREDIT_CONFIG.PAY_NOW_DISCOUNT);
    }

    // --- Delivery fee: COD = 15,000 VND, others = 0 ---
    const deliveryFee = paymentMethod === PAYMENT_METHOD.COD ? 15_000 : 0;

    // --- Calculate total ---
    const totalAmount = subtotalAmount - discountAmount + deliveryFee;

    // --- Credit check for CREDIT payment ---
    let creditUsed = 0;
    if (paymentMethod === PAYMENT_METHOD.CREDIT) {
      if (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE') {
        return NextResponse.json(
          errorResponse('CREDIT_LOCKED', `Shop credit is ${shop.creditStatus}. Cannot place credit order.`),
          { status: 403 }
        );
      }
      const availableCredit = shop.creditLimit - shop.creditBalance;
      if (availableCredit < totalAmount) {
        return NextResponse.json(
          errorResponse('INSUFFICIENT_CREDIT', `Insufficient credit. Available: ${formatVND(availableCredit)}, Required: ${formatVND(totalAmount)}`),
          { status: 403 }
        );
      }
      creditUsed = totalAmount;
    }

    // --- Generate order number: ALD-YYYYMMDD-XXX ---
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const prefix = `ALD-${dateStr}-`;

    // Find today's last order number
    const lastOrder = await db.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    let seq = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.orderNumber.slice(prefix.length));
      seq = lastSeq + 1;
    }
    const orderNumber = `${prefix}${String(seq).padStart(3, '0')}`;

    // --- Build shop snapshot ---
    const shopSnapshot = JSON.stringify({
      id: shop.id,
      name: shop.name,
      nameEn: shop.nameEn || null,
      phone: shop.user.phone,
      address: shop.address || null,
      district: shop.district || null,
      province: shop.province,
      shopType: shop.shopType,
    });

    // --- Create Order + OrderItems + Transaction in a single transaction ---
    const result = await db.$transaction(async (tx) => {
      // Create the order
      const order = await tx.order.create({
        data: {
          orderNumber,
          shopId,
          shopSnapshot,
          status: ORDER_STATUS.PENDING,
          paymentMethod,
          paymentStatus: paymentMethod === PAYMENT_METHOD.CREDIT ? PAYMENT_STATUS.PENDING : PAYMENT_STATUS.PENDING,
          subtotalAmount,
          discountAmount,
          deliveryFee,
          totalAmount,
          creditUsed,
          customerNotes: customerNotes ? sanitizeInput(customerNotes) : null,
          idempotencyKey: idempotencyKey || null,
        },
      });

      // Create order items
      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
          },
        });
      }

      // Deduct stock
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // If CREDIT payment: create CREDIT_USED transaction
      if (paymentMethod === PAYMENT_METHOD.CREDIT && creditUsed > 0) {
        const newBalance = shop.creditBalance + creditUsed;
        await tx.transaction.create({
          data: {
            shopId,
            orderId: order.id,
            type: TRANSACTION_TYPES.CREDIT_USED,
            amount: creditUsed,
            runningBalance: newBalance,
            paymentMethod: PAYMENT_METHOD.CREDIT,
            description: `Order ${orderNumber} — credit used`,
          },
        });

        // Update shop credit balance
        await tx.shop.update({
          where: { id: shopId },
          data: {
            creditBalance: newBalance,
            // Auto-lock if at limit
            ...(newBalance >= shop.creditLimit ? { creditStatus: 'LOCKED' } : {}),
          },
        });
      }

      // Update shop stats
      await tx.shop.update({
        where: { id: shopId },
        data: {
          totalOrders: { increment: 1 },
          totalGmv: { increment: totalAmount },
        },
      });

      // Recalculate avgOrderValue
      const updatedShop = await tx.shop.findUnique({ where: { id: shopId } });
      if (updatedShop && updatedShop.totalOrders > 0) {
        await tx.shop.update({
          where: { id: shopId },
          data: {
            avgOrderValue: Math.round(updatedShop.totalGmv / updatedShop.totalOrders),
          },
        });
      }

      return order;
    });

    // Fetch the created order with items for the response
    const createdOrder = await db.order.findUnique({
      where: { id: result.id },
      include: {
        items: true,
        shop: { select: { name: true } },
      },
    });

    return NextResponse.json(
      successResponse({
        order: createdOrder,
        message: `Order ${orderNumber} created successfully`,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[ORDER CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create order'),
      { status: 500 }
    );
  }
}
