// ALADIN Demo API — Create Demo Order
// POST /api/demo/create-order
// Creates a demo order for "Tạp Hóa Hạnh Phúc" (first shop owner with a shop)
// Picks 2-3 random products, creates order with CREDIT payment

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// POST /api/demo/create-order
// ============================================

export async function POST() {
  try {
    // 1. Find first SHOP_OWNER user with a shop
    const shopOwnerUser = await db.user.findFirst({
      where: {
        role: 'SHOP_OWNER',
        status: 'ACTIVE',
        shop: { isNot: null },
      },
      include: { shop: true },
      orderBy: { createdAt: 'asc' },
    });

    if (!shopOwnerUser || !shopOwnerUser.shop) {
      return NextResponse.json(
        { success: false, error: 'No shop owner with shop found. Please run seed first.' },
        { status: 404 }
      );
    }

    const shop = shopOwnerUser.shop;

    // 2. Pick 2-3 random active products with stock
    const availableProducts = await db.product.findMany({
      where: {
        isActive: true,
        stockQuantity: { gt: 0 },
      },
    });

    if (availableProducts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Not enough products in database. Please run seed first.' },
        { status: 404 }
      );
    }

    // Shuffle and pick 2-3 products
    const count = 2 + Math.floor(Math.random() * 2); // 2 or 3
    const shuffled = availableProducts.sort(() => Math.random() - 0.5);
    const selectedProducts = shuffled.slice(0, count);

    // 3. Build order items with random quantities
    const orderItems: {
      productId: string;
      productName: string;
      productSku: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }[] = [];

    let subtotalAmount = 0;

    for (const product of selectedProducts) {
      const maxQty = Math.min(product.maxOrderQty || 10, product.stockQuantity);
      const quantity = 1 + Math.floor(Math.random() * Math.min(maxQty, 10));
      const unitPrice = product.basePrice;
      const totalPrice = unitPrice * quantity;
      subtotalAmount += totalPrice;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitPrice,
        quantity,
        totalPrice,
      });
    }

    // 4. Generate order number: ALD-YYYYMMDD-XXX
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const prefix = `ALD-${dateStr}-`;

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

    // 5. Build shop snapshot
    const shopSnapshot = JSON.stringify({
      id: shop.id,
      name: shop.name,
      nameEn: shop.nameEn || null,
      phone: shopOwnerUser.phone,
      address: shop.address || null,
      district: shop.district || null,
      province: shop.province,
      shopType: shop.shopType,
    });

    const totalAmount = subtotalAmount; // No discount/delivery for demo simplicity
    const creditUsed = totalAmount;

    // 6. Create order + items + transaction in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the order
      const order = await tx.order.create({
        data: {
          orderNumber,
          shopId: shop.id,
          shopSnapshot,
          status: 'PENDING',
          paymentMethod: 'CREDIT',
          paymentStatus: 'PENDING',
          subtotalAmount,
          discountAmount: 0,
          deliveryFee: 0,
          totalAmount,
          creditUsed,
          customerNotes: 'Đơn hàng demo — Investor Demo',
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

      // Create CREDIT_USED transaction
      const newBalance = shop.creditBalance + creditUsed;
      await tx.transaction.create({
        data: {
          shopId: shop.id,
          orderId: order.id,
          type: 'CREDIT_USED',
          amount: creditUsed,
          runningBalance: newBalance,
          paymentMethod: 'CREDIT',
          description: `Demo order ${orderNumber} — credit used`,
        },
      });

      // Update shop credit balance
      await tx.shop.update({
        where: { id: shop.id },
        data: {
          creditBalance: newBalance,
          totalOrders: { increment: 1 },
          totalGmv: { increment: totalAmount },
        },
      });

      return order;
    });

    // 7. Fetch the complete order with items
    const createdOrder = await db.order.findUnique({
      where: { id: result.id },
      include: {
        items: true,
        shop: { select: { name: true, district: true, province: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        order: createdOrder,
        message: `Demo order ${orderNumber} created for ${shop.name}`,
      },
    });
  } catch (error) {
    console.error('[DEMO CREATE ORDER ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create demo order' },
      { status: 500 }
    );
  }
}