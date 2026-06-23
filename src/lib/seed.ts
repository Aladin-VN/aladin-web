// Re-usable seed function for both CLI (prisma/seed.ts) and API (/api/setup)
import { db } from './db';

const days = (n: number) => n * 24 * 60 * 60 * 1000;
const now = Date.now();
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const houseNumbers = ['12', '45/3', '78B', '23', '156', '9/2A', '67', '101'];

let orderSeq = 0;
const nextOrderNum = () => {
  orderSeq++;
  return `ALD-${dateStr}-${String(orderSeq).padStart(3, '0')}`;
};

export async function seedDatabase() {
  console.log('Seeding ALADIN database...');

  // Clean up (reverse dependency order)
  const tables = [
    'chatMessage', 'auditLog', 'platformSetting', 'payment',
    'settlementLineItem', 'settlement', 'platformFeeConfig',
    'inventoryMovement', 'distributorInventory', 'distributorUser',
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

  // 1. CATEGORIES (6)
  const catData = [
    { name: 'Gạo', nameEn: 'Rice', slug: 'gao', icon: '🌾', order: 1 },
    { name: 'Dầu ăn', nameEn: 'Cooking Oil', slug: 'dau-an', icon: '🫒', order: 2 },
    { name: 'Mì ăn liền', nameEn: 'Instant Noodles', slug: 'mi-an-lien', icon: '🍜', order: 3 },
    { name: 'Nước giải khát', nameEn: 'Beverages', slug: 'nuoc-giai-khat', icon: '🥤', order: 4 },
    { name: 'Gia vị & Thực phẩm khô', nameEn: 'Condiments & Dry Food', slug: 'gia-vi', icon: '🧂', order: 5 },
    { name: 'Đồ uống có cồn', nameEn: 'Alcoholic Beverages', slug: 'do-uong-co-con', icon: '🍺', order: 6 },
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

  // 2. WARDS (8)
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
  const wards = await Promise.all(wardData.map((w) => db.ward.create({ data: w })));

  // 3. MANUFACTURERS (3)
  const manufacturers = await Promise.all([
    db.manufacturer.create({
      data: {
        name: 'Công ty Lương thực Bình Dương', nameEn: 'Binh Duong Food Corp',
        contactPerson: 'Anh Minh', contactPhone: '0911222333', email: 'info@bdcfood.vn',
        address: 'KCN Sóng Thần 1, Dĩ An, BD', commissionRate: 0.15,
      },
    }),
    db.manufacturer.create({
      data: {
        name: 'Tập đoàn Dầu ăn Tương An', nameEn: 'Tuong An Oil Group',
        contactPerson: 'Chị Lan', contactPhone: '0911333444', email: 'sales@tuongan.vn',
        commissionRate: 0.18,
      },
    }),
    db.manufacturer.create({
      data: {
        name: 'Công ty Thực phẩm Acecook', nameEn: 'Acecook Vietnam',
        contactPerson: 'Anh Hùng', contactPhone: '0911444555', email: 'biz@acecook.vn',
        commissionRate: 0.12,
      },
    }),
  ]);

  // 4. DISTRIBUTORS (2)
  const distributors = await Promise.all([
    db.distributor.create({
      data: {
        name: 'Kho Phân Phối Miền Nam', nameEn: 'South Distribution Hub',
        contactPerson: 'Anh Tín', contactPhone: '0988111222',
        address: 'Số 12, Đại lộ Bình Dương, TP. TDM', lat: 10.8802, lng: 106.7873, isActive: true,
      },
    }),
    db.distributor.create({
      data: {
        name: 'Kho Tổng HCM', nameEn: 'HCM Main Warehouse',
        contactPerson: 'Chị Hạnh', contactPhone: '0988222333',
        address: 'Q7, TP. Hồ Chí Minh', lat: 10.7326, lng: 106.7195, isActive: true,
      },
    }),
  ]);

  // 5. USERS + SHOPS (admin + sales_rep + 2 drivers + 1 broker + 8 shops)
  const adminUser = await db.user.create({
    data: {
      phone: '0901234567', name: 'Admin ALADIN', nameEn: 'Admin ALADIN',
      role: 'ADMIN', status: 'ACTIVE',
      passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01', // password: "aladin123" (scrypt)
    },
  });

  const salesRepUser = await db.user.create({
    data: {
      phone: '0911111111', name: 'Nguyễn Văn An', nameEn: 'Nguyen Van An',
      role: 'SALES_REP', status: 'ACTIVE',
      passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
    },
  });

  const drivers = await Promise.all([
    db.user.create({
      data: {
        phone: '0922222222', name: 'Trần Văn B driver', nameEn: 'Tran Van B driver',
        role: 'DRIVER', status: 'ACTIVE',
        passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
      },
    }),
    db.user.create({
      data: {
        phone: '0922333333', name: 'Lê Văn C driver', nameEn: 'Le Van C driver',
        role: 'DRIVER', status: 'ACTIVE',
        passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
      },
    }),
  ]);

  const brokerUser = await db.user.create({
    data: {
      phone: '0933333333', name: 'Phạm Thị D broker', nameEn: 'Pham Thi D broker',
      role: 'BROKER', status: 'ACTIVE',
      passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
    },
  });

  // Distributor user (linked to first distributor)
  const distUser = await db.user.create({
    data: {
      phone: '0944444444', name: 'Anh Tín - Kho Miền Nam', nameEn: 'Tin - South Hub',
      role: 'DISTRIBUTOR', status: 'ACTIVE',
      passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
    },
  });
  await db.distributorUser.create({
    data: { userId: distUser.id, distributorId: distributors[0].id },
  });

  const shopDefs = [
    { name: 'Tạp Hóa Hạnh Phúc', nameEn: 'Hanh Phuc Groceries', ward: 0, type: 'TAPHOA', tier: 'GOLD', credit: 5000000, bal: 3380000 },
    { name: 'Tâm An', nameEn: 'Tam An Shop', ward: 1, type: 'TAPHOA', tier: 'PLATINUM', credit: 3000000, bal: 1450000 },
    { name: 'Bình Minh', nameEn: 'Binh Minh Store', ward: 2, type: 'CONVENIENCE', tier: 'SILVER', credit: 1000000, bal: 0 },
    { name: 'Phước Long', nameEn: 'Phuoc Long Mart', ward: 3, type: 'TAPHOA', tier: 'PLATINUM', credit: 5000000, bal: 4875000 },
    { name: 'Lộc Phát', nameEn: 'Loc Phat Trading', ward: 4, type: 'FACTORY', tier: 'BRONZE', credit: 1000000, bal: 450000 },
    { name: 'Hoa Mai', nameEn: 'Hoa Mai Shop', ward: 5, type: 'TAPHOA', tier: 'GOLD', credit: 2000000, bal: 0 },
    { name: 'Phương Thảo', nameEn: 'Phuong Thao', ward: 6, type: 'CONVENIENCE', tier: 'SILVER', credit: 1000000, bal: 0 },
    { name: 'Thành Đạt', nameEn: 'Thanh Dat Store', ward: 7, type: 'TAPHOA', tier: 'GOLD', credit: 1500000, bal: 0 },
  ];

  const shopUsers: Awaited<ReturnType<typeof db.user.create>>[] = [];
  const shops: Awaited<ReturnType<typeof db.shop.create>>[] = [];

  for (let i = 0; i < shopDefs.length; i++) {
    const sd = shopDefs[i];
    const phone = `09012346${String(i).padStart(2, '0')}`;
    const user = await db.user.create({
      data: {
        phone, name: `Chủ ${sd.name}`, nameEn: `Owner ${sd.nameEn}`,
        role: 'SHOP_OWNER', status: i === 4 ? 'SUSPENDED' : 'ACTIVE',
        passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
      },
    });
    shopUsers.push(user);

    const shop = await db.shop.create({
      data: {
        userId: user.id, name: sd.name, nameEn: sd.nameEn,
        wardId: wards[sd.ward].id,
        district: wards[sd.ward].district, province: wards[sd.ward].province,
        address: `${houseNumbers[i]}, ${wards[sd.ward].name}, ${wards[sd.ward].district}`,
        shopType: sd.type, loyaltyTier: sd.tier,
        creditLimit: sd.credit, creditBalance: sd.bal,
        creditStatus: i === 3 ? 'LOCKED' : i === 4 ? 'OVERDUE' : 'ACTIVE',
        totalOrders: [3, 3, 1, 2, 0, 2, 0, 1][i],
        totalGmv: [8_500_000, 6_200_000, 1_200_000, 9_500_000, 0, 3_800_000, 0, 2_100_000][i],
      },
    });
    shops.push(shop);
  }

  // Broker record
  await db.broker.create({
    data: {
      userId: brokerUser.id, tier: 'WARD_LEVEL', wardId: wards[0].id,
      commissionRate: 0.03, totalShopsReferred: 3, totalCommissionEarned: 570_000, totalGmvGenerated: 19_000_000,
    },
  });

  // 6. PRODUCTS (25)
  const productData = [
    // Rice (cat 0)
    { name: 'Gạo ST25 10kg', nameEn: 'ST25 Rice 10kg', sku: 'RCE-ST25-10', cat: 0, mfg: 0, dist: 0, price: 250000, stock: 200, min: 1, max: 50, brand: 'Binh Duong Food' },
    { name: 'Gạo thơm Jasmine 5kg', nameEn: 'Jasmine Rice 5kg', sku: 'RCE-JSM-5', cat: 0, mfg: 0, dist: 0, price: 95000, stock: 300, min: 1, max: 100, brand: 'Binh Duong Food' },
    { name: 'Gạo lứt rang 1kg', nameEn: 'Roasted Brown Rice 1kg', sku: 'RCE-BRN-1', cat: 0, mfg: 0, dist: 1, price: 35000, stock: 50, min: 1, max: 30, brand: 'Binh Duong Food' },
    { name: 'Gạo tám xoan 25kg', nameEn: 'Tam Xoan Rice 25kg', sku: 'RCE-TXM-25', cat: 0, mfg: 0, dist: 0, price: 550000, stock: 0, min: 1, max: 20, brand: 'Binh Duong Food' },
    // Cooking Oil (cat 1)
    { name: 'Dầu ăn Simply 1L', nameEn: 'Simply Cooking Oil 1L', sku: 'OIL-SMP-1', cat: 1, mfg: 1, dist: 0, price: 35000, stock: 500, min: 1, max: 100, brand: 'Tuong An' },
    { name: 'Dầu Tương An 2L', nameEn: 'Tuong An Oil 2L', sku: 'OIL-TGA-2', cat: 1, mfg: 1, dist: 0, price: 65000, stock: 300, min: 1, max: 60, brand: 'Tuong An' },
    { name: 'Dầu hào Chinsu 500ml', nameEn: 'Chinsu Oyster Sauce 500ml', sku: 'OIL-CHN-500', cat: 1, mfg: 1, dist: 1, price: 28000, stock: 200, min: 1, max: 50, brand: 'Chinsu' },
    { name: 'Dầu điều Bbox 500ml', nameEn: 'Bbox Coconut Oil 500ml', sku: 'OIL-BBX-500', cat: 1, mfg: 1, dist: 1, price: 45000, stock: 0, min: 1, max: 30, brand: 'Bbox' },
    // Noodles (cat 2)
    { name: 'Mì Hảo Hảo thùng 30 gói', nameEn: 'Hao Hao Noodles 30pk', sku: 'NOO-HHH-30', cat: 2, mfg: 2, dist: 0, price: 115000, stock: 1000, min: 1, max: 200, brand: 'Acecook' },
    { name: 'Mì ly Omachi 70g x 6', nameEn: 'Omachi Cup Noodle 6pk', sku: 'NOO-OMC-6', cat: 2, mfg: 2, dist: 0, price: 48000, stock: 600, min: 1, max: 100, brand: 'Acecook' },
    { name: 'Mì cay Kuay Teow 5 gói', nameEn: 'Spicy Kuay Teow 5pk', sku: 'NOO-KTE-5', cat: 2, mfg: 2, dist: 1, price: 25000, stock: 0, min: 1, max: 50, brand: 'Acecook' },
    { name: 'Phở Đệ Nhất gói lớn', nameEn: 'De Nhat Pho Large', sku: 'NOO-DN1-L', cat: 2, mfg: 2, dist: 0, price: 15000, stock: 800, min: 1, max: 100, brand: 'De Nhat' },
    // Beverages (cat 3)
    { name: 'Nước mắm Nam Ngư 500ml', nameEn: 'Nam Ngu Fish Sauce 500ml', sku: 'BEV-NNF-500', cat: 3, mfg: 1, dist: 0, price: 22000, stock: 400, min: 1, max: 100, brand: 'Nam Ngu' },
    { name: 'Nước tương Maggi 500ml', nameEn: 'Maggi Soy Sauce 500ml', sku: 'BEV-MGG-500', cat: 3, mfg: 1, dist: 0, price: 18000, stock: 500, min: 1, max: 150, brand: 'Maggi' },
    { name: 'Nước tinh khiết Aquafina 500ml x 24', nameEn: 'Aquafina Water 24pk', sku: 'BEV-AQF-24', cat: 3, mfg: 0, dist: 0, price: 120000, stock: 200, min: 1, max: 50, brand: 'Aquafina' },
    { name: 'Bia Sài Gòn Special 330ml x 24', nameEn: 'Saigon Special Beer 24pk', sku: 'BEV-SGS-24', cat: 3, mfg: 0, dist: 1, price: 320000, stock: 100, min: 1, max: 20, brand: 'Sabeco' },
    // Condiments (cat 4)
    { name: 'Đường tinh luyện 1kg', nameEn: 'Refined Sugar 1kg', sku: 'CON-SGR-1', cat: 4, mfg: 0, dist: 0, price: 25000, stock: 600, min: 1, max: 200, brand: 'Super Star' },
    { name: 'Muối i-ốt 500g', nameEn: 'Iodized Salt 500g', sku: 'CON-SLT-500', cat: 4, mfg: 0, dist: 0, price: 12000, stock: 800, min: 1, max: 300, brand: 'Super Star' },
    { name: 'Tiêu đen xay 200g', nameEn: 'Ground Black Pepper 200g', sku: 'CON-PEP-200', cat: 4, mfg: 0, dist: 1, price: 35000, stock: 300, min: 1, max: 100, brand: 'Chin-Su' },
    { name: 'Bột ngọt Ajinomoto 200g', nameEn: 'Ajinomoto MSG 200g', sku: 'CON-AJI-200', cat: 4, mfg: 2, dist: 0, price: 18000, stock: 400, min: 1, max: 200, brand: 'Ajinomoto' },
    { name: 'Gói gia vị nấu phở', nameEn: 'Pho Spice Mix', sku: 'CON-PHO-1', cat: 4, mfg: 0, dist: 0, price: 15000, stock: 0, min: 1, max: 100, brand: 'Aladin Select' },
    // Alcohol (cat 5)
    { name: 'Rượu vang đỏ Đà Lạt 750ml', nameEn: 'Dalat Red Wine 750ml', sku: 'ALC-DLR-750', cat: 5, mfg: 0, dist: 1, price: 185000, stock: 60, min: 1, max: 20, brand: 'Dalat Wine' },
    { name: 'Bia Heineken 330ml x 24', nameEn: 'Heineken Beer 24pk', sku: 'ALC-HKN-24', cat: 5, mfg: 0, dist: 1, price: 520000, stock: 50, min: 1, max: 10, brand: 'Heineken' },
    { name: 'Rượu sake Gekkakei 300ml', nameEn: 'Gekkakei Sake 300ml', sku: 'ALC-GKK-300', cat: 5, mfg: 2, dist: 1, price: 95000, stock: 40, min: 1, max: 30, brand: 'Gekkakei' },
    { name: 'Bia Larue 330ml x 24', nameEn: 'Larue Beer 24pk', sku: 'ALC-LRU-24', cat: 5, mfg: 0, dist: 0, price: 260000, stock: 0, min: 1, max: 15, brand: 'Larue' },
  ];

  const products = await Promise.all(
    productData.map((p) =>
      db.product.create({
        data: {
          name: p.name, nameEn: p.nameEn, sku: p.sku,
          categoryId: categories[p.cat].id,
          manufacturerId: manufacturers[p.mfg].id,
          distributorId: distributors[p.dist].id,
          basePrice: p.price, stockQuantity: p.stock,
          minOrderQty: p.min, maxOrderQty: p.max,
          brand: p.brand, unit: 'cai',
        },
      })
    )
  );

  // 6b. Distributor Inventory (seed stock for distributor 0)
  await Promise.all(
    products
      .filter((p) => p.distributorId === distributors[0].id)
      .map((p) =>
        db.distributorInventory.create({
          data: {
            distributorId: distributors[0].id,
            productId: p.id,
            quantity: Math.floor(p.stockQuantity * 0.6), // 60% of global stock at distributor
            reservedQty: 0,
            minStockLevel: 20,
            costPrice: Math.floor(p.basePrice * 0.7), // 70% of selling price as cost
          },
        })
      )
  );

  // 6c. Platform Fee Config (default)
  await db.platformFeeConfig.create({
    data: {
      name: 'Tiêu chuẩn 3%',
      feeType: 'PERCENTAGE',
      rate: 0.03,
      minFee: 0,
      isActive: true,
      appliesTo: 'ALL',
    },
  });

  // 7. PROMOTIONS (3)
  const promotions = await Promise.all([
    db.promotion.create({
      data: {
        manufacturerId: manufacturers[0].id,
        title: 'Mua 10 bao ST25 tặng 1 bao Jasmine', titleEn: 'Buy 10 ST25 Get 1 Jasmine Free',
        description: 'Khuyến mãi đặc biệt cho khách hàng VIP',
        promoType: 'BUY_X_GET_Y', buyQty: 10, getQty: 1,
        startsAt: new Date(now - days(5)), expiresAt: new Date(now + days(25)),
        totalBudget: 50000000, usedBudget: 15000000, totalRedemptions: 15, isActive: true,
      },
    }),
    db.promotion.create({
      data: {
        manufacturerId: manufacturers[2].id,
        title: 'Giảm 10% Mì Hảo Hảo', titleEn: '10% Off Hao Hao Noodles',
        description: 'Giảm 10% cho đơn hàng từ 5 thùng trở lên',
        promoType: 'PERCENT_OFF', discountPercent: 10.0,
        startsAt: new Date(now - days(3)), expiresAt: new Date(now + days(15)),
        totalBudget: 10000000, usedBudget: 3000000, totalRedemptions: 42, isActive: true,
      },
    }),
    db.promotion.create({
      data: {
        manufacturerId: manufacturers[1].id,
        title: 'Giảm 20.000đ Dầu Tương An 2L', titleEn: '20k Off Tuong An 2L Oil',
        description: 'Ưu đãi giảm giá trực tiếp',
        promoType: 'FIXED_DISCOUNT', discountAmount: 20000,
        startsAt: new Date(now - days(10)), expiresAt: new Date(now - days(1)),
        totalBudget: 8000000, usedBudget: 8000000, totalRedemptions: 400, isActive: false,
      },
    }),
  ]);

  await db.promotionItem.create({ data: { promotionId: promotions[0].id, productId: products[0].id } });
  await db.promotionItem.create({ data: { promotionId: promotions[1].id, productId: products[8].id } });
  await db.promotionItem.create({ data: { promotionId: promotions[2].id, productId: products[5].id } });

  // 8. GROUP DEALS (3)
  const groupDeals = await Promise.all([
    db.groupDeal.create({
      data: {
        title: 'Group Buy Gạo ST25 — Phú Mỹ', titleEn: 'Group Buy ST25 Rice — Phu My',
        productId: products[0].id, targetQty: 50, currentQty: 35,
        originalPrice: 250000, discountPrice: 220000, maxParticipants: 10,
        startsAt: new Date(now - days(2)), expiresAt: new Date(now + days(5)),
        wardId: wards[0].id, status: 'ACTIVE',
      },
    }),
    db.groupDeal.create({
      data: {
        title: 'Group Buy Mì Hảo Hảo — Dĩ An', titleEn: 'Group Buy Hao Hao — Di An',
        productId: products[8].id, targetQty: 100, currentQty: 100,
        originalPrice: 115000, discountPrice: 99000,
        startsAt: new Date(now - days(7)), expiresAt: new Date(now - days(1)),
        wardId: wards[3].id, status: 'COMPLETED',
      },
    }),
    db.groupDeal.create({
      data: {
        title: 'Group Buy Dầu Simply — Chánh Nghĩa', titleEn: 'Group Buy Simply Oil — Chanh Nghia',
        productId: products[4].id, targetQty: 40, currentQty: 12,
        originalPrice: 175000, discountPrice: 155000,
        startsAt: new Date(now - days(1)), expiresAt: new Date(now + days(6)),
        wardId: wards[1].id, status: 'ACTIVE',
      },
    }),
  ]);

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

  // 9. ORDERS (15)
  const orderDefs = [
    { s: 0, items: [{ p: 0, q: 10 }, { p: 2, q: 3 }], m: 'DIGITAL', st: 'DELIVERED', d: 12, iKey: 'seed-s0-o1' },
    { s: 1, items: [{ p: 0, q: 5 }, { p: 4, q: 2 }], m: 'CREDIT', st: 'DELIVERED', d: 10, iKey: 'seed-s1-o1' },
    { s: 2, items: [{ p: 4, q: 3 }, { p: 6, q: 5 }], m: 'COD', st: 'DELIVERED', d: 8, iKey: 'seed-s2-o1' },
    { s: 3, items: [{ p: 8, q: 10 }, { p: 9, q: 5 }, { p: 12, q: 3 }], m: 'DIGITAL', st: 'DELIVERED', d: 7, iKey: 'seed-s3-o1' },
    { s: 5, items: [{ p: 1, q: 2 }, { p: 16, q: 5 }], m: 'CREDIT', st: 'DELIVERED', d: 6, iKey: 'seed-s5-o1' },
    { s: 0, items: [{ p: 1, q: 3 }, { p: 3, q: 5 }], m: 'DIGITAL', st: 'OUT_FOR_DELIVERY', d: 1, iKey: 'seed-s0-o2' },
    { s: 3, items: [{ p: 0, q: 20 }, { p: 4, q: 5 }, { p: 8, q: 10 }], m: 'CREDIT', st: 'CONFIRMED', d: 0, iKey: 'seed-s3-o2' },
    { s: 4, items: [{ p: 7, q: 3 }], m: 'COD', st: 'PENDING', d: 0, iKey: 'seed-s4-o1' },
    { s: 1, items: [{ p: 5, q: 4 }, { p: 8, q: 6 }], m: 'DIGITAL', st: 'PROCESSING', d: 0, iKey: 'seed-s1-o2' },
    { s: 0, items: [{ p: 0, q: 15 }, { p: 4, q: 3 }, { p: 6, q: 10 }], m: 'CREDIT', st: 'PACKED', d: 0, iKey: 'seed-s0-o3' },
    { s: 0, items: [{ p: 8, q: 2 }], m: 'CREDIT', st: 'CANCELLED', d: 5, iKey: 'seed-s0-cancel' },
    { s: 6, items: [{ p: 16, q: 2 }, { p: 20, q: 3 }], m: 'DIGITAL', st: 'PACKED', d: 0, iKey: 'seed-s6-o1' },
    { s: 7, items: [{ p: 0, q: 5 }, { p: 12, q: 4 }], m: 'COD', st: 'CONFIRMED', d: 0, iKey: 'seed-s7-o1' },
    { s: 1, items: [{ p: 9, q: 3 }, { p: 16, q: 4 }], m: 'DIGITAL', st: 'DELIVERED', d: 3, iKey: 'seed-s1-o3' },
    { s: 5, items: [{ p: 4, q: 5 }, { p: 8, q: 8 }], m: 'CREDIT', st: 'DELIVERED', d: 4, iKey: 'seed-s5-o2' },
  ];

  const orderEntities: Awaited<ReturnType<typeof db.order.create>>[] = [];
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
        orderNumber: nextOrderNum(), shopId: shops[od.s].id,
        shopSnapshot: JSON.stringify({ id: shops[od.s].id, name: shops[od.s].name, phone: shopUsers[od.s].phone }),
        status: od.st, paymentMethod: od.m, paymentStatus: paySt,
        subtotalAmount: sub, discountAmount: discount, deliveryFee: delivery,
        totalAmount: total, paidAmount: paidAmt, creditUsed,
        idempotencyKey: `seed-${od.iKey}-${dateStr}`,
        customerNotes: 'Đặt qua ALADIN App', createdAt,
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
          orderId: order.id, productId: products[item.p].id,
          productName: products[item.p].name, productSku: products[item.p].sku,
          unitPrice: products[item.p].basePrice, quantity: item.q,
          totalPrice: products[item.p].basePrice * item.q,
        },
      });
    }
    orderEntities.push(order);
  }

  // 10. SHIPMENTS (6)
  const shipmentDefs = [
    { oi: 0, st: 'DELIVERED', driver: 0, d: 12 },
    { oi: 2, st: 'DELIVERED', driver: 1, d: 8 },
    { oi: 3, st: 'DELIVERED', driver: 0, d: 7 },
    { oi: 5, st: 'IN_TRANSIT', driver: 1, d: 1 },
    { oi: 9, st: 'PICKED_UP', driver: 0, d: 0 },
    { oi: 11, st: 'PENDING', driver: null, d: 0 },
  ];

  const shipmentEntities: Awaited<ReturnType<typeof db.shipment.create>>[] = [];
  for (const sd of shipmentDefs) {
    const order = orderEntities[sd.oi];
    const createdAt = new Date(now - days(sd.d));
    const shipment = await db.shipment.create({
      data: {
        orderId: order.id, type: 'INTERNAL', status: sd.st,
        assignedDriverId: sd.driver !== null ? drivers[sd.driver].id : null,
        pickupAddress: 'Kho Phân Phối Miền Nam, Số 12, Đại lộ Bình Dương',
        dropoffAddress: shops.find((s) => s.id === order.shopId)?.address || 'Unknown',
        deliveredAt: sd.st === 'DELIVERED' ? new Date(createdAt.getTime() + 86400000) : null,
        podPhotoUrl: sd.st === 'DELIVERED' ? 'https://placehold.co/600x400?text=POD+Photo' : null,
        thirdPartyTrackingId: sd.st === 'IN_TRANSIT' ? '3PL-2025-' + Math.random().toString(36).slice(2, 8) : null,
      },
    });
    if (sd.driver !== null) {
      await db.order.update({ where: { id: order.id }, data: { assignedDriverId: drivers[sd.driver].id } });
    }
    shipmentEntities.push(shipment);
  }

  // 11. TRANSACTIONS (12)
  await db.transaction.create({
    data: {
      shopId: shops[0].id, orderId: orderEntities[0].id,
      type: 'ORDER_PAYMENT', amount: -orderEntities[0].totalAmount, runningBalance: 0,
      paymentMethod: 'DIGITAL', paymentRef: 'MOMO-' + Math.random().toString(36).slice(2, 10).toUpperCase(),
      description: `Thanh toán ${orderEntities[0].orderNumber} qua MoMo`,
    },
  });

  const crUsed1 = orderEntities[1].subtotalAmount;
  await db.transaction.create({
    data: { shopId: shops[1].id, orderId: orderEntities[1].id, type: 'CREDIT_USED', amount: crUsed1, runningBalance: crUsed1, paymentMethod: 'CREDIT', description: `Công nợ ${orderEntities[1].orderNumber}` },
  });
  await db.transaction.create({
    data: { shopId: shops[1].id, orderId: orderEntities[1].id, type: 'REPAYMENT', amount: -500000, runningBalance: crUsed1 - 500000, paymentMethod: 'CASH', collectedBy: salesRepUser.id, description: 'Thu tiền mặt — Sales Rep An' },
  });

  await db.transaction.create({
    data: { shopId: shops[2].id, orderId: orderEntities[2].id, type: 'ORDER_PAYMENT', amount: -orderEntities[2].totalAmount, runningBalance: 0, paymentMethod: 'COD', description: `COD ${orderEntities[2].orderNumber}` },
  });

  await db.transaction.create({
    data: { shopId: shops[3].id, orderId: orderEntities[6].id, type: 'CREDIT_USED', amount: orderEntities[6].subtotalAmount, runningBalance: orderEntities[6].subtotalAmount, paymentMethod: 'CREDIT', description: `Công nợ ${orderEntities[6].orderNumber} (AUTO_LOCK)`, metadata: JSON.stringify({ action: 'AUTO_LOCK_TRIGGER' }) },
  });

  await db.transaction.create({
    data: { shopId: shops[0].id, orderId: orderEntities[9].id, type: 'CREDIT_USED', amount: orderEntities[9].subtotalAmount, runningBalance: orderEntities[9].subtotalAmount, paymentMethod: 'CREDIT', description: `Công nợ ${orderEntities[9].orderNumber}` },
  });

  // Cancelled order credit + refund
  await db.transaction.create({
    data: { shopId: shops[0].id, orderId: orderEntities[10].id, type: 'CREDIT_USED', amount: orderEntities[10].subtotalAmount, runningBalance: orderEntities[10].subtotalAmount, paymentMethod: 'CREDIT', description: `Công nợ ${orderEntities[10].orderNumber}` },
  });
  await db.transaction.create({
    data: { shopId: shops[0].id, orderId: orderEntities[10].id, type: 'REFUND', amount: -orderEntities[10].subtotalAmount, runningBalance: 0, description: `Hoàn tiền ${orderEntities[10].orderNumber} (đã hủy)`, metadata: JSON.stringify({ reason: 'Sai sản phẩm' }) },
  });

  // Shop 5 — CREDIT used + fully repaid
  await db.transaction.create({
    data: { shopId: shops[5].id, orderId: orderEntities[4].id, type: 'CREDIT_USED', amount: orderEntities[4].subtotalAmount, runningBalance: orderEntities[4].subtotalAmount, paymentMethod: 'CREDIT', description: `Công nợ ${orderEntities[4].orderNumber}` },
  });
  await db.transaction.create({
    data: { shopId: shops[5].id, orderId: orderEntities[4].id, type: 'REPAYMENT', amount: -orderEntities[4].subtotalAmount, runningBalance: 0, paymentMethod: 'DIGITAL', paymentRef: 'ZALOPAY-' + Math.random().toString(36).slice(2, 10).toUpperCase(), description: `Thanh toán đủ ${orderEntities[4].orderNumber} qua ZaloPay` },
  });

  // Credit limit increases
  await db.transaction.create({
    data: { shopId: shops[3].id, type: 'CREDIT_LIMIT_INCREASE', amount: 0, runningBalance: shops[3].creditBalance, description: 'Tăng hạn mức từ 3M lên 5M bởi Admin', metadata: JSON.stringify({ oldLimit: 3000000, newLimit: 5000000, adminUserId: adminUser.id }) },
  });
  await db.transaction.create({
    data: { shopId: shops[1].id, type: 'CREDIT_LIMIT_INCREASE', amount: 0, runningBalance: shops[1].creditBalance, description: 'Tăng hạn mức từ 2M lên 3M bởi Admin', metadata: JSON.stringify({ oldLimit: 2000000, newLimit: 3000000 }) },
  });

  // Shop 5 — CREDIT used (current debt)
  await db.transaction.create({
    data: { shopId: shops[5].id, orderId: orderEntities[14].id, type: 'CREDIT_USED', amount: orderEntities[14].subtotalAmount, runningBalance: orderEntities[14].subtotalAmount, paymentMethod: 'CREDIT', description: `Công nợ ${orderEntities[14].orderNumber}` },
  });

  // 12. PAYMENTS (5)
  const digitalOrders = [0, 3, 5, 8, 13];
  const gateways = ['MOMO', 'ZALOPAY', 'MOMO', 'ZALOPAY', 'MOMO'] as const;
  for (let i = 0; i < digitalOrders.length; i++) {
    const order = orderEntities[digitalOrders[i]];
    const isPaid = order.paymentStatus === 'PAID';
    await db.payment.create({
      data: {
        orderId: order.id, gateway: gateways[i],
        gatewayTxId: `${gateways[i]}-${Math.random().toString(36).slice(2, 14).toUpperCase()}`,
        amount: order.totalAmount, status: isPaid ? 'SUCCESS' : 'PENDING',
        paidAt: isPaid ? new Date(order.createdAt.getTime() + 600000) : null,
        expiresAt: new Date(order.createdAt.getTime() + 900000),
        rawRequest: JSON.stringify({ amount: order.totalAmount, gateway: gateways[i] }),
      },
    });
  }

  // 13. MERCHANDISING AUDITS (4)
  await db.merchandisingAudit.create({
    data: { shopId: shops[0].id, productId: products[0].id, promotionId: promotions[0].id, photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+1', status: 'APPROVED', reviewerId: adminUser.id, reviewNotes: 'Kệ hàng đẹp, đúng vị trí', reviewedAt: new Date(now - days(2)) },
  });
  await db.merchandisingAudit.create({
    data: { shopId: shops[1].id, productId: products[8].id, promotionId: promotions[1].id, photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+2', status: 'APPROVED', reviewerId: adminUser.id, reviewNotes: 'Banner khuyến mãi đúng chuẩn', reviewedAt: new Date(now - days(1)) },
  });
  await db.merchandisingAudit.create({
    data: { shopId: shops[3].id, productId: products[4].id, photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+3', status: 'PENDING_REVIEW' },
  });
  await db.merchandisingAudit.create({
    data: { shopId: shops[5].id, productId: products[16].id, photoUrl: 'https://placehold.co/600x800?text=Shelf+Audit+4', status: 'REJECTED', reviewerId: adminUser.id, reviewNotes: 'Sản phẩm sai vị trí, cần sắp xếp lại', reviewedAt: new Date(now - days(3)) },
  });

  // 14. PLATFORM SETTINGS (6)
  const settingsData = [
    { key: 'platform.name', value: 'ALADIN B2B', category: 'general', desc: 'Platform name' },
    { key: 'credit.defaultLimit', value: '1000000', category: 'credit', desc: 'Default credit limit (VND)' },
    { key: 'credit.maxLimit', value: '10000000', category: 'credit', desc: 'Maximum credit limit (VND)' },
    { key: 'credit.autoLockThreshold', value: '0.9', category: 'credit', desc: 'Auto-lock at 90% usage' },
    { key: 'notification.orderCreated', value: 'true', category: 'notification', desc: 'Notify admin on new order' },
    { key: 'notification.deliveryCompleted', value: 'true', category: 'notification', desc: 'Notify shop on delivery' },
  ];
  await Promise.all(settingsData.map((s) => db.platformSetting.create({ data: { key: s.key, value: s.value, category: s.category, description: s.desc } })));

  // 15. AUDIT LOG (8)
  await db.auditLog.create({ data: { userId: adminUser.id, action: 'USER_CREATED', entity: 'User', entityId: shopUsers[0].id, details: JSON.stringify({ phone: shopUsers[0].phone, role: 'SHOP_OWNER' }) } });
  await db.auditLog.create({ data: { userId: adminUser.id, action: 'CREDIT_LIMIT_CHANGED', entity: 'Shop', entityId: shops[3].id, details: JSON.stringify({ from: 3000000, to: 5000000 }) } });
  await db.auditLog.create({ data: { userId: adminUser.id, action: 'ORDER_CANCELLED', entity: 'Order', entityId: orderEntities[10].id, details: JSON.stringify({ reason: 'Sai sản phẩm' }) } });
  await db.auditLog.create({ data: { action: 'SYSTEM', entity: 'Order', entityId: orderEntities[6].id, details: JSON.stringify({ action: 'AUTO_LOCK_TRIGGERED', shopId: shops[3].id }) } });
  await db.auditLog.create({ data: { userId: adminUser.id, action: 'PROMOTION_CREATED', entity: 'Promotion', entityId: promotions[0].id, details: JSON.stringify({ title: promotions[0].title }) } });
  await db.auditLog.create({ data: { userId: adminUser.id, action: 'PASSWORD_RESET', entity: 'User', entityId: shopUsers[2].id, details: JSON.stringify({ triggeredBy: 'admin', method: 'manual' }) } });
  await db.auditLog.create({ data: { action: 'SYSTEM', entity: 'PlatformSetting', entityId: 'credit.autoLockThreshold', details: JSON.stringify({ old: '0.95', new: '0.9' }) } });
  await db.auditLog.create({ data: { userId: salesRepUser.id, action: 'CREDIT_REPAYMENT_COLLECTED', entity: 'Shop', entityId: shops[1].id, details: JSON.stringify({ amount: 500000, method: 'CASH' }) } });

  // 16. CHAT MESSAGES (8)
  const convId0 = `conv-${shopUsers[0].id}`;
  const convId1 = `conv-${shopUsers[1].id}`;
  const chatMsgs = [
    { userId: shopUsers[0].id, convId: convId0, dir: 'OUTGOING' as const, type: 'TEXT' as const, content: 'Xin chào, tôi muốn hỏi về đơn hàng ALD-' + dateStr + '-001', ago: 300 },
    { userId: shopUsers[0].id, convId: convId0, dir: 'INCOMING' as const, type: 'TEXT' as const, content: 'Chào bạn! Đơn hàng đã được giao thành công. Bạn có cần hỗ trợ gì thêm không ạ?', ago: 295 },
    { userId: shopUsers[0].id, convId: convId0, dir: 'OUTGOING' as const, type: 'TEXT' as const, content: 'Tôi muốn đặt thêm gạo ST25', ago: 60 },
    { userId: shopUsers[0].id, convId: convId0, dir: 'INCOMING' as const, type: 'TEXT' as const, content: 'Hiện tại Gạo ST25 (10kg) đang có giá 250.000đ/bao. Bạn muốn đặt bao nhiêu?', ago: 58 },
    { userId: shopUsers[0].id, convId: convId0, dir: 'INCOMING' as const, type: 'QUICK_REPLY' as const, content: 'Bạn cần hỗ trợ gì?', ago: 55 },
    { userId: shopUsers[1].id, convId: convId1, dir: 'OUTGOING' as const, type: 'TEXT' as const, content: 'Tôi cần thanh toán công nợ', ago: 120 },
    { userId: shopUsers[1].id, convId: convId1, dir: 'INCOMING' as const, type: 'TEXT' as const, content: 'Bạn hiện đang có công nợ cần thanh toán. Vui lòng vào mục Công nợ trên app.', ago: 118 },
    { userId: shopUsers[1].id, convId: convId1, dir: 'SYSTEM' as const, type: 'SYSTEM' as const, content: 'Đơn hàng ALD-' + dateStr + '-002 đã được xác nhận.', ago: 115 },
  ];
  for (const msg of chatMsgs) {
    await db.chatMessage.create({
      data: {
        userId: msg.userId, conversationId: msg.convId,
        direction: msg.dir, messageType: msg.type, content: msg.content,
        isRead: msg.dir === 'INCOMING' || msg.dir === 'SYSTEM',
        createdAt: new Date(now - msg.ago * 1000),
      },
    });
  }

  // 17. SECOND DISTRIBUTOR USER
  const distUser1 = await db.user.create({
    data: {
      phone: '0945555555', name: 'Chị Hạnh - Kho HCM', nameEn: 'Han - HCM Warehouse',
      role: 'DISTRIBUTOR', status: 'ACTIVE',
      passwordHash: '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01',
    },
  });
  await db.distributorUser.create({
    data: { userId: distUser1.id, distributorId: distributors[1].id },
  });

  // 18. ADDITIONAL INVENTORY (distributor 1 + low-stock items for distributor 0)
  const additionalInventory = [
    // Distributor 1 — products with dist:1 (indices 2, 6, 7, 10, 15, 18, 21, 22, 23)
    { distIdx: 1, prodIdx: 2, qty: 180, minStock: 15, cost: Math.round(products[2].basePrice * 0.70) },
    { distIdx: 1, prodIdx: 6, qty: 150, minStock: 20, cost: Math.round(products[6].basePrice * 0.70) },
    { distIdx: 1, prodIdx: 7, qty: 8, minStock: 15, cost: Math.round(products[7].basePrice * 0.70) },   // LOW STOCK
    { distIdx: 1, prodIdx: 10, qty: 200, minStock: 25, cost: Math.round(products[10].basePrice * 0.70) },
    { distIdx: 1, prodIdx: 15, qty: 60, minStock: 10, cost: Math.round(products[15].basePrice * 0.70) },
    { distIdx: 1, prodIdx: 18, qty: 5, minStock: 10, cost: Math.round(products[18].basePrice * 0.70) },   // LOW STOCK
    { distIdx: 1, prodIdx: 21, qty: 80, minStock: 10, cost: Math.round(products[21].basePrice * 0.70) },
    { distIdx: 1, prodIdx: 22, qty: 45, minStock: 10, cost: Math.round(products[22].basePrice * 0.70) },
    { distIdx: 1, prodIdx: 23, qty: 3, minStock: 10, cost: Math.round(products[23].basePrice * 0.70) },   // LOW STOCK
    // Distributor 0 — extra stock top-ups for products that had 0 global stock
    { distIdx: 0, prodIdx: 3, qty: 60, minStock: 10, cost: Math.round(products[3].basePrice * 0.70) },
    { distIdx: 0, prodIdx: 20, qty: 100, minStock: 15, cost: Math.round(products[20].basePrice * 0.70) },
    { distIdx: 0, prodIdx: 24, qty: 70, minStock: 10, cost: Math.round(products[24].basePrice * 0.70) },
  ];
  for (const inv of additionalInventory) {
    await db.distributorInventory.create({
      data: {
        distributorId: distributors[inv.distIdx].id,
        productId: products[inv.prodIdx].id,
        quantity: inv.qty,
        reservedQty: 0,
        minStockLevel: inv.minStock,
        costPrice: inv.cost,
      },
    });
  }

  // 19. ADDITIONAL 55 ORDERS (spread over 60 days)
  // Deterministic pseudo-random helpers
  const pseudoRand = (seed: number) => {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  };

  const dist0Products = productData.map((p, i) => ({ ...p, idx: i })).filter((p) => p.dist === 0);
  const dist1Products = productData.map((p, i) => ({ ...p, idx: i })).filter((p) => p.dist === 1);

  const statusPool = [
    'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
    'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED',
    'DELIVERED', 'DELIVERED', // ~60% DELIVERED (12/20 slots)
    'PROCESSING', 'OUT_FOR_DELIVERY', 'PACKED', // ~15% in-progress (3/20)
    'PENDING', 'CONFIRMED', // ~10% (2/20)
    'CANCELLED', // ~5% (1/20)
    'PACKED', // ~10% PACKED (2/20)
  ];

  const paymentPool = ['CREDIT', 'CREDIT', 'CREDIT', 'CREDIT', 'CREDIT', // 50%
    'DIGITAL', 'DIGITAL', 'DIGITAL', // 30%
    'COD', 'COD', // 20%
  ];

  const newOrderEntities: Awaited<ReturnType<typeof db.order.create>>[] = [];
  const newOrderDefs: { shopIdx: number; distIdx: number; prodIndices: number[]; quantities: number[]; status: string; payment: string; daysAgo: number }[] = [];

  for (let i = 0; i < 55; i++) {
    const r = pseudoRand(i * 7 + 13);
    const shopIdx = Math.floor(pseudoRand(i * 3 + 7) * 8);
    const distIdx = i % 2 === 0 ? 0 : 1;
    const availableProducts = distIdx === 0 ? dist0Products : dist1Products;

    // 1-4 items per order
    const numItems = 1 + Math.floor(pseudoRand(i * 11 + 5) * 4);
    const prodIndices: number[] = [];
    const quantities: number[] = [];
    const usedSet = new Set<number>();
    for (let j = 0; j < numItems && j < availableProducts.length; j++) {
      let pi: number;
      do { pi = Math.floor(pseudoRand(i * 13 + j * 17 + 3) * availableProducts.length); } while (usedSet.has(pi));
      usedSet.add(pi);
      const prod = availableProducts[pi];
      prodIndices.push(prod.idx);
      quantities.push(Math.max(prod.min, Math.floor(pseudoRand(i * 19 + j * 23 + 11) * (prod.max - prod.min + 1))));
    }

    const statusIdx = Math.floor(pseudoRand(i * 29 + 41) * statusPool.length);
    const status = statusPool[statusIdx];
    const paymentIdx = Math.floor(pseudoRand(i * 31 + 43) * paymentPool.length);
    const payment = paymentPool[paymentIdx];
    const daysAgo = 1 + Math.floor(pseudoRand(i * 37 + 47) * 59);

    newOrderDefs.push({ shopIdx, distIdx, prodIndices, quantities, status, payment, daysAgo });
  }

  for (let i = 0; i < newOrderDefs.length; i++) {
    const od = newOrderDefs[i];
    const sub = od.prodIndices.reduce((s, pi, j) => s + products[pi].basePrice * od.quantities[j], 0);
    const discount = od.payment === 'DIGITAL' ? Math.round(sub * 0.02) : 0;
    const delivery = od.payment === 'COD' ? 15000 : 0;
    const total = sub - discount + delivery;

    let paySt = 'PENDING';
    let paidAmt = 0;
    let creditUsed = 0;

    if (od.status === 'DELIVERED') {
      if (od.payment === 'DIGITAL' || od.payment === 'COD') { paySt = 'PAID'; paidAmt = total; }
      else { creditUsed = sub; }
    } else if (od.payment === 'CREDIT' && od.status !== 'CANCELLED') {
      creditUsed = sub;
    } else if (od.status === 'CANCELLED') {
      paySt = 'REFUNDED'; creditUsed = sub;
    }

    const createdAt = new Date(now - days(od.daysAgo));
    const order = await db.order.create({
      data: {
        orderNumber: nextOrderNum(), shopId: shops[od.shopIdx].id,
        shopSnapshot: JSON.stringify({ id: shops[od.shopIdx].id, name: shops[od.shopIdx].name, phone: shopUsers[od.shopIdx].phone }),
        status: od.status, paymentMethod: od.payment, paymentStatus: paySt,
        subtotalAmount: sub, discountAmount: discount, deliveryFee: delivery,
        totalAmount: total, paidAmount: paidAmt, creditUsed,
        idempotencyKey: `seed-extra-${i}-${dateStr}`,
        customerNotes: 'Đặt qua ALADIN App', createdAt,
        confirmedAt: od.status !== 'PENDING' ? new Date(createdAt.getTime() + 3600000) : null,
        packedAt: ['PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(od.status) ? new Date(createdAt.getTime() + 7200000) : null,
        deliveredAt: od.status === 'DELIVERED' ? new Date(createdAt.getTime() + 86400000) : null,
        cancelledAt: od.status === 'CANCELLED' ? new Date(createdAt.getTime() + 7200000) : null,
        cancelReason: od.status === 'CANCELLED' ? 'Khách yêu cầu hủy' : null,
        distributorId: distributors[od.distIdx].id,
        fulfilledByDistributorAt: od.status === 'DELIVERED' ? new Date(createdAt.getTime() + 5400000) : null,
      },
    });

    for (let j = 0; j < od.prodIndices.length; j++) {
      await db.orderItem.create({
        data: {
          orderId: order.id, productId: products[od.prodIndices[j]].id,
          productName: products[od.prodIndices[j]].name, productSku: products[od.prodIndices[j]].sku,
          unitPrice: products[od.prodIndices[j]].basePrice, quantity: od.quantities[j],
          totalPrice: products[od.prodIndices[j]].basePrice * od.quantities[j],
        },
      });
    }
    newOrderEntities.push(order);
  }

  // 20. INVENTORY MOVEMENTS for distributor 0 (25 movements)
  // Use delivered orders from distributor 0 for ORDER_FULFILLMENT movements
  const dist0DeliveredOrders = newOrderEntities.filter(
    (o) => o.distributorId === distributors[0].id && o.status === 'DELIVERED'
  );
  const dist0AllOriginalDelivered = orderEntities.filter(
    (o) => o.distributorId === distributors[0].id && o.status === 'DELIVERED'
  );

  const invMovements: { prodIdx: number; type: string; qty: number; reason: string; orderId?: string; daysAgo: number }[] = [];

  // RECEIPT movements (stock in)
  invMovements.push(
    { prodIdx: 0, type: 'RECEIPT', qty: 100, reason: 'Nhập hàng mới từ nhà sản xuất', daysAgo: 45 },
    { prodIdx: 4, type: 'RECEIPT', qty: 200, reason: 'Nhập hàng mới từ nhà sản xuất', daysAgo: 40 },
    { prodIdx: 8, type: 'RECEIPT', qty: 300, reason: 'Nhập hàng mới từ nhà sản xuất', daysAgo: 35 },
    { prodIdx: 5, type: 'RECEIPT', qty: 150, reason: 'Nhập bổ sung', daysAgo: 25 },
    { prodIdx: 14, type: 'RECEIPT', qty: 80, reason: 'Nhập hàng mới từ nhà sản xuất', daysAgo: 20 },
    { prodIdx: 16, type: 'RECEIPT', qty: 200, reason: 'Nhập bổ sung', daysAgo: 15 },
    { prodIdx: 13, type: 'RECEIPT', qty: 250, reason: 'Nhập hàng mới từ nhà sản xuất', daysAgo: 10 },
    { prodIdx: 1, type: 'RECEIPT', qty: 100, reason: 'Nhập bổ sung', daysAgo: 5 },
  );

  // ORDER_FULFILLMENT movements (stock out) — reference actual delivered orders
  const allDist0Delivered = [...dist0AllOriginalDelivered, ...dist0DeliveredOrders];
  const fulfillOrders = allDist0Delivered.slice(0, 10);
  for (let i = 0; i < fulfillOrders.length; i++) {
    const orderItems = await db.orderItem.findMany({ where: { orderId: fulfillOrders[i].id } });
    for (const item of orderItems) {
      const prodIdx = products.findIndex((p) => p.id === item.productId);
      if (prodIdx >= 0) {
        invMovements.push({
          prodIdx,
          type: 'ORDER_FULFILLMENT',
          qty: -item.quantity,
          reason: `Xuất hàng cho đơn ${fulfillOrders[i].orderNumber}`,
          orderId: fulfillOrders[i].id,
          daysAgo: Math.floor((now - fulfillOrders[i].createdAt.getTime()) / (24 * 60 * 60 * 1000)),
        });
      }
    }
  }

  // ADJUSTMENT movements
  invMovements.push(
    { prodIdx: 9, type: 'ADJUSTMENT', qty: -15, reason: 'Kiểm kho: thiếu 15 đơn vị', daysAgo: 12 },
    { prodIdx: 12, type: 'ADJUSTMENT', qty: 10, reason: 'Kiểm kho: thừa 10 đơn vị', daysAgo: 8 },
    { prodIdx: 0, type: 'ADJUSTMENT', qty: -5, reason: 'Hàng hư hỏng, loại bỏ', daysAgo: 6 },
    { prodIdx: 19, type: 'ADJUSTMENT', qty: -8, reason: 'Hàng hết hạn sử dụng', daysAgo: 3 },
  );

  // Create inventory movements
  for (const mov of invMovements) {
    const currentInv = await db.distributorInventory.findFirst({
      where: { distributorId: distributors[0].id, productId: products[mov.prodIdx].id },
    });
    const prevQty = currentInv?.quantity ?? 0;
    const newQty = prevQty + mov.qty;
    await db.inventoryMovement.create({
      data: {
        distributorId: distributors[0].id,
        productId: products[mov.prodIdx].id,
        type: mov.type,
        quantity: mov.qty,
        previousQty: prevQty,
        newQty: Math.max(0, newQty),
        reason: mov.reason,
        orderId: mov.orderId ?? null,
        performedBy: distUser.id,
        createdAt: new Date(now - days(mov.daysAgo)),
      },
    });
    // Update the inventory quantity
    if (currentInv) {
      await db.distributorInventory.update({
        where: { id: currentInv.id },
        data: { quantity: Math.max(0, newQty) },
      });
    }
  }

  // 21. SETTLEMENTS (2 per distributor, past 4 weeks)
  // Collect all delivered orders per distributor from both original and new orders
  const allOrders = [...orderEntities, ...newOrderEntities];

  // Week boundaries (4 weeks ago to now)
  const weekStarts = [
    new Date(now - days(28)), // 4 weeks ago
    new Date(now - days(21)), // 3 weeks ago
    new Date(now - days(14)), // 2 weeks ago
    new Date(now - days(7)),  // 1 week ago
  ];
  const weekEnds = [
    new Date(now - days(21)),
    new Date(now - days(14)),
    new Date(now - days(7)),
    new Date(now),
  ];

  const settlementStatuses = ['PAID', 'PAID', 'PROCESSING', 'PENDING'];

  for (let distIdx = 0; distIdx < 2; distIdx++) {
    for (let w = 0; w < 2; w++) {
      const weekIdx = distIdx * 2 + w; // 0,1 for dist0; 2,3 for dist1
      const periodStart = weekStarts[weekIdx];
      const periodEnd = weekEnds[weekIdx];

      const deliveredInPeriod = allOrders.filter((o) =>
        o.distributorId === distributors[distIdx].id &&
        o.status === 'DELIVERED' &&
        o.deliveredAt &&
        o.deliveredAt >= periodStart &&
        o.deliveredAt < periodEnd
      );

      if (deliveredInPeriod.length === 0) continue;

      const totalOrderValue = deliveredInPeriod.reduce((s, o) => s + o.totalAmount, 0);
      const totalPlatformFee = Math.round(totalOrderValue * 0.03);
      const totalDeliveryFee = deliveredInPeriod.reduce((s, o) => s + o.deliveryFee, 0);
      const distributorPayout = totalOrderValue - totalPlatformFee;

      const status = settlementStatuses[weekIdx];
      const settlementNum = `STL-${dateStr.slice(0, 6)}-D${distIdx + 1}W${w + 1}`;

      const settlement = await db.settlement.create({
        data: {
          settlementNumber: settlementNum,
          distributorId: distributors[distIdx].id,
          periodStart,
          periodEnd,
          totalOrders: deliveredInPeriod.length,
          totalOrderValue,
          totalPlatformFee,
          totalDeliveryFee,
          distributorPayout,
          driverPayouts: Math.round(totalDeliveryFee * 0.3), // 30% to drivers
          status,
          paidAt: status === 'PAID' ? new Date(periodEnd.getTime() + 2 * 86400000) : null,
          paymentRef: status === 'PAID' ? `BANK-${settlementNum}-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : null,
          notes: status === 'PAID' ? 'Thanh toán theo kỳ' : status === 'PROCESSING' ? 'Đang xử lý' : 'Chờ xử lý',
        },
      });

      // Settlement line items
      for (const order of deliveredInPeriod) {
        const orderPlatformFee = Math.round(order.totalAmount * 0.03);
        const orderDeliveryFee = order.deliveryFee;
        await db.settlementLineItem.create({
          data: {
            settlementId: settlement.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderAmount: order.totalAmount,
            platformFee: orderPlatformFee,
            deliveryFee: orderDeliveryFee,
            distributorAmount: order.totalAmount - orderPlatformFee,
            driverAmount: Math.round(orderDeliveryFee * 0.3),
            driverId: order.assignedDriverId,
          },
        });
      }
    }
  }

  // 22. ADDITIONAL TRANSACTIONS FOR NEW ORDERS
  let txRunningBalances: Record<string, number> = {};
  // Initialize from existing transactions for each shop
  for (const shop of shops) {
    const existingTx = await db.transaction.findMany({
      where: { shopId: shop.id, type: { in: ['CREDIT_USED', 'REPAYMENT', 'REFUND'] } },
      select: { amount: true },
    });
    txRunningBalances[shop.id] = existingTx.reduce((s, t) => s + t.amount, 0);
  }

  for (let i = 0; i < newOrderDefs.length; i++) {
    const od = newOrderDefs[i];
    const order = newOrderEntities[i];
    const shopId = shops[od.shopIdx].id;

    if (od.payment === 'CREDIT') {
      // CREDIT_USED transaction
      txRunningBalances[shopId] = (txRunningBalances[shopId] || 0) + order.subtotalAmount;
      await db.transaction.create({
        data: {
          shopId,
          orderId: order.id,
          type: 'CREDIT_USED',
          amount: order.subtotalAmount,
          runningBalance: txRunningBalances[shopId],
          paymentMethod: 'CREDIT',
          description: `Công nợ ${order.orderNumber}`,
          createdAt: order.createdAt,
        },
      });

      // If CANCELLED, add a REFUND
      if (od.status === 'CANCELLED') {
        txRunningBalances[shopId] -= order.subtotalAmount;
        await db.transaction.create({
          data: {
            shopId,
            orderId: order.id,
            type: 'REFUND',
            amount: -order.subtotalAmount,
            runningBalance: txRunningBalances[shopId],
            description: `Hoàn tiền ${order.orderNumber} (đã hủy)`,
            metadata: JSON.stringify({ reason: 'Khách yêu cầu hủy' }),
            createdAt: new Date(order.createdAt.getTime() + 7200000),
          },
        });
      }
    } else if ((od.payment === 'DIGITAL' || od.payment === 'COD') && od.status === 'DELIVERED') {
      // ORDER_PAYMENT transaction
      await db.transaction.create({
        data: {
          shopId,
          orderId: order.id,
          type: 'ORDER_PAYMENT',
          amount: -order.totalAmount,
          runningBalance: txRunningBalances[shopId] || 0,
          paymentMethod: od.payment,
          paymentRef: od.payment === 'DIGITAL'
            ? `${od.payment === 'DIGITAL' ? 'ZALOPAY' : 'COD'}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
            : undefined,
          description: `Thanh toán ${order.orderNumber} qua ${od.payment === 'DIGITAL' ? 'chuyển khoản' : 'COD'}`,
          createdAt: order.createdAt,
        },
      });
    }
  }

  // DISTRIBUTOR_PAYOUT transactions (one per PAID settlement)
  const paidSettlements = await db.settlement.findMany({ where: { status: 'PAID' } });
  for (const stl of paidSettlements) {
    await db.transaction.create({
      data: {
        shopId: shops[0].id, // proxy shop for distributor payout records
        type: 'DISTRIBUTOR_PAYOUT',
        amount: stl.distributorPayout,
        runningBalance: 0,
        paymentMethod: 'BANK_TRANSFER',
        paymentRef: stl.paymentRef,
        description: `Thanh toán cho ${distributors.find((d) => d.id === stl.distributorId)?.name ?? 'Distributor'} — ${stl.settlementNumber}`,
        metadata: JSON.stringify({ settlementId: stl.id, distributorId: stl.distributorId, periodStart: stl.periodStart, periodEnd: stl.periodEnd }),
        createdAt: stl.paidAt ?? stl.createdAt,
      },
    });
  }

  // 23. UPDATE DISTRIBUTOR STATS
  // Distributor 0 stats
  const dist0AllOrders = allOrders.filter((o) => o.distributorId === distributors[0].id);
  const dist0Fulfilled = dist0AllOrders.filter((o) => o.status === 'DELIVERED');
  const dist0Revenue = dist0Fulfilled.reduce((s, o) => s + o.totalAmount, 0);
  const dist0PaidSettlements = await db.settlement.findMany({
    where: { distributorId: distributors[0].id, status: 'PAID' },
  });
  const dist0TotalPayouts = dist0PaidSettlements.reduce((s, stl) => s + stl.distributorPayout, 0);
  const dist0PendingSettlements = await db.settlement.findMany({
    where: { distributorId: distributors[0].id, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  const dist0PendingPayout = dist0PendingSettlements.reduce((s, stl) => s + stl.distributorPayout, 0);

  await db.distributor.update({
    where: { id: distributors[0].id },
    data: {
      totalOrdersFulfilled: dist0Fulfilled.length,
      totalRevenue: dist0Revenue,
      totalPayouts: dist0TotalPayouts,
      pendingPayoutAmount: dist0PendingPayout,
    },
  });

  // Distributor 1 stats
  const dist1AllOrders = allOrders.filter((o) => o.distributorId === distributors[1].id);
  const dist1Fulfilled = dist1AllOrders.filter((o) => o.status === 'DELIVERED');
  const dist1Revenue = dist1Fulfilled.reduce((s, o) => s + o.totalAmount, 0);
  const dist1PaidSettlements = await db.settlement.findMany({
    where: { distributorId: distributors[1].id, status: 'PAID' },
  });
  const dist1TotalPayouts = dist1PaidSettlements.reduce((s, stl) => s + stl.distributorPayout, 0);
  const dist1PendingSettlements = await db.settlement.findMany({
    where: { distributorId: distributors[1].id, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  const dist1PendingPayout = dist1PendingSettlements.reduce((s, stl) => s + stl.distributorPayout, 0);

  await db.distributor.update({
    where: { id: distributors[1].id },
    data: {
      totalOrdersFulfilled: dist1Fulfilled.length,
      totalRevenue: dist1Revenue,
      totalPayouts: dist1TotalPayouts,
      pendingPayoutAmount: dist1PendingPayout,
    },
  });

  // RECALCULATE SHOP CREDIT BALANCES
  for (const shop of shops) {
    const creditTx = await db.transaction.findMany({
      where: { shopId: shop.id, type: { in: ['CREDIT_USED', 'REPAYMENT', 'REFUND'] } },
      select: { amount: true },
    });
    const computed = creditTx.reduce((s, t) => s + t.amount, 0);
    await db.shop.update({ where: { id: shop.id }, data: { creditBalance: computed } });
  }

  const totalSettlements = await db.settlement.count();
  const totalInvMovements = await db.inventoryMovement.count();

  return {
    categories: categories.length,
    wards: wards.length,
    manufacturers: manufacturers.length,
    distributors: distributors.length,
    users: 1 + 1 + 2 + 1 + 1 + shopUsers.length, // +1 for second distributor user
    shops: shops.length,
    products: products.length,
    promotions: promotions.length,
    groupDeals: groupDeals.length,
    orders: orderEntities.length + newOrderEntities.length,
    shipments: shipmentEntities.length,
    settlements: totalSettlements,
    inventoryMovements: totalInvMovements,
  };
}