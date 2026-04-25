// ALADIN Database Seed Script — Full Workflow (M1→M8)
// Populates all 20 Prisma models with realistic Vietnamese B2B data

import { db } from '../src/lib/db';

// ============================================
// Helpers
// ============================================

const days = (n: number) => n * 24 * 60 * 60 * 1000;
const now = Date.now();
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const vnd = (n: number) => n;

let orderSeq = 0;
const nextOrderNum = () => {
  orderSeq++;
  return `ALD-${dateStr}-${String(orderSeq).padStart(3, '0')}`;
};

async function main() {
  console.log('🌱 Seeding ALADIN database (full workflow)...\n');

  // ============================================
  // CLEAN UP (reverse dependency order)
  // ============================================
  const tables = [
    'chatMessage', 'auditLog', 'platformSetting', 'payment',
    'promotionItem', 'orderItem', 'transaction', 'shipment',
    'groupDealParticipant', 'order', 'groupDeal',
    'merchandisingAudit', 'promotion',
    'broker', 'product', 'distributor', 'manufacturer',
    'shop', 'ward', 'user', 'category',
  ] as const;

  for (const t of tables) {
    try {
      // @ts-ignore
      await db[t].deleteMany();
    } catch {}
  }
  console.log('🧹 Cleaned all tables\n');

  // ============================================
  // 1. CATEGORIES (6)
  // ============================================
  const catData = [
    { name: 'Gạo', nameEn: 'Rice', slug: 'gao', icon: '🌾', order: 1 },
    { name: 'Dầu ăn', nameEn: 'Cooking Oil', slug: 'dau-an', icon: '🫒', order: 2 },
    { name: 'Mì ăn liền', nameEn: 'Instant Noodles', slug: 'mi-an-lien', icon: '🍜', order: 3 },
    { name: 'Nước giải khát', nameEn: 'Beverages', slug: 'nuoc-giai-khat', icon: '🥤', order: 4 },
    { name: 'Đồ ăn vặt', nameEn: 'Snacks', slug: 'do-an-vat', icon: '🍪', order: 5 },
    { name: 'Gia vị', nameEn: 'Seasonings', slug: 'gia-vi', icon: '🧂', order: 6 },
  ];
  const categories = await Promise.all(
    catData.map((c) =>
      db.category.create({
        data: {
          name: c.name,
          nameEn: c.nameEn,
          slug: c.slug,
          icon: c.icon,
          sortOrder: c.order,
          isActive: true,
        },
      })
    )
  );
  console.log(`✅ ${categories.length} categories`);

  // ============================================
  // 2. WARDS (8 — across 3 districts)
  // ============================================
  const wardData = [
    { name: 'Phú Mỹ', nameEn: 'Phu My', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' },
    { name: 'Chánh Nghĩa', nameEn: 'Chanh Nghia', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' },
    { name: 'Hiệp Thành', nameEn: 'Hiep Thanh', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' },
    { name: 'Dĩ An', nameEn: 'Di An', district: 'Thị xã Dĩ An', province: 'Binh Duong' },
    { name: 'Thuận Giao', nameEn: 'Thuan Giao', district: 'Thị xã Dĩ An', province: 'Binh Duong' },
    { name: 'Bình Chiểu', nameEn: 'Binh Chieu', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' },
    { name: 'Tân Định', nameEn: 'Tan Dinh', district: 'TP. Thủ Dầu Một', province: 'Binh Duong' },
    { name: 'Vĩnh Phú', nameEn: 'Vinh Phu', district: 'Thị xã Dĩ An', province: 'Binh Duong' },
  ];
  const wards = await Promise.all(
    wardData.map((w) => db.ward.create({ data: w }))
  );
  console.log(`✅ ${wards.length} wards`);

  // ============================================
  // 3. MANUFACTURERS (3)
  // ============================================
  const manufacturers = await Promise.all([
    db.manufacturer.create({
      data: {
        name: 'Công ty Lương thực Bình Dương',
        nameEn: 'Binh Duong Food Corp',
        contactPerson: 'Anh Minh',
        contactPhone: '0911222333',
        email: 'info@bdcfood.vn',
        address: 'KCN Sóng Thần 1, Dĩ An, BD',
        commissionRate: 0.15,
      },
    }),
    db.manufacturer.create({
      data: {
        name: 'Tập đoàn Dầu ăn Tương An',
        nameEn: 'Tuong An Oil Group',
        contactPerson: 'Chị Lan',
        contactPhone: '0911333444',
        email: 'sales@tuongan.vn',
        commissionRate: 0.18,
      },
    }),
    db.manufacturer.create({
      data: {
        name: 'Công ty Thực phẩm Acecook',
        nameEn: 'Acecook Vietnam',
        contactPerson: 'Anh Hùng',
        contactPhone: '0911444555',
        email: 'biz@acecook.vn',
        address: 'KCN VSIP, BD',
        commissionRate: 0.12,
      },
    }),
  ]);
  console.log(`✅ ${manufacturers.length} manufacturers`);

  // ============================================
  // 4. DISTRIBUTORS (2)
  // ============================================
  const distributors = await Promise.all([
    db.distributor.create({
      data: {
        name: 'Kho Phân Phối Miền Nam',
        nameEn: 'South Distribution Warehouse',
        contactPerson: 'Anh Thành',
        contactPhone: '0911666777',
        address: 'Số 12, Đại lộ Bình Dương',
        lat: 10.88,
        lng: 106.68,
        isActive: true,
      },
    }),
    db.distributor.create({
      data: {
        name: 'Kho Tổng Thủ Dầu Một',
        nameEn: 'TDM Main Warehouse',
        contactPerson: 'Chị Hạnh',
        contactPhone: '0911888999',
        address: 'KCN Mỹ Phước, Bến Cát',
        isActive: true,
      },
    }),
  ]);
  console.log(`✅ ${distributors.length} distributors`);

  // ============================================
  // 5. USERS & SHOPS
  // ============================================
  const adminUser = await db.user.create({
    data: {
      phone: '0901234567',
      name: 'Quyết Định',
      nameEn: 'Quyet Dinh',
      email: 'admin@aladin.vn',
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: '$2a$10$FAKE_HASH_ADMIN',
    },
  });

  // Sales rep user
  const salesRepUser = await db.user.create({
    data: {
      phone: '0911111111',
      name: 'Nguyễn Văn An',
      nameEn: 'Nguyen Van An',
      role: 'SALES_REP',
      status: 'ACTIVE',
      passwordHash: '$2a$10$FAKE_HASH_SALES',
    },
  });

  // Driver users
  const drivers = await Promise.all([
    db.user.create({
      data: {
        phone: '0922222222',
        name: 'Tài xế Minh',
        nameEn: 'Driver Minh',
        role: 'DRIVER',
        status: 'ACTIVE',
        passwordHash: '$2a$10$FAKE_HASH_DRV1',
      },
    }),
    db.user.create({
      data: {
        phone: '0922333333',
        name: 'Tài xế Hùng',
        nameEn: 'Driver Hung',
        role: 'DRIVER',
        status: 'ACTIVE',
        passwordHash: '$2a$10$FAKE_HASH_DRV2',
      },
    }),
  ]);

  // Broker user
  const brokerUser = await db.user.create({
    data: {
      phone: '0933333333',
      name: 'Trần Thị Mai',
      nameEn: 'Tran Thi Mai',
      role: 'BROKER',
      status: 'ACTIVE',
      passwordHash: '$2a$10$FAKE_HASH_BROKER',
    },
  });

  // Shops (8 shops — cover all credit statuses & tiers)
  const shopDefs = [
    { name: 'Tạp Hóa Hạnh Phúc', nameEn: 'Hanh Phuc Grocery', ward: 0, limit: 2000000, bal: 500000, credit: 'ACTIVE', tier: 'GOLD', orders: 25, gmv: 85000000 },
    { name: 'Cửa Hàng Tâm An', nameEn: 'Tam An Shop', ward: 1, limit: 3000000, bal: 1500000, credit: 'ACTIVE', tier: 'PLATINUM', orders: 42, gmv: 150000000 },
    { name: 'Tạp Hóa Bình Minh', nameEn: 'Binh Minh Grocery', ward: 2, limit: 1000000, bal: 0, credit: 'ACTIVE', tier: 'SILVER', orders: 8, gmv: 15000000 },
    { name: 'Siêu Thị Mini Phước Long', nameEn: 'Phuoc Long Mini Mart', ward: 3, limit: 5000000, bal: 4500000, credit: 'LOCKED', tier: 'PLATINUM', orders: 65, gmv: 280000000 },
    { name: 'Tạp Hóa Lộc Phát', nameEn: 'Loc Phat Grocery', ward: 4, limit: 1500000, bal: 1800000, credit: 'OVERDUE', tier: 'BRONZE', orders: 12, gmv: 32000000 },
    { name: 'Tạp Hóa Hoa Mai', nameEn: 'Hoa Mai Grocery', ward: 5, limit: 2000000, bal: 0, credit: 'ACTIVE', tier: 'GOLD', orders: 30, gmv: 95000000 },
    { name: 'Cửa Hàng Phương Thảo', nameEn: 'Phuong Thao Shop', ward: 6, limit: 1000000, bal: 800000, credit: 'ACTIVE', tier: 'SILVER', orders: 10, gmv: 22000000 },
    { name: 'Tạp Hóa Thành Đạt', nameEn: 'Thanh Dat Grocery', ward: 7, limit: 3000000, bal: 0, credit: 'ACTIVE', tier: 'GOLD', orders: 35, gmv: 110000000 },
  ];

  const shopEntries: { user: any; shop: any }[] = [];
  for (let i = 0; i < shopDefs.length; i++) {
    const def = shopDefs[i];
    const ward = wards[def.ward];
    const phone = `0901234${600 + i}`;

    const user = await db.user.create({
      data: {
        phone,
        name: def.name,
        nameEn: def.nameEn,
        role: 'SHOP_OWNER',
        status: 'ACTIVE',
        passwordHash: `$2a$10$FAKE_HASH_SHOP${i}`,
      },
    });

    const shop = await db.shop.create({
      data: {
        userId: user.id,
        name: def.name,
        nameEn: def.nameEn,
        wardId: ward.id,
        district: ward.district,
        province: ward.province,
        address: `${houseNumbers[i]}, ${ward.name}, ${ward.district}`,
        creditLimit: def.limit,
        creditBalance: def.bal,
        creditStatus: def.credit,
        loyaltyTier: def.tier,
        totalOrders: def.orders,
        totalGmv: def.gmv,
        avgOrderValue: def.orders > 0 ? Math.round(def.gmv / def.orders) : 0,
      },
    });

    shopEntries.push({ user, shop });
  }

  const shops = shopEntries.map((e) => e.shop);
  const shopUsers = shopEntries.map((e) => e.user);

  console.log(`✅ 1 admin + 1 sales rep + 2 drivers + 1 broker + ${shops.length} shops`);

  // ============================================
  // 6. BROKER
  // ============================================
  const broker = await db.broker.create({
    data: {
      userId: brokerUser.id,
      tier: 'WARD_LEVEL',
      wardId: wards[0].id,
      commissionRate: 0.03,
      totalShopsReferred: 12,
      totalCommissionEarned: 2400000,
      totalGmvGenerated: 80000000,
    },
  });
  console.log('✅ 1 broker');

  // ============================================
  // 7. PRODUCTS (24 products — 4 per category)
  // ============================================
  const prodData = [
    // Rice (cat 0)
    { sku: 'GAO-ST25-10', name: 'Gạo ST25 (10kg)', nameEn: 'ST25 Rice (10kg)', cat: 0, brand: 'ST25', price: 250000, gp: 220000, stock: 500, unit: 'bao', mfg: 0, bar: '8938500001001', isPL: true, dst: 0 },
    { sku: 'GAO-JASMINE-20', name: 'Gạo Jasmine (20kg)', nameEn: 'Jasmine Rice (20kg)', cat: 0, brand: 'Jasmine', price: 380000, gp: 340000, stock: 300, unit: 'bao', mfg: 0, bar: '8938500001002', dst: 0 },
    { sku: 'GAO-NANG-HUONG-10', name: 'Gạo Nàng Hương (10kg)', nameEn: 'Nang Huong Rice (10kg)', cat: 0, brand: 'Nàng Hương', price: 215000, gp: 190000, stock: 400, unit: 'bao', mfg: 0 },
    { sku: 'GAO-THOM-XANH-5', name: 'Gạo Thơm Xanh (5kg)', nameEn: 'Green Fragrant Rice (5kg)', cat: 0, brand: 'Thơm Xanh', price: 135000, gp: 120000, stock: 250, unit: 'bao', mfg: 0 },
    // Cooking Oil (cat 1)
    { sku: 'DAU-SIMPLY-5L', name: 'Dầu ăn Simply (5L)', nameEn: 'Simply Cooking Oil (5L)', cat: 1, brand: 'Simply', price: 175000, gp: 155000, stock: 200, unit: 'chai', mfg: 1, bar: '8938500002001', dst: 0 },
    { sku: 'DAU-TUONG-AN-2L', name: 'Dầu Tương An (2L)', nameEn: 'Tuong An Oil (2L)', cat: 1, brand: 'Tương An', price: 89000, gp: 79000, stock: 350, unit: 'chai', mfg: 1, bar: '8938500002002', dst: 1 },
    { sku: 'DAU-THANH-NHAT-1L', name: 'Dầu Thảnh Nhất (1L)', nameEn: 'Thanh Nhat Oil (1L)', cat: 1, brand: 'Thảnh Nhất', price: 42000, gp: 37000, stock: 15, unit: 'chai', mfg: 1 },
    { sku: 'DAU-MAM-CAI-5L', name: 'Dầu Mắm Cái (5L)', nameEn: 'Mam Cai Oil (5L)', cat: 1, brand: 'Mắm Cái', price: 168000, gp: 148000, stock: 0, unit: 'chai', mfg: 1 },
    // Noodles (cat 2)
    { sku: 'MI-HAOHAO-30', name: 'Mì Hảo Hảo (Gói 30)', nameEn: 'Hao Hao Noodles (Pack 30)', cat: 2, brand: 'Hảo Hảo', price: 115000, gp: 99000, stock: 1000, unit: 'thung', mfg: 2, bar: '8938500003001', dst: 0 },
    { sku: 'MI-OMACHI-30', name: 'Mì Omachi (Gói 30)', nameEn: 'Omachi Noodles (Pack 30)', cat: 2, brand: 'Omachi', price: 125000, gp: 109000, stock: 800, unit: 'thung', mfg: 2, bar: '8938500003002' },
    { sku: 'MI-CAY-30', name: 'Mì Cay (Gói 30)', nameEn: 'Spicy Noodles (Pack 30)', cat: 2, brand: 'Mì Cay', price: 108000, gp: 95000, stock: 600, unit: 'thung', mfg: 2 },
    { sku: 'MI-3-MIEN-30', name: 'Mì 3 Miền (Gói 30)', nameEn: '3 Mien Noodles (Pack 30)', cat: 2, brand: '3 Miền', price: 118000, gp: 103000, stock: 30, unit: 'thung', mfg: 2 },
    // Beverages (cat 3)
    { sku: 'NUOC-LAVIE-6', name: 'Nước LaVie (Lốc 6)', nameEn: 'LaVie Water (6-pack)', cat: 3, brand: 'LaVie', price: 45000, gp: 39000, stock: 2000, unit: 'loc', bar: '8938500004001', dst: 1 },
    { sku: 'BIA-SAIGON-24', name: 'Bia Sài Gòn (Thùng 24)', nameEn: 'Saigon Beer (Case 24)', cat: 3, brand: 'Sài Gòn', price: 320000, gp: 285000, stock: 150, unit: 'thung', bar: '8938500004002', dst: 0 },
    { sku: 'BIA-HEINEKEN-24', name: 'Bia Heineken (Thùng 24)', nameEn: 'Heineken Beer (Case 24)', cat: 3, brand: 'Heineken', price: 520000, gp: 480000, stock: 100, unit: 'thung' },
    { sku: 'TRA-DRTHANH-24', name: 'Trà Địa Trùng Khánh (Thùng 24)', nameEn: 'DrThanh Tea (Case 24)', cat: 3, brand: 'Địa Trùng Khánh', price: 145000, gp: 128000, stock: 500, unit: 'thung', bar: '8938500004003' },
    { sku: 'NUOC-TIGER-24', name: 'Nước Tiger (Thùng 24)', nameEn: 'Tiger Water (Case 24)', cat: 3, brand: 'Tiger', price: 85000, gp: 75000, stock: 0, unit: 'thung' },
    // Snacks (cat 4)
    { sku: 'BISCO-OREO-10', name: 'Bánh Oreo (Gói 10)', nameEn: 'Oreo Cookies (Pack 10)', cat: 4, brand: 'Oreo', price: 65000, gp: 56000, stock: 400, unit: 'hop', bar: '8938500005001', dst: 0 },
    { sku: 'BISCO-COSY-10', name: 'Bánh Cosy (Gói 10)', nameEn: 'Cosy Cookies (Pack 10)', cat: 4, brand: 'Cosy', price: 42000, gp: 36000, stock: 350, unit: 'hop' },
    { sku: 'DAU-PEANUT-500G', name: 'Đậu Phộng (500g)', nameEn: 'Peanuts (500g)', cat: 4, brand: 'Đậu Phộng', price: 35000, gp: null, stock: 200, unit: 'goi' },
    { sku: 'KHAO-SATAY-10', name: 'Khao Satay (Gói 10)', nameEn: 'Satay Crackers (Pack 10)', cat: 4, brand: 'Satay', price: 28000, gp: 24000, stock: 8, unit: 'goi' },
    // Seasonings (cat 5)
    { sku: 'GIA-VI-NAM-BO', name: 'Gia vị Nam Bộ (Hộp)', nameEn: 'Southern Seasoning (Box)', cat: 5, brand: 'Nam Bộ', price: 35000, gp: null, stock: 600, unit: 'hop', bar: '8938500006001', dst: 1 },
    { sku: 'MUOI-IOT-500G', name: 'Muối I-ốt (500g)', nameEn: 'Iodized Salt (500g)', cat: 5, brand: 'Muối', price: 12000, gp: null, stock: 800, unit: 'goi' },
    { sku: 'DUONG-REFINE-1KG', name: 'Đường Refined (1kg)', nameEn: 'Refined Sugar (1kg)', cat: 5, brand: 'Đường', price: 25000, gp: 22000, stock: 700, unit: 'goi', bar: '8938500006002' },
    { sku: 'BOT-GIA-VI-200G', name: 'Bột Gia Vị (200g)', nameEn: 'Seasoning Powder (200g)', cat: 5, brand: 'Knorr', price: 18000, gp: 15000, stock: 0, unit: 'goi' },
  ];

  const products = await Promise.all(
    prodData.map((p) =>
      db.product.create({
        data: {
          sku: p.sku,
          name: p.name,
          nameEn: p.nameEn,
          categoryId: categories[p.cat].id,
          brand: p.brand,
          unit: p.unit,
          basePrice: p.price,
          groupBuyPrice: p.gp,
          stockQuantity: p.stock,
          minOrderQty: 1,
          maxOrderQty: p.stock < 20 ? 5 : null,
          barcode: p.bar || null,
          manufacturerId: p.mfg !== undefined ? manufacturers[p.mfg].id : null,
          distributorId: p.dst !== undefined ? distributors[p.dst].id : null,
          isActive: true,
          isPrivateLabel: p.isPL || false,
        },
      })
    )
  );
  console.log(`✅ ${products.length} products`);

  // ============================================
  // 8. PROMOTIONS (3)
  // ============================================
  const promotions = await Promise.all([
    db.promotion.create({
      data: {
        manufacturerId: manufacturers[0].id,
        title: 'Mua 10 Gạo ST25 tặng 1',
        titleEn: 'Buy 10 ST25 Rice Get 1 Free',
        description: 'Khuyến mãi đặc biệt cho gạo ST25 10kg',
        promoType: 'BUY_X_GET_Y',
        buyQty: 10,
        getQty: 1,
        startsAt: new Date(now - days(5)),
        expiresAt: new Date(now + days(25)),
        totalBudget: 5000000,
        usedBudget: 250000,
        totalRedemptions: 25,
        isActive: true,
      },
    }),
    db.promotion.create({
      data: {
        manufacturerId: manufacturers[2].id,
        title: 'Giảm 10% Mì Hảo Hảo',
        titleEn: '10% Off Hao Hao Noodles',
        description: 'Giảm 10% cho đơn hàng từ 5 thùng trở lên',
        promoType: 'PERCENT_OFF',
        discountPercent: 10.0,
        startsAt: new Date(now - days(3)),
        expiresAt: new Date(now + days(15)),
        totalBudget: 10000000,
        usedBudget: 3000000,
        totalRedemptions: 42,
        isActive: true,
      },
    }),
    db.promotion.create({
      data: {
        manufacturerId: manufacturers[1].id,
        title: 'Giảm 20.000đ Dầu Tương An 2L',
        titleEn: '20k Off Tuong An 2L Oil',
        description: 'Ưu đãi giảm giá trực tiếp',
        promoType: 'FIXED_DISCOUNT',
        discountAmount: 20000,
        startsAt: new Date(now - days(10)),
        expiresAt: new Date(now - days(1)),
        totalBudget: 8000000,
        usedBudget: 8000000,
        totalRedemptions: 400,
        isActive: false, // expired
      },
    }),
  ]);

  // Promotion items
  await db.promotionItem.create({ data: { promotionId: promotions[0].id, productId: products[0].id } }); // ST25 rice
  await db.promotionItem.create({ data: { promotionId: promotions[1].id, productId: products[8].id } }); // Hao Hao
  await db.promotionItem.create({ data: { promotionId: promotions[2].id, productId: products[5].id } }); // Tuong An 2L
  console.log(`✅ ${promotions.length} promotions + items`);

  // ============================================
  // 9. GROUP DEALS (3)
  // ============================================
  const groupDeals = await Promise.all([
    db.groupDeal.create({
      data: {
        title: 'Group Buy Gạo ST25 — Phú Mỹ',
        titleEn: 'Group Buy ST25 Rice — Phu My',
        productId: products[0].id,
        targetQty: 50,
        currentQty: 35,
        originalPrice: 250000,
        discountPrice: 220000,
        maxParticipants: 10,
        startsAt: new Date(now - days(2)),
        expiresAt: new Date(now + days(5)),
        wardId: wards[0].id,
        status: 'ACTIVE',
      },
    }),
    db.groupDeal.create({
      data: {
        title: 'Group Buy Mì Hảo Hảo — Dĩ An',
        titleEn: 'Group Buy Hao Hao — Di An',
        productId: products[8].id,
        targetQty: 100,
        currentQty: 100,
        originalPrice: 115000,
        discountPrice: 99000,
        startsAt: new Date(now - days(7)),
        expiresAt: new Date(now - days(1)),
        wardId: wards[3].id,
        status: 'COMPLETED',
      },
    }),
    db.groupDeal.create({
      data: {
        title: 'Group Buy Dầu Simply — Chánh Nghĩa',
        titleEn: 'Group Buy Simply Oil — Chanh Nghia',
        productId: products[4].id,
        targetQty: 40,
        currentQty: 12,
        originalPrice: 175000,
        discountPrice: 155000,
        startsAt: new Date(now - days(1)),
        expiresAt: new Date(now + days(6)),
        wardId: wards[1].id,
        status: 'ACTIVE',
      },
    }),
  ]);

  // Group deal participants
  await Promise.all([
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[0].id, shopId: shops[0].id, committedQty: 15 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[0].id, shopId: shops[1].id, committedQty: 10 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[0].id, shopId: shops[5].id, committedQty: 10 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[1].id, shopId: shops[3].id, committedQty: 40 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[1].id, shopId: shops[4].id, committedQty: 30 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[1].id, shopId: shops[7].id, committedQty: 30 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[2].id, shopId: shops[1].id, committedQty: 8 } }),
    db.groupDealParticipant.create({ data: { groupDealId: groupDeals[2].id, shopId: shops[2].id, committedQty: 4 } }),
  ]);
  console.log(`✅ ${groupDeals.length} group deals + 8 participants`);

  // ============================================
  // 10. ORDERS (15 orders — all statuses, all payment methods)
  // ============================================
  const orderDefs = [
    // Shop 0: DELIVERED, DIGITAL (2% discount), fully paid
    { s: 0, items: [{ p: 0, q: 10 }, { p: 2, q: 3 }], m: 'DIGITAL', st: 'DELIVERED', d: 12, iKey: 'seed-s0-o1' },
    // Shop 1: DELIVERED, CREDIT, partially repaid
    { s: 1, items: [{ p: 0, q: 5 }, { p: 4, q: 2 }], m: 'CREDIT', st: 'DELIVERED', d: 10, iKey: 'seed-s1-o1' },
    // Shop 2: DELIVERED, COD
    { s: 2, items: [{ p: 4, q: 3 }, { p: 6, q: 5 }], m: 'COD', st: 'DELIVERED', d: 8, iKey: 'seed-s2-o1' },
    // Shop 3: DELIVERED, DIGITAL (large order)
    { s: 3, items: [{ p: 8, q: 10 }, { p: 9, q: 5 }, { p: 12, q: 3 }], m: 'DIGITAL', st: 'DELIVERED', d: 7, iKey: 'seed-s3-o1' },
    // Shop 5: DELIVERED, CREDIT, fully repaid
    { s: 5, items: [{ p: 1, q: 2 }, { p: 16, q: 5 }], m: 'CREDIT', st: 'DELIVERED', d: 6, iKey: 'seed-s5-o1' },
    // Shop 0: OUT_FOR_DELIVERY, DIGITAL
    { s: 0, items: [{ p: 1, q: 3 }, { p: 3, q: 5 }], m: 'DIGITAL', st: 'OUT_FOR_DELIVERY', d: 1, iKey: 'seed-s0-o2' },
    // Shop 3: CONFIRMED, CREDIT (big order pushed to LOCKED)
    { s: 3, items: [{ p: 0, q: 20 }, { p: 4, q: 5 }, { p: 8, q: 10 }], m: 'CREDIT', st: 'CONFIRMED', d: 0, iKey: 'seed-s3-o2' },
    // Shop 4: PENDING, COD (overdue shop)
    { s: 4, items: [{ p: 7, q: 3 }], m: 'COD', st: 'PENDING', d: 0, iKey: 'seed-s4-o1' },
    // Shop 1: PROCESSING, DIGITAL
    { s: 1, items: [{ p: 5, q: 4 }, { p: 8, q: 6 }], m: 'DIGITAL', st: 'PROCESSING', d: 0, iKey: 'seed-s1-o2' },
    // Shop 0: PACKED, CREDIT
    { s: 0, items: [{ p: 0, q: 15 }, { p: 4, q: 3 }, { p: 6, q: 10 }], m: 'CREDIT', st: 'PACKED', d: 0, iKey: 'seed-s0-o3' },
    // Shop 0: CANCELLED, CREDIT
    { s: 0, items: [{ p: 8, q: 2 }], m: 'CREDIT', st: 'CANCELLED', d: 5, iKey: 'seed-s0-cancel' },
    // Shop 6: PACKED, DIGITAL
    { s: 6, items: [{ p: 16, q: 2 }, { p: 20, q: 3 }], m: 'DIGITAL', st: 'PACKED', d: 0, iKey: 'seed-s6-o1' },
    // Shop 7: CONFIRMED, COD
    { s: 7, items: [{ p: 0, q: 5 }, { p: 12, q: 4 }], m: 'COD', st: 'CONFIRMED', d: 0, iKey: 'seed-s7-o1' },
    // Shop 1: DELIVERED, DIGITAL (recent)
    { s: 1, items: [{ p: 9, q: 3 }, { p: 16, q: 4 }], m: 'DIGITAL', st: 'DELIVERED', d: 3, iKey: 'seed-s1-o3' },
    // Shop 5: DELIVERED, CREDIT
    { s: 5, items: [{ p: 4, q: 5 }, { p: 8, q: 8 }], m: 'CREDIT', st: 'DELIVERED', d: 4, iKey: 'seed-s5-o2' },
  ];

  const orderEntities = [];
  for (const od of orderDefs) {
    const sub = od.items.reduce((s, i) => s + products[i.p].basePrice * i.q, 0);
    const discount = od.m === 'DIGITAL' ? Math.round(sub * 0.02) : 0;
    const delivery = od.m === 'COD' ? 15000 : 0;
    const total = sub - discount + delivery;

    let paySt = 'PENDING';
    let paidAmt = 0;
    let creditUsed = 0;

    if (od.st === 'DELIVERED') {
      if (od.m === 'DIGITAL' || od.m === 'COD') { paySt = 'PAID'; paidAmt = total; }
      else { creditUsed = sub; }
    } else if (od.m === 'CREDIT' && od.st !== 'CANCELLED') {
      creditUsed = sub;
    } else if (od.st === 'CANCELLED') {
      paySt = 'REFUNDED'; creditUsed = sub;
    }

    const createdAt = new Date(now - days(od.d));
    const order = await db.order.create({
      data: {
        orderNumber: nextOrderNum(),
        shopId: shops[od.s].id,
        shopSnapshot: JSON.stringify({ id: shops[od.s].id, name: shops[od.s].name, phone: shopUsers[od.s].phone, district: shops[od.s].district, province: shops[od.s].province }),
        status: od.st,
        paymentMethod: od.m,
        paymentStatus: paySt,
        subtotalAmount: sub,
        discountAmount: discount,
        deliveryFee: delivery,
        totalAmount: total,
        paidAmount: paidAmt,
        creditUsed,
        idempotencyKey: `seed-${od.iKey}-${dateStr}`,
        customerNotes: 'Đặt qua ALADIN App',
        createdAt,
        confirmedAt: od.st !== 'PENDING' ? new Date(createdAt.getTime() + 3600000) : null,
        packedAt: ['PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(od.st) ? new Date(createdAt.getTime() + 7200000) : null,
        deliveredAt: od.st === 'DELIVERED' ? new Date(createdAt.getTime() + 86400000) : null,
        cancelledAt: od.st === 'CANCELLED' ? new Date(createdAt.getTime() + 7200000) : null,
        cancelReason: od.st === 'CANCELLED' ? 'Sai sản phẩm' : null,
        distributorId: distributors[od.s % 2].id,
      },
    });

    for (const item of od.items) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: products[item.p].id,
          productName: products[item.p].name,
          productSku: products[item.p].sku,
          unitPrice: products[item.p].basePrice,
          quantity: item.q,
          totalPrice: products[item.p].basePrice * item.q,
        },
      });
    }

    orderEntities.push(order);
  }
  console.log(`✅ ${orderEntities.length} orders across all statuses`);

  // ============================================
  // 11. SHIPMENTS (6 — for various orders)
  // ============================================
  const shipmentDefs = [
    { oi: 0, st: 'DELIVERED', driver: 0, d: 12 },   // Order 0 — delivered
    { oi: 2, st: 'DELIVERED', driver: 1, d: 8 },     // Order 2 — delivered
    { oi: 3, st: 'DELIVERED', driver: 0, d: 7 },     // Order 3 — delivered
    { oi: 5, st: 'IN_TRANSIT', driver: 1, d: 1 },    // Order 5 — out for delivery
    { oi: 9, st: 'PICKED_UP', driver: 0, d: 0 },     // Order 9 — packed
    { oi: 11, st: 'PENDING', driver: null, d: 0 },   // Order 11 — confirmed
  ];

  const shipmentEntities = [];
  for (const sd of shipmentDefs) {
    const order = orderEntities[sd.oi];
    const createdAt = new Date(now - days(sd.d));

    const shipment = await db.shipment.create({
      data: {
        orderId: order.id,
        type: 'INTERNAL',
        status: sd.st,
        assignedDriverId: sd.driver !== null ? drivers[sd.driver].id : null,
        pickupAddress: 'Kho Phân Phối Miền Nam, Số 12, Đại lộ Bình Dương',
        dropoffAddress: `${shops.find(s => s.id === order.shopId)?.address || 'Unknown'}`,
        deliveredAt: sd.st === 'DELIVERED' ? new Date(createdAt.getTime() + 86400000) : null,
        podPhotoUrl: sd.st === 'DELIVERED' ? 'https://placehold.co/600x400?text=POD+Photo' : null,
        thirdPartyTrackingId: sd.st === 'IN_TRANSIT' ? '3PL-2025-' + Math.random().toString(36).slice(2, 8) : null,
      },
    });

    // Update order with driver assignment
    if (sd.driver !== null) {
      await db.order.update({
        where: { id: order.id },
        data: { assignedDriverId: drivers[sd.driver].id },
      });
    }

    shipmentEntities.push(shipment);
  }
  console.log(`✅ ${shipmentEntities.length} shipments`);

  // ============================================
  // 12. TRANSACTIONS (Credit Ledger — 12 entries)
  // ============================================
  const txEntities = [];

  // Order 0: Shop 0 — DIGITAL fully paid
  await db.transaction.create({
    data: {
      shopId: shops[0].id, orderId: orderEntities[0].id,
      type: 'ORDER_PAYMENT', amount: -orderEntities[0].totalAmount, runningBalance: 0,
      paymentMethod: 'DIGITAL', paymentRef: 'MOMO-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      description: `Thanh toán ${orderEntities[0].orderNumber} qua MoMo`,
    },
  });

  // Order 1: Shop 1 — CREDIT used, then partial repayment
  const crUsed1 = orderEntities[1].subtotalAmount;
  await db.transaction.create({
    data: {
      shopId: shops[1].id, orderId: orderEntities[1].id,
      type: 'CREDIT_USED', amount: crUsed1, runningBalance: crUsed1,
      paymentMethod: 'CREDIT',
      description: `Công nợ ${orderEntities[1].orderNumber}`,
    },
  });
  await db.transaction.create({
    data: {
      shopId: shops[1].id, orderId: orderEntities[1].id,
      type: 'REPAYMENT', amount: -500000, runningBalance: crUsed1 - 500000,
      paymentMethod: 'CASH', collectedBy: salesRepUser.id,
      description: 'Thu tiền mặt — Sales Rep An',
    },
  });

  // Order 2: Shop 2 — COD payment
  await db.transaction.create({
    data: {
      shopId: shops[2].id, orderId: orderEntities[2].id,
      type: 'ORDER_PAYMENT', amount: -orderEntities[2].totalAmount, runningBalance: 0,
      paymentMethod: 'COD',
      description: `COD ${orderEntities[2].orderNumber}`,
    },
  });

  // Order 6: Shop 3 — CREDIT used (lock trigger)
  await db.transaction.create({
    data: {
      shopId: shops[3].id, orderId: orderEntities[6].id,
      type: 'CREDIT_USED', amount: orderEntities[6].subtotalAmount, runningBalance: orderEntities[6].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Công nợ ${orderEntities[6].orderNumber} (AUTO_LOCK)`,
      metadata: JSON.stringify({ action: 'AUTO_LOCK_TRIGGER' }),
    },
  });

  // Order 9: Shop 0 — CREDIT used
  await db.transaction.create({
    data: {
      shopId: shops[0].id, orderId: orderEntities[9].id,
      type: 'CREDIT_USED', amount: orderEntities[9].subtotalAmount, runningBalance: orderEntities[9].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Công nợ ${orderEntities[9].orderNumber}`,
    },
  });

  // Order 10 (cancelled): Shop 0 — Credit used + refund
  await db.transaction.create({
    data: {
      shopId: shops[0].id, orderId: orderEntities[10].id,
      type: 'CREDIT_USED', amount: orderEntities[10].subtotalAmount, runningBalance: orderEntities[10].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Công nợ ${orderEntities[10].orderNumber}`,
    },
  });
  await db.transaction.create({
    data: {
      shopId: shops[0].id, orderId: orderEntities[10].id,
      type: 'REFUND', amount: -orderEntities[10].subtotalAmount, runningBalance: 0,
      description: `Hoàn tiền ${orderEntities[10].orderNumber} (đã hủy)`,
      metadata: JSON.stringify({ reason: 'Sai sản phẩm' }),
    },
  });

  // Order 4: Shop 5 — CREDIT used + fully repaid
  await db.transaction.create({
    data: {
      shopId: shops[5].id, orderId: orderEntities[4].id,
      type: 'CREDIT_USED', amount: orderEntities[4].subtotalAmount, runningBalance: orderEntities[4].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Công nợ ${orderEntities[4].orderNumber}`,
    },
  });
  await db.transaction.create({
    data: {
      shopId: shops[5].id, orderId: orderEntities[4].id,
      type: 'REPAYMENT', amount: -orderEntities[4].subtotalAmount, runningBalance: 0,
      paymentMethod: 'DIGITAL', paymentRef: 'ZALOPAY-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      description: `Thanh toán đủ ${orderEntities[4].orderNumber} qua ZaloPay`,
    },
  });

  // Credit limit increases
  await db.transaction.create({
    data: {
      shopId: shops[3].id, type: 'CREDIT_LIMIT_INCREASE', amount: 0,
      runningBalance: shops[3].creditBalance,
      description: 'Tăng hạn mức từ 3M lên 5M bởi Admin',
      metadata: JSON.stringify({ oldLimit: 3000000, newLimit: 5000000, adminUserId: adminUser.id }),
    },
  });
  await db.transaction.create({
    data: {
      shopId: shops[1].id, type: 'CREDIT_LIMIT_INCREASE', amount: 0,
      runningBalance: shops[1].creditBalance,
      description: 'Tăng hạn mức từ 2M lên 3M bởi Admin',
      metadata: JSON.stringify({ oldLimit: 2000000, newLimit: 3000000 }),
    },
  });

  // Order 14: Shop 5 — CREDIT used (current debt)
  await db.transaction.create({
    data: {
      shopId: shops[5].id, orderId: orderEntities[14].id,
      type: 'CREDIT_USED', amount: orderEntities[14].subtotalAmount, runningBalance: orderEntities[14].subtotalAmount,
      paymentMethod: 'CREDIT',
      description: `Công nợ ${orderEntities[14].orderNumber}`,
    },
  });

  console.log('✅ 12 transaction ledger entries');

  // ============================================
  // 13. PAYMENTS (Digital payment records — 5)
  // ============================================
  const digitalOrders = [0, 3, 5, 8, 13]; // indices of DIGITAL orders
  const gateways = ['MOMO', 'ZALOPAY', 'MOMO', 'ZALOPAY', 'MOMO'] as const;

  for (let i = 0; i < digitalOrders.length; i++) {
    const order = orderEntities[digitalOrders[i]];
    const isPaid = order.paymentStatus === 'PAID';
    await db.payment.create({
      data: {
        orderId: order.id,
        gateway: gateways[i],
        gatewayTxId: `${gateways[i]}-${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
        amount: order.totalAmount,
        status: isPaid ? 'SUCCESS' : 'PENDING',
        paidAt: isPaid ? new Date(order.createdAt.getTime() + 600000) : null,
        expiresAt: new Date(order.createdAt.getTime() + 900000), // 15 min expiry
        rawRequest: JSON.stringify({ amount: order.totalAmount, gateway: gateways[i] }),
      },
    });
  }
  console.log('✅ 5 payment records');

  // ============================================
  // 14. MERCHANDISING AUDITS (4)
  // ============================================
  await db.merchandisingAudit.create({
    data: {
      shopId: shops[0].id, productId: products[0].id, promotionId: promotions[0].id,
      photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+1',
      status: 'APPROVED', reviewerId: adminUser.id,
      reviewNotes: 'Kệ hàng đẹp, đúng vị trí',
      reviewedAt: new Date(now - days(2)),
    },
  });
  await db.merchandisingAudit.create({
    data: {
      shopId: shops[1].id, productId: products[8].id, promotionId: promotions[1].id,
      photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+2',
      status: 'APPROVED', reviewerId: adminUser.id,
      reviewNotes: 'Banner khuyến mãi đúng chuẩn',
      reviewedAt: new Date(now - days(1)),
    },
  });
  await db.merchandisingAudit.create({
    data: {
      shopId: shops[3].id, productId: products[4].id,
      photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+3',
      status: 'PENDING_REVIEW',
    },
  });
  await db.merchandisingAudit.create({
    data: {
      shopId: shops[5].id, productId: products[16].id,
      photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+4',
      status: 'REJECTED', reviewerId: adminUser.id,
      reviewNotes: 'Sản phẩm sai vị trí, cần sắp xếp lại',
      reviewedAt: new Date(now - days(3)),
    },
  });
  console.log('✅ 4 merchandising audits');

  // ============================================
  // 15. PLATFORM SETTINGS (6)
  // ============================================
  const settingsData = [
    { key: 'platform.name', value: 'ALADIN B2B', category: 'general', desc: 'Platform name' },
    { key: 'credit.defaultLimit', value: '1000000', category: 'credit', desc: 'Default credit limit (VND)' },
    { key: 'credit.maxLimit', value: '10000000', category: 'credit', desc: 'Maximum credit limit (VND)' },
    { key: 'credit.autoLockThreshold', value: '0.9', category: 'credit', desc: 'Auto-lock at 90% usage' },
    { key: 'notification.orderCreated', value: 'true', category: 'notification', desc: 'Notify admin on new order' },
    { key: 'notification.deliveryCompleted', value: 'true', category: 'notification', desc: 'Notify shop on delivery' },
  ];

  await Promise.all(
    settingsData.map((s) =>
      db.platformSetting.create({ data: { key: s.key, value: s.value, category: s.category, description: s.desc } })
    )
  );
  console.log('✅ 6 platform settings');

  // ============================================
  // 16. AUDIT LOG (8 entries)
  // ============================================
  await db.auditLog.create({
    data: {
      userId: adminUser.id, action: 'USER_CREATED', entity: 'User', entityId: shopUsers[0].id,
      details: JSON.stringify({ phone: shopUsers[0].phone, role: 'SHOP_OWNER' }),
    },
  });
  await db.auditLog.create({
    data: {
      userId: adminUser.id, action: 'CREDIT_LIMIT_CHANGED', entity: 'Shop', entityId: shops[3].id,
      details: JSON.stringify({ from: 3000000, to: 5000000 }),
    },
  });
  await db.auditLog.create({
    data: {
      userId: adminUser.id, action: 'ORDER_CANCELLED', entity: 'Order', entityId: orderEntities[10].id,
      details: JSON.stringify({ reason: 'Sai sản phẩm' }),
    },
  });
  await db.auditLog.create({
    data: {
      action: 'SYSTEM', entity: 'Order', entityId: orderEntities[6].id,
      details: JSON.stringify({ action: 'AUTO_LOCK_TRIGGERED', shopId: shops[3].id }),
    },
  });
  await db.auditLog.create({
    data: {
      userId: adminUser.id, action: 'PROMOTION_CREATED', entity: 'Promotion', entityId: promotions[0].id,
      details: JSON.stringify({ title: promotions[0].title }),
    },
  });
  await db.auditLog.create({
    data: {
      userId: adminUser.id, action: 'PASSWORD_RESET', entity: 'User', entityId: shopUsers[2].id,
      details: JSON.stringify({ triggeredBy: 'admin', method: 'manual' }),
    },
  });
  await db.auditLog.create({
    data: {
      action: 'SYSTEM', entity: 'PlatformSetting', entityId: 'credit.autoLockThreshold',
      details: JSON.stringify({ old: '0.95', new: '0.9' }),
    },
  });
  await db.auditLog.create({
    data: {
      userId: salesRepUser.id, action: 'CREDIT_REPAYMENT_COLLECTED', entity: 'Shop', entityId: shops[1].id,
      details: JSON.stringify({ amount: 500000, method: 'CASH' }),
    },
  });
  console.log('✅ 8 audit log entries');

  // ============================================
  // 17. CHAT MESSAGES (for shop 0 — full conversation)
  // ============================================
  const convId0 = `conv-${shopUsers[0].id}`;
  const convId1 = `conv-${shopUsers[1].id}`;

  const chatMsgs = [
    // Shop 0 conversation
    { userId: shopUsers[0].id, convId: convId0, dir: 'OUTGOING', type: 'TEXT', content: 'Xin chào, tôi muốn hỏi về đơn hàng ALD-' + dateStr + '-001', ago: 300 },
    { userId: shopUsers[0].id, convId: convId0, dir: 'INCOMING', type: 'TEXT', content: 'Chào bạn! Đơn hàng ALD-' + dateStr + '-001 đã được giao thành công vào hôm qua. Bạn có cần hỗ trợ gì thêm không ạ?', ago: 295, meta: JSON.stringify({ contentVi: 'Chào bạn! Đơn hàng đã giao thành công.' }) },
    { userId: shopUsers[0].id, convId: convId0, dir: 'OUTGOING', type: 'TEXT', content: 'Tôi muốn đặt thêm gạo ST25', ago: 60 },
    { userId: shopUsers[0].id, convId: convId0, dir: 'INCOMING', type: 'TEXT', content: 'Hiện tại Gạo ST25 (10kg) đang có giá 250.000đ/bao. Bạn muốn đặt bao nhiêu? Để tôi chuyển bạn sang trang sản phẩm nhé!', ago: 58, meta: JSON.stringify({ contentVi: 'Gạo ST25 giá 250k. Bạn muốn đặt bao nhiêu?' }) },
    { userId: shopUsers[0].id, convId: convId0, dir: 'INCOMING', type: 'QUICK_REPLY', content: 'Bạn cần hỗ trợ gì?', ago: 55, meta: JSON.stringify({ contentVi: 'Bạn cần hỗ trợ gì?', options: ['Tra cứu đơn hàng', 'Sản phẩm & Giá', 'Công nợ', 'Liên hệ Sales'] }) },
    // Shop 1 conversation
    { userId: shopUsers[1].id, convId: convId1, dir: 'OUTGOING', type: 'TEXT', content: 'Tôi cần thanh toán công nợ', ago: 120 },
    { userId: shopUsers[1].id, convId: convId1, dir: 'INCOMING', type: 'TEXT', content: 'Bạn hiện đang có công nợ cần thanh toán. Bạn có thể thanh toán qua ZaloPay hoặc MoMo trong mục Công nợ trên app.', ago: 118, meta: JSON.stringify({ contentVi: 'Bạn có công nợ cần thanh toán. Vui lòng vào mục Công nợ.' }) },
    { userId: shopUsers[1].id, convId: convId1, dir: 'SYSTEM', type: 'SYSTEM', content: 'Đơn hàng ALD-' + dateStr + '-002 đã được xác nhận.', ago: 115 },
  ];

  for (const msg of chatMsgs) {
    await db.chatMessage.create({
      data: {
        userId: msg.userId,
        conversationId: msg.convId,
        direction: msg.dir,
        messageType: msg.type,
        content: msg.content,
        isRead: msg.dir === 'INCOMING' || msg.dir === 'SYSTEM',
        metadata: msg.meta || null,
        createdAt: new Date(now - msg.ago * 1000),
      },
    });
  }
  console.log('✅ 8 chat messages (2 conversations)');

  // ============================================
  // RECALCULATE SHOP CREDIT BALANCES
  // ============================================
  for (const shop of shops) {
    const creditTx = await db.transaction.findMany({
      where: { shopId: shop.id, type: { in: ['CREDIT_USED', 'REPAYMENT', 'REFUND'] } },
      select: { amount: true },
    });
    const computed = creditTx.reduce((s, t) => s + t.amount, 0);
    await db.shop.update({ where: { id: shop.id }, data: { creditBalance: computed } });
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n🎉 Full seed completed!\n');
  console.log('📋 DATA SUMMARY:');
  console.log(`  📁 Categories:        ${categories.length}`);
  console.log(`  📍 Wards:             ${wards.length}`);
  console.log(`  🏭 Manufacturers:     ${manufacturers.length}`);
  console.log(`  🚚 Distributors:      ${distributors.length}`);
  console.log(`  👤 Users:             ${1 + 1 + 2 + 1 + shopUsers.length} (admin + sales_rep + 2 drivers + 1 broker + ${shopUsers.length} shops)`);
  console.log(`  🏪 Shops:             ${shops.length}`);
  console.log(`  🤝 Broker:            1`);
  console.log(`  📦 Products:          ${products.length} (4 per category, some out-of-stock)`);
  console.log(`  🏷️  Promotions:        ${promotions.length} (2 active, 1 expired)`);
  console.log(`  👥 Group Deals:       ${groupDeals.length} (1 active, 1 completed, 1 active)`);
  console.log(`  📋 Orders:            ${orderEntities.length} (DELIVERED×6, PACKED×2, CONFIRMED×2, PROCESSING×1, OUT_FOR_DELIVERY×1, PENDING×1, CANCELLED×1, REFUNDED×0)`);
  console.log(`  📦 Shipments:         ${shipmentEntities.length}`);
  console.log(`  💰 Transactions:      12 (CREDIT_USED, REPAYMENT, REFUND, ORDER_PAYMENT, LIMIT changes)`);
  console.log(`  💳 Payments:          5 (MoMo + ZaloPay records)`);
  console.log(`  📸 Merch Audits:      4 (2 approved, 1 pending, 1 rejected)`);
  console.log(`  ⚙️  Platform Settings: 6`);
  console.log(`  📝 Audit Log:         8`);
  console.log(`  💬 Chat Messages:     8 (2 conversations)`);
  console.log('\n🔐 LOGIN CREDENTIALS:');
  console.log('  Admin:    0901234567');
  console.log('  Shop 0:   0901234600 (Tạp Hóa Hạnh Phúc — GOLD, active credit)');
  console.log('  Shop 1:   0901234601 (Tâm An — PLATINUM, partial debt)');
  console.log('  Shop 2:   0901234602 (Bình Minh — SILVER, clean credit)');
  console.log('  Shop 3:   0901234603 (Phước Long — PLATINUM, LOCKED credit)');
  console.log('  Shop 4:   0901234604 (Lộc Phát — BRONZE, OVERDUE)');
  console.log('  Shop 5:   0901234605 (Hoa Mai — GOLD, fully repaid)');
  console.log('  Shop 6:   0901234606 (Phương Thảo — SILVER, active)');
  console.log('  Shop 7:   0901234607 (Thành Đạt — GOLD, clean)');
  console.log('  Sales:    0911111111');
  console.log('  Driver1:  0922222222');
  console.log('  Driver2:  0922333333');
  console.log('  Broker:   0933333333');
  console.log('\n💡 TIP: Use Shop 0 (0901234600) to see the fullest workflow experience!');
}

const houseNumbers = ['12', '45/3', '78B', '23', '156', '9/2A', '67', '101'];

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
