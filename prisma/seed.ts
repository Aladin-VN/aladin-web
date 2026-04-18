// ALADIN Database Seed Script
// Populates the database with sample data for development

import { db } from '../src/lib/db';

async function main() {
  console.log('🌱 Seeding ALADIN database...\n');

  // Clean up existing data (in reverse dependency order)
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.transaction.deleteMany();
  await db.groupDealParticipant.deleteMany();
  await db.groupDeal.deleteMany();
  await db.shipment.deleteMany();
  await db.promotionItem.deleteMany();
  await db.merchandisingAudit.deleteMany();
  await db.promotion.deleteMany();
  await db.broker.deleteMany();
  await db.product.deleteMany();
  await db.shop.deleteMany();
  await db.user.deleteMany();
  await db.ward.deleteMany();
  await db.category.deleteMany();
  await db.distributor.deleteMany();
  await db.manufacturer.deleteMany();

  // ============================================
  // 1. CATEGORIES
  // ============================================
  const categories = await Promise.all([
    db.category.upsert({ where: { slug: 'gao' }, update: {}, create: { name: 'Gạo', nameEn: 'Rice', slug: 'gao', icon: '🌾', sortOrder: 1 } }),
    db.category.upsert({ where: { slug: 'dau-an' }, update: {}, create: { name: 'Dầu ăn', nameEn: 'Cooking Oil', slug: 'dau-an', icon: '🫒', sortOrder: 2 } }),
    db.category.upsert({ where: { slug: 'mi-an-lien' }, update: {}, create: { name: 'Mì ăn liền', nameEn: 'Instant Noodles', slug: 'mi-an-lien', icon: '🍜', sortOrder: 3 } }),
    db.category.upsert({ where: { slug: 'nuoc-giai-khat' }, update: {}, create: { name: 'Nước giải khát', nameEn: 'Beverages', slug: 'nuoc-giai-khat', icon: '🥤', sortOrder: 4 } }),
    db.category.upsert({ where: { slug: 'do-an-vat' }, update: {}, create: { name: 'Đồ ăn vặt', nameEn: 'Snacks', slug: 'do-an-vat', icon: '🍪', sortOrder: 5 } }),
    db.category.upsert({ where: { slug: 'gia-vi' }, update: {}, create: { name: 'Gia vị', nameEn: 'Seasonings', slug: 'gia-vi', icon: '🧂', sortOrder: 6 } }),
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // ============================================
  // 2. WARDS
  // ============================================
  const wards = await Promise.all([
    db.ward.create({ data: { name: 'Phú Mỹ', nameEn: 'Phu My', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' } }),
    db.ward.create({ data: { name: 'Chánh Nghĩa', nameEn: 'Chanh Nghia', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' } }),
    db.ward.create({ data: { name: 'Hiệp Thành', nameEn: 'Hiep Thanh', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' } }),
    db.ward.create({ data: { name: 'Dĩ An', nameEn: 'Di An', district: 'Thị xã Dĩ An', province: 'Binh Duong' } }),
    db.ward.create({ data: { name: 'Thuận Giao', nameEn: 'Thuan Giao', district: 'Thị xã Dĩ An', province: 'Binh Duong' } }),
  ]);
  console.log(`✅ Created ${wards.length} wards`);

  // ============================================
  // 3. USERS & SHOPS
  // ============================================
  const adminUser = await db.user.upsert({
    where: { phone: '0901234567' },
    update: {},
    create: {
      phone: '0901234567',
      name: 'Quyet Dinh',
      nameEn: 'Quyet Dinh',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: 'seed_hash_admin', // Would be real hash in production
    },
  });
  console.log(`✅ Created admin: ${adminUser.name}`);

  const shopNames = [
    { name: 'Tạp Hóa Hạnh Phúc', nameEn: 'Hanh Phuc Grocery' },
    { name: 'Cửa Hàng Tâm An', nameEn: 'Tam An Shop' },
    { name: 'Tạp Hóa Bình Minh', nameEn: 'Binh Minh Grocery' },
    { name: 'Siêu Thị Mini Phước Long', nameEn: 'Phuoc Long Mini Mart' },
    { name: 'Tạp Hóa Lộc Phát', nameEn: 'Loc Phat Grocery' },
  ];

  const shops = [];
  for (let i = 0; i < shopNames.length; i++) {
    const ward = wards[i % wards.length];
    const user = await db.user.create({
      data: {
        phone: `0901234${568 + i}`,
        name: `Chủ ${shopNames[i].name}`,
        role: 'SHOP_OWNER',
        status: 'ACTIVE',
        passwordHash: `seed_hash_shop_${i}`,
      },
    });

    const shop = await db.shop.create({
      data: {
        userId: user.id,
        name: shopNames[i].name,
        nameEn: shopNames[i].nameEn,
        wardId: ward.id,
        district: ward.district,
        province: ward.province,
        creditLimit: [1000000, 2000000, 1500000, 3000000, 1000000][i],
        creditBalance: [500000, 1500000, 0, 2000000, 1000000][i],
        creditStatus: ['ACTIVE', 'ACTIVE', 'ACTIVE', 'LOCKED', 'OVERDUE'][i],
        loyaltyTier: ['SILVER', 'GOLD', 'BRONZE', 'PLATINUM', 'BRONZE'][i],
        totalOrders: [15, 28, 5, 42, 8][i],
        totalGmv: [45000000, 95000000, 12000000, 150000000, 25000000][i],
      },
    });
    shops.push({ user, shop });
  }
  console.log(`✅ Created ${shops.length} shops`);

  // ============================================
  // 4. MANUFACTURERS (before products — products reference them)
  // ============================================
  const manufacturers = await Promise.all([
    db.manufacturer.create({ data: { name: 'Công ty Lương thực Bình Dương', nameEn: 'Binh Duong Food Corp', contactPerson: 'Anh Minh', contactPhone: '0911222333', commissionRate: 0.15 } }),
    db.manufacturer.create({ data: { name: 'Tập đoàn Dầu ăn Tương An', nameEn: 'Tuong An Oil Group', contactPerson: 'Chị Lan', contactPhone: '0911333444', commissionRate: 0.18 } }),
    db.manufacturer.create({ data: { name: 'Công ty Thực phẩm Acecook', nameEn: 'Acecook Vietnam', contactPerson: 'Anh Hùng', contactPhone: '0911444555', commissionRate: 0.12 } }),
  ]);
  console.log(`✅ Created ${manufacturers.length} manufacturers`);

  // ============================================
  // 5. PRODUCTS
  // ============================================
  const productsData = [
    // === Rice (Gạo) ===
    { sku: 'GAO-ST25-10', name: 'Gạo ST25 (10kg)', nameEn: 'ST25 Rice (10kg)', catIdx: 0, brand: 'ST25', price: 250000, groupPrice: 220000, stock: 500, unit: 'bao', manufacturerIdx: 0, barcode: '8938500001001', isPL: true },
    { sku: 'GAO-JASMINE-20', name: 'Gạo Jasmine (20kg)', nameEn: 'Jasmine Rice (20kg)', catIdx: 0, brand: 'Jasmine', price: 380000, groupPrice: 340000, stock: 300, unit: 'bao', manufacturerIdx: 0, barcode: '8938500001002' },
    { sku: 'GAO-NANG-HUONG-10', name: 'Gạo Nàng Hương (10kg)', nameEn: 'Nang Huong Rice (10kg)', catIdx: 0, brand: 'Nàng Hương', price: 215000, groupPrice: 190000, stock: 400, unit: 'bao', manufacturerIdx: 0 },
    { sku: 'GAO-THOM-XANH-5', name: 'Gạo Thơm Xanh (5kg)', nameEn: 'Green Fragrant Rice (5kg)', catIdx: 0, brand: 'Thơm Xanh', price: 135000, groupPrice: 120000, stock: 250, unit: 'bao', manufacturerIdx: 0 },
    // === Cooking Oil (Dầu ăn) ===
    { sku: 'DAU-SIMPLY-5L', name: 'Dầu ăn Simply (5L)', nameEn: 'Simply Cooking Oil (5L)', catIdx: 1, brand: 'Simply', price: 175000, groupPrice: 155000, stock: 200, unit: 'chai', manufacturerIdx: 1, barcode: '8938500002001' },
    { sku: 'DAU-TUONG-AN-2L', name: 'Dầu Tương An (2L)', nameEn: 'Tuong An Oil (2L)', catIdx: 1, brand: 'Tương An', price: 89000, groupPrice: 79000, stock: 350, unit: 'chai', manufacturerIdx: 1, barcode: '8938500002002' },
    { sku: 'DAU-THANH-NHAT-1L', name: 'Dầu Thảnh Nhất (1L)', nameEn: 'Thanh Nhat Oil (1L)', catIdx: 1, brand: 'Thảnh Nhất', price: 42000, groupPrice: 37000, stock: 15, unit: 'chai', manufacturerIdx: 1 },
    { sku: 'DAU-MAM-CAI-5L', name: 'Dầu Mắm Cái (5L)', nameEn: 'Mam Cai Oil (5L)', catIdx: 1, brand: 'Mắm Cái', price: 168000, groupPrice: 148000, stock: 0, unit: 'chai', manufacturerIdx: 1 },
    // === Instant Noodles (Mì ăn liền) ===
    { sku: 'MI-HAOHAO-30', name: 'Mì Hảo Hảo (Gói 30)', nameEn: 'Hao Hao Noodles (Pack 30)', catIdx: 2, brand: 'Hảo Hảo', price: 115000, groupPrice: 99000, stock: 1000, unit: 'thung', manufacturerIdx: 2, barcode: '8938500003001' },
    { sku: 'MI-OMACHI-30', name: 'Mì Omachi (Gói 30)', nameEn: 'Omachi Noodles (Pack 30)', catIdx: 2, brand: 'Omachi', price: 125000, groupPrice: 109000, stock: 800, unit: 'thung', manufacturerIdx: 2, barcode: '8938500003002' },
    { sku: 'MI-CAY-30', name: 'Mì Cay (Gói 30)', nameEn: 'Spicy Noodles (Pack 30)', catIdx: 2, brand: 'Mì Cay', price: 108000, groupPrice: 95000, stock: 600, unit: 'thung', manufacturerIdx: 2 },
    { sku: 'MI-3-MIEN-30', name: 'Mì 3 Miền (Gói 30)', nameEn: '3 Mien Noodles (Pack 30)', catIdx: 2, brand: '3 Miền', price: 118000, groupPrice: 103000, stock: 30, unit: 'thung', manufacturerIdx: 2 },
    // === Beverages (Nước giải khát) ===
    { sku: 'NUOC-LAVIE-6', name: 'Nước LaVie (Lốc 6)', nameEn: 'LaVie Water (6-pack)', catIdx: 3, brand: 'LaVie', price: 45000, groupPrice: 39000, stock: 2000, unit: 'loc', barcode: '8938500004001' },
    { sku: 'BIA-SAIGON-24', name: 'Bia Sài Gòn (Thùng 24)', nameEn: 'Saigon Beer (Case 24)', catIdx: 3, brand: 'Sài Gòn', price: 320000, groupPrice: 285000, stock: 150, unit: 'thung', barcode: '8938500004002' },
    { sku: 'BIA-HEINEKEN-24', name: 'Bia Heineken (Thùng 24)', nameEn: 'Heineken Beer (Case 24)', catIdx: 3, brand: 'Heineken', price: 520000, groupPrice: 480000, stock: 100, unit: 'thung' },
    { sku: 'TRA-DRTHANH-24', name: 'Trà Địa Trùng Khánh (Thùng 24)', nameEn: 'DrThanh Tea (Case 24)', catIdx: 3, brand: 'Địa Trùng Khánh', price: 145000, groupPrice: 128000, stock: 500, unit: 'thung', barcode: '8938500004003' },
    { sku: 'NUOC-TIGER-24', name: 'Nước Tiger (Thùng 24)', nameEn: 'Tiger Water (Case 24)', catIdx: 3, brand: 'Tiger', price: 85000, groupPrice: 75000, stock: 0, unit: 'thung' },
    // === Snacks (Đồ ăn vặt) ===
    { sku: 'BISCO-OREO-10', name: 'Bánh Oreo (Gói 10)', nameEn: 'Oreo Cookies (Pack 10)', catIdx: 4, brand: 'Oreo', price: 65000, groupPrice: 56000, stock: 400, unit: 'hop', barcode: '8938500005001' },
    { sku: 'BISCO-COSY-10', name: 'Bánh Cosy (Gói 10)', nameEn: 'Cosy Cookies (Pack 10)', catIdx: 4, brand: 'Cosy', price: 42000, groupPrice: 36000, stock: 350, unit: 'hop' },
    { sku: 'DAU-PEANUT-500G', name: 'Đậu Phộng (500g)', nameEn: 'Peanuts (500g)', catIdx: 4, brand: 'Đậu Phộng', price: 35000, groupPrice: null, stock: 200, unit: 'goi' },
    { sku: 'KHAO-SATAY-10', name: 'Khao Satay (Gói 10)', nameEn: 'Satay Crackers (Pack 10)', catIdx: 4, brand: 'Satay', price: 28000, groupPrice: 24000, stock: 8, unit: 'goi' },
    // === Seasonings (Gia vị) ===
    { sku: 'GIA-VI-NAM-BO', name: 'Gia vị Nam Bộ (Hộp)', nameEn: 'Southern Seasoning (Box)', catIdx: 5, brand: 'Nam Bộ', price: 35000, groupPrice: null, stock: 600, unit: 'hop', barcode: '8938500006001' },
    { sku: 'MUOI-IOT-500G', name: 'Muối I-ốt (500g)', nameEn: 'Iodized Salt (500g)', catIdx: 5, brand: 'Muối', price: 12000, groupPrice: null, stock: 800, unit: 'goi' },
    { sku: 'DUONG-REFINE-1KG', name: 'Đường Refined (1kg)', nameEn: 'Refined Sugar (1kg)', catIdx: 5, brand: 'Đường', price: 25000, groupPrice: 22000, stock: 700, unit: 'goi', barcode: '8938500006002' },
    { sku: 'BOT-GIA-VI-200G', name: 'Bột Gia Vị (200g)', nameEn: 'Seasoning Powder (200g)', catIdx: 5, brand: 'Knorr', price: 18000, groupPrice: 15000, stock: 0, unit: 'goi' },
  ];

  const products = await Promise.all(
    productsData.map((p) =>
      db.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          nameEn: p.nameEn,
          categoryId: categories[p.catIdx].id,
          brand: p.brand,
          unit: p.unit,
          unitEn: p.unitEn || null,
          basePrice: p.price,
          groupBuyPrice: p.groupPrice,
          stockQuantity: p.stock,
          minOrderQty: 1,
          maxOrderQty: p.maxQty || null,
          weightKg: p.weight || null,
          barcode: p.barcode || null,
          manufacturerId: p.manufacturerIdx !== undefined ? manufacturers[p.manufacturerIdx].id : null,
          isActive: true,
          isPrivateLabel: p.isPL || false,
        },
      })
    )
  );
  console.log(`✅ Created ${products.length} products`);

  // ============================================
  // 6. ORDERS (with idempotency keys + 2% digital discount)
  // ============================================
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let orderSeq = 0;

  const orderData = [
    // Shop 0 — DIGITAL with 2% Pay Now discount (delivered, fully paid)
    { shop: 0, items: [{ prod: 0, qty: 10 }, { prod: 2, qty: 3 }], method: 'DIGITAL', status: 'DELIVERED', daysAgo: 12, idempotencyKey: `seed-shop0-order1-${dateStr}` },
    // Shop 1 — CREDIT (delivered, partially repaid — 500k of 1.3M)
    { shop: 1, items: [{ prod: 0, qty: 5 }, { prod: 4, qty: 2 }], method: 'CREDIT', status: 'DELIVERED', daysAgo: 10, idempotencyKey: `seed-shop1-order1-${dateStr}` },
    // Shop 2 — COD (delivered, fully paid on delivery)
    { shop: 2, items: [{ prod: 4, qty: 3 }, { prod: 6, qty: 5 }], method: 'COD', status: 'DELIVERED', daysAgo: 8, idempotencyKey: `seed-shop2-order1-${dateStr}` },
    // Shop 0 — DIGITAL with 2% discount (out for delivery, not yet paid)
    { shop: 0, items: [{ prod: 1, qty: 3 }, { prod: 3, qty: 5 }], method: 'DIGITAL', status: 'OUT_FOR_DELIVERY', daysAgo: 1, idempotencyKey: `seed-shop0-order2-${dateStr}` },
    // Shop 3 — CREDIT (confirmed, large order that pushed shop to LOCKED)
    { shop: 3, items: [{ prod: 0, qty: 20 }, { prod: 2, qty: 10 }, { prod: 4, qty: 5 }], method: 'CREDIT', status: 'CONFIRMED', daysAgo: 0, idempotencyKey: `seed-shop3-order1-${dateStr}` },
    // Shop 4 — COD (pending, overdue shop)
    { shop: 4, items: [{ prod: 7, qty: 3 }], method: 'COD', status: 'PENDING', daysAgo: 0, idempotencyKey: `seed-shop4-order1-${dateStr}` },
    // Shop 1 — DIGITAL with 2% discount (processing)
    { shop: 1, items: [{ prod: 5, qty: 4 }, { prod: 8, qty: 6 }], method: 'DIGITAL', status: 'PROCESSING', daysAgo: 0, idempotencyKey: `seed-shop1-order2-${dateStr}` },
    // Shop 0 — CREDIT (packed, recent credit order contributing to 500k balance)
    { shop: 0, items: [{ prod: 0, qty: 15 }, { prod: 4, qty: 3 }, { prod: 6, qty: 10 }], method: 'CREDIT', status: 'PACKED', daysAgo: 0, idempotencyKey: `seed-shop0-order3-${dateStr}` },
    // Shop 0 — CANCELLED order (credit was refunded)
    { shop: 0, items: [{ prod: 8, qty: 2 }], method: 'CREDIT', status: 'CANCELLED', daysAgo: 5, idempotencyKey: `seed-shop0-cancel1-${dateStr}` },
  ];

  const orders = [];
  for (const od of orderData) {
    orderSeq++;
    const subtotal = od.items.reduce((sum, item) => sum + products[item.prod].basePrice * item.qty, 0);
    const orderNum = `ALD-${dateStr}-${String(orderSeq).padStart(3, '0')}`;
    const createdAt = new Date(now.getTime() - od.daysAgo * 24 * 60 * 60 * 1000);

    // Calculate 2% discount for DIGITAL (Pay Now) orders
    const payNowDiscount = od.method === 'DIGITAL' ? Math.round(subtotal * 0.02) : 0;
    const deliveryFee = od.method === 'COD' ? 15000 : 0;
    const totalAmount = subtotal - payNowDiscount + deliveryFee;

    // Determine payment status based on state
    let paymentStatus = 'PENDING';
    let paidAmount = 0;
    let creditUsed = 0;

    if (od.status === 'DELIVERED') {
      if (od.method === 'DIGITAL') {
        paymentStatus = 'PAID';
        paidAmount = totalAmount;
      } else if (od.method === 'COD') {
        paymentStatus = 'PAID';
        paidAmount = totalAmount;
      } else if (od.method === 'CREDIT') {
        paymentStatus = 'PENDING'; // Credit orders track via creditUsed + repayments
        creditUsed = subtotal;
      }
    } else if (od.method === 'CREDIT') {
      creditUsed = subtotal;
    } else if (od.status === 'CANCELLED') {
      paymentStatus = 'REFUNDED';
      creditUsed = subtotal;
    }

    const order = await db.order.create({
      data: {
        orderNumber: orderNum,
        shopId: shops[od.shop].shop.id,
        shopSnapshot: JSON.stringify({
          id: shops[od.shop].shop.id,
          name: shops[od.shop].shop.name,
          nameEn: shops[od.shop].shop.nameEn,
          phone: shops[od.shop].user.phone,
          address: shops[od.shop].shop.address || null,
          district: shops[od.shop].shop.district || null,
          province: shops[od.shop].shop.province,
          shopType: shops[od.shop].shop.shopType,
        }),
        status: od.status,
        paymentMethod: od.method,
        paymentStatus,
        subtotalAmount: subtotal,
        discountAmount: payNowDiscount,
        deliveryFee,
        totalAmount,
        paidAmount,
        creditUsed,
        idempotencyKey: od.idempotencyKey,
        customerNotes: od.method === 'DIGITAL' ? 'Đặt qua Zalo AI Bot' : 'Đặt qua Zalo AI Bot',
        createdAt,
        confirmedAt: od.status !== 'PENDING' ? createdAt : null,
        packedAt: ['PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(od.status) ? createdAt : null,
        deliveredAt: od.status === 'DELIVERED' ? new Date(createdAt.getTime() + 86400000) : null,

      },
    });

    for (const item of od.items) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: products[item.prod].id,
          productName: products[item.prod].name,
          productSku: products[item.prod].sku,
          unitPrice: products[item.prod].basePrice,
          quantity: item.qty,
          totalPrice: products[item.prod].basePrice * item.qty,
        },
      });
    }

    orders.push(order);
  }
  console.log(`✅ Created ${orders.length} orders (including 1 cancelled)`);

  // ============================================
  // 7. TRANSACTIONS (Credit Ledger)
  // ============================================
  const transactions = [];

  // Helper: generate unique idempotency keys for transactions
  const txKeys = new Set<string>();
  function uniqueTxKey(base: string): string {
    let key = base;
    let counter = 0;
    while (txKeys.has(key)) {
      counter++;
      key = `${base}-${counter}`;
    }
    txKeys.add(key);
    return key;
  }

  // Order 1: Shop 0 — DIGITAL payment recorded (fully paid, no credit impact)
  await db.transaction.create({
    data: {
      shopId: shops[0].shop.id,
      orderId: orders[0].id,
      type: 'ORDER_PAYMENT',
      amount: -orders[0].totalAmount,
      runningBalance: 0,
      paymentMethod: 'DIGITAL',
      description: `Order ${orders[0].orderNumber} — paid in full via MoMo`,
    },
  });
  transactions.push('ORDER_PAYMENT (Shop 0, Order 1)');

  // Order 2: Shop 1 — CREDIT_USED (1,430,000d) → partially repaid (500,000d)
  const creditUsedAmount = orders[1].subtotalAmount; // 1,430,000
  const repayAmount = 500000;
  const remainingAfterRepay = creditUsedAmount - repayAmount; // 930,000

  await db.transaction.create({
    data: {
      shopId: shops[1].shop.id,
      orderId: orders[1].id,
      type: 'CREDIT_USED',
      amount: creditUsedAmount,
      runningBalance: creditUsedAmount,
      paymentMethod: 'CREDIT',
      description: `Order ${orders[1].orderNumber} — credit used`,
    },
  });

  await db.transaction.create({
    data: {
      shopId: shops[1].shop.id,
      orderId: orders[1].id,
      type: 'REPAYMENT',
      amount: -repayAmount,
      runningBalance: remainingAfterRepay,
      paymentMethod: 'CASH',
      collectedBy: 'sales_rep_001',
      description: `Partial repayment — ${repayAmount.toLocaleString('vi-VN')}d of ${creditUsedAmount.toLocaleString('vi-VN')}d (collected by Sales Rep)`,
    },
  });
  transactions.push('CREDIT_USED + REPAYMENT (Shop 1, Order 2 — partial)');

  // Order 3: Shop 2 — COD payment recorded (fully paid on delivery)
  await db.transaction.create({
    data: {
      shopId: shops[2].shop.id,
      orderId: orders[2].id,
      type: 'ORDER_PAYMENT',
      amount: -orders[2].totalAmount,
      runningBalance: 0,
      paymentMethod: 'COD',
      description: `Order ${orders[2].orderNumber} — COD payment on delivery`,
    },
  });
  transactions.push('ORDER_PAYMENT (Shop 2, Order 3 — COD)');

  // Order 4: Shop 0 — DIGITAL payment (not yet paid — OUT_FOR_DELIVERY)
  // No transaction yet — order is still in transit

  // Order 5: Shop 3 — CREDIT_USED (5,600,000d) — large order that pushed shop to LOCKED
  await db.transaction.create({
    data: {
      shopId: shops[3].shop.id,
      orderId: orders[4].id,
      type: 'CREDIT_USED',
      amount: orders[4].subtotalAmount,
      runningBalance: orders[4].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Order ${orders[4].orderNumber} — credit used (lock triggered: at limit)`,
      metadata: JSON.stringify({ action: 'AUTO_LOCK_TRIGGER', previousBalance: shops[3].shop.creditBalance - orders[4].subtotalAmount }),
    },
  });
  transactions.push('CREDIT_USED (Shop 3, Order 5 — lock trigger)');

  // Order 6: Shop 4 — COD pending — no transaction yet

  // Order 7: Shop 1 — DIGITAL payment (processing, not yet paid)
  // No transaction yet — order is being processed

  // Order 8: Shop 0 — CREDIT_USED (500,000d from packed order)
  await db.transaction.create({
    data: {
      shopId: shops[0].shop.id,
      orderId: orders[7].id,
      type: 'CREDIT_USED',
      amount: orders[7].subtotalAmount,
      runningBalance: orders[7].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Order ${orders[7].orderNumber} — credit used`,
    },
  });
  transactions.push('CREDIT_USED (Shop 0, Order 8)');

  // Order 9: Shop 0 — CANCELLED — REFUND for credit used
  const cancelledCredit = orders[8].subtotal;
  await db.transaction.create({
    data: {
      shopId: shops[0].shop.id,
      orderId: orders[8].id,
      type: 'CREDIT_USED',
      amount: cancelledCredit,
      runningBalance: cancelledCredit,
      paymentMethod: 'CREDIT',
      description: `Order ${orders[8].orderNumber} — credit used`,
    },
  });

  await db.transaction.create({
    data: {
      shopId: shops[0].shop.id,
      orderId: orders[8].id,
      type: 'REFUND',
      amount: -cancelledCredit,
      runningBalance: 0,
      description: `Order ${orders[8].orderNumber} — credit refund (order cancelled)`,
      metadata: JSON.stringify({ reason: 'Shop owner requested cancellation', refundType: 'CREDIT' }),
    },
  });
  transactions.push('CREDIT_USED + REFUND (Shop 0, Order 9 — cancelled)');

  // Credit limit adjustment: Shop 3 had limit increased from 2M to 3M by admin
  await db.transaction.create({
    data: {
      shopId: shops[3].shop.id,
      type: 'CREDIT_LIMIT_INCREASE',
      amount: 0,
      runningBalance: shops[3].shop.creditBalance,
      description: 'Credit limit increased from 2,000,000d to 3,000,000d by admin',
      metadata: JSON.stringify({ oldLimit: 2000000, newLimit: 3000000, adminUserId: adminUser.id }),
    },
  });
  transactions.push('CREDIT_LIMIT_INCREASE (Shop 3 — admin adjustment)');

  // Credit limit adjustment: Shop 1 had limit increased from 1M to 2M
  await db.transaction.create({
    data: {
      shopId: shops[1].shop.id,
      type: 'CREDIT_LIMIT_INCREASE',
      amount: 0,
      runningBalance: shops[1].shop.creditBalance,
      description: 'Credit limit increased from 1,000,000d to 2,000,000d by admin',
      metadata: JSON.stringify({ oldLimit: 1000000, newLimit: 2000000, adminUserId: adminUser.id }),
    },
  });
  transactions.push('CREDIT_LIMIT_INCREASE (Shop 1 — admin adjustment)');

  // ============================================
  // 8. RECALCULATE SHOP CREDIT BALANCES from transactions
  // ============================================
  // Recompute to ensure consistency with ledger
  for (const { shop } of shops) {
    const creditTransactions = await db.transaction.findMany({
      where: { shopId: shop.id, type: { in: ['CREDIT_USED', 'REPAYMENT', 'REFUND'] } },
      select: { amount: true },
    });

    const computedBalance = creditTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Only update if computed differs from stored (to respect seed initial values)
    if (computedBalance !== shop.creditBalance) {
      await db.shop.update({
        where: { id: shop.id },
        data: { creditBalance: computedBalance },
      });
    }
  }

  console.log(`✅ Created ${transactions.length} transaction ledger entries`);

  console.log('\n🎉 Seed completed successfully!');
  console.log('  - 1 Admin user (0901234567)');
  console.log(`  - ${shops.length} Shops (1 ACTIVE, 1 ACTIVE w/ partial debt, 1 clean, 1 LOCKED, 1 OVERDUE)`);
  console.log(`  - ${products.length} Products (4 categories)`);
  console.log(`  - ${orders.length} Orders (incl. 1 cancelled, 2 DIGITAL w/ 2% discount)`);
  console.log(`  - ${transactions.length} Transactions (CREDIT_USED, REPAYMENT, REFUND, ORDER_PAYMENT, LIMIT changes)`);
  console.log(`  - ${manufacturers.length} Manufacturers`);
  console.log(`  - ${categories.length} Categories`);
  console.log(`  - ${wards.length} Wards`);
  console.log('\n📋 Credit State Summary:');
  for (const { shop } of shops) {
    console.log(`  ${shop.name}: limit=${shop.creditLimit.toLocaleString('vi-VN')}d, balance=${shop.creditBalance.toLocaleString('vi-VN')}d, status=${shop.creditStatus}`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
