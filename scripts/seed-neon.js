// Direct seed into Neon PostgreSQL using neon() driver + raw SQL
// Bypasses Prisma entirely — used when Prisma CLI times out
const { neon } = require('@neondatabase/serverless');

const cs = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(cs);

// Hash password using Node's scrypt (same as auth.ts)
const crypto = require('crypto');
async function hashPwd(pwd) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(pwd, 'aladin-salt', 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(derivedKey.toString('hex'));
    });
  });
}

const days = (n) => n * 24 * 60 * 60 * 1000;
const now = Date.now();
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
let orderSeq = 0;
const nextOrderNum = () => { orderSeq++; return `ALD-${dateStr}-${String(orderSeq).padStart(3, '0')}`; };

const cuid = () => {
  // Simple CUID-like ID generator
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${random}`;
};

async function run(q) { return sql`${q}`; }

// Helper to run parameterized INSERT
async function insert(table, cols, vals) {
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const colStr = cols.map(c => `"${c}"`).join(', ');
  const stmt = `INSERT INTO "${table}" (${colStr}) VALUES (${placeholders})`;
  // Use Pool for parameterized queries
  return pool.query(stmt, vals);
}

const { Pool } = require('@neondatabase/serverless');
const pool = new Pool({ connectionString: cs });

async function main() {
  console.log('Seeding ALADIN Neon PostgreSQL...');
  const pwHash = await hashPwd('aladin123');
  console.log('Password hashed');

  // 1. Categories
  const cats = [
    { id: cuid(), name: 'Gạo', nameEn: 'Rice', slug: 'gao', icon: '🌾', order: 1 },
    { id: cuid(), name: 'Dầu ăn', nameEn: 'Cooking Oil', slug: 'dau-an', icon: '🫒', order: 2 },
    { id: cuid(), name: 'Mì ăn liền', nameEn: 'Instant Noodles', slug: 'mi-an-lien', icon: '🍜', order: 3 },
    { id: cuid(), name: 'Nước giải khát', nameEn: 'Beverages', slug: 'nuoc-giai-khat', icon: '🥤', order: 4 },
    { id: cuid(), name: 'Gia vị & Thực phẩm khô', nameEn: 'Condiments & Dry Food', slug: 'gia-vi', icon: '🧂', order: 5 },
    { id: cuid(), name: 'Đồ uống có cồn', nameEn: 'Alcoholic Beverages', slug: 'do-uong-co-con', icon: '🍺', order: 6 },
  ];
  for (const c of cats) {
    await pool.query(`INSERT INTO "Category" (id, name, "nameEn", slug, icon, "sortOrder") VALUES ($1,$2,$3,$4,$5,$6)`, [c.id, c.name, c.nameEn, c.slug, c.icon, c.order]);
  }
  console.log(`  ✓ Categories: ${cats.length}`);

  // 2. Wards
  const wards = [
    { id: cuid(), name: 'Phú Mỹ Ward', nameEn: 'Phu My Ward', district: 'Thủ Dầu Một', province: 'Bình Dương' },
    { id: cuid(), name: 'Chánh Nghĩa Ward', nameEn: 'Chanh Nghia Ward', district: 'Thủ Dầu Một', province: 'Bình Dương' },
    { id: cuid(), name: 'Hiệp Thành Ward', nameEn: 'Hiep Thanh Ward', district: 'Thủ Dầu Một', province: 'Bình Dương' },
    { id: cuid(), name: 'Phú Thọ Ward', nameEn: 'Phu Tho Ward', district: 'Thủ Dầu Một', province: 'Bình Dương' },
    { id: cuid(), name: 'Định Hòa Ward', nameEn: 'Dinh Hoa Ward', district: 'Thủ Dầu Một', province: 'Bình Dương' },
    { id: cuid(), name: 'Tân Hiệp Ward', nameEn: 'Tan Hiep Ward', district: 'Dĩ An', province: 'Bình Dương' },
    { id: cuid(), name: 'Dĩ An Ward', nameEn: 'Di An Ward', district: 'Dĩ An', province: 'Bình Dương' },
    { id: cuid(), name: 'Bình An Ward', nameEn: 'Binh An Ward', district: 'Dĩ An', province: 'Bình Dương' },
  ];
  for (const w of wards) {
    await pool.query(`INSERT INTO "Ward" (id, name, "nameEn", district, province) VALUES ($1,$2,$3,$4,$5)`, [w.id, w.name, w.nameEn, w.district, w.province]);
  }
  console.log(`  ✓ Wards: ${wards.length}`);

  // 3. Manufacturers
  const mfrs = [
    { id: cuid(), name: 'Công ty Lương thực Bình Dương', nameEn: 'Binh Duong Food Corp', contactPerson: 'Nguyễn Văn An', contactPhone: '02812345678', email: 'sales@bdfood.vn', province: 'Bình Dương', rate: 0.15 },
    { id: cuid(), name: 'Masan Consumer', nameEn: 'Masan Consumer', contactPerson: 'Trần Thị Bích', contactPhone: '02898765432', email: 'trade@masan.com', province: 'TP.HCM', rate: 0.12 },
    { id: cuid(), name: 'Unilever Vietnam', nameEn: 'Unilever Vietnam', contactPerson: 'Lê Hoàng Nam', contactPhone: '02834567890', email: 'foodservice@unilever.vn', province: 'TP.HCM', rate: 0.18 },
  ];
  for (const m of mfrs) {
    await pool.query(`INSERT INTO "Manufacturer" (id, name, "nameEn", "contactPerson", "contactPhone", email, province, "commissionRate") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [m.id, m.name, m.nameEn, m.contactPerson, m.contactPhone, m.email, m.province, m.rate]);
  }
  console.log(`  ✓ Manufacturers: ${mfrs.length}`);

  // 4. Distributors
  const dists = [
    { id: cuid(), name: 'Kho Phân Phối Miền Nam', nameEn: 'South Distribution Warehouse', address: 'Số 12, Đại lộ Bình Dương', lat: 10.8802, lng: 106.7282, active: true },
    { id: cuid(), name: 'Kho Tổng TP.HCM', nameEn: 'HCMC Main Warehouse', address: 'Số 45, Nguyễn Thị Minh Khai, Q.1', lat: 10.7828, lng: 106.6957, active: true },
  ];
  for (const d of dists) {
    await pool.query(`INSERT INTO "Distributor" (id, name, "nameEn", address, lat, lng, "isActive") VALUES ($1,$2,$3,$4,$5,$6,$7)`, [d.id, d.name, d.nameEn, d.address, d.lat, d.lng, d.active]);
  }
  console.log(`  ✓ Distributors: ${dists.length}`);

  // 5. Users
  const users = [
    { id: cuid(), phone: '0901234567', email: 'admin@aladin.vn', name: 'Admin Aladin', role: 'ADMIN' },
    { id: cuid(), phone: '0901234600', email: 'hanhphuc@aladin.vn', name: 'Nguyễn Thị Hạnh Phúc', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234601', email: 'taman@aladin.vn', name: 'Trần Văn Tâm An', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234602', email: 'binhminh@aladin.vn', name: 'Lê Thị Bình Minh', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234603', email: 'phuoclong@aladin.vn', name: 'Phạm Văn Phước Long', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234604', email: 'locphat@aladin.vn', name: 'Hoàng Thị Lộc Phát', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234605', email: 'hoamai@aladin.vn', name: 'Vũ Văn Hoa Mai', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234606', email: 'phuongthao@aladin.vn', name: 'Ngô Thị Phương Thảo', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0901234607', email: 'thanhdat@aladin.vn', name: 'Đặng Văn Thành Đạt', role: 'SHOP_OWNER' },
    { id: cuid(), phone: '0911111111', email: 'sales@aladin.vn', name: 'Lý Minh Tuấn', role: 'SALES_REP' },
    { id: cuid(), phone: '0922222222', name: 'Trần Văn Tài', role: 'DRIVER' },
    { id: cuid(), phone: '0922333333', name: 'Nguyễn Văn Tèo', role: 'DRIVER' },
    { id: cuid(), phone: '0933333333', email: 'broker@aladin.vn', name: 'Phạm Thị Mai', role: 'BROKER' },
  ];
  for (const u of users) {
    await pool.query(`INSERT INTO "User" (id, phone, email, "passwordHash", name, role, status) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE')`, [u.id, u.phone, u.email || null, pwHash, u.name, u.role]);
  }
  console.log(`  ✓ Users: ${users.length}`);

  // 6. Shops
  const shopData = [
    { userId: 1, name: 'Tạp Hóa Hạnh Phúc', wardId: 0, district: 'Thủ Dầu Một', address: '12 Nguyễn Văn Cừ', tier: 'GOLD', creditLimit: 5000000, status: 'ACTIVE' },
    { userId: 2, name: 'Tạp Hóa Tâm An', wardId: 1, district: 'Thủ Dầu Một', address: '45/3 Trần Hưng Đạo', tier: 'PLATINUM', creditLimit: 10000000, status: 'ACTIVE' },
    { userId: 3, name: 'Tạp Hóa Bình Minh', wardId: 2, district: 'Thủ Dầu Một', address: '78B Phổ Quang', tier: 'SILVER', creditLimit: 3000000, status: 'ACTIVE' },
    { userId: 4, name: 'Tạp Hóa Phước Long', wardId: 3, district: 'Thủ Dầu Một', address: '23 Yersin', tier: 'PLATINUM', creditLimit: 8000000, status: 'LOCKED' },
    { userId: 5, name: 'Tạp Hóa Lộc Phát', wardId: 4, district: 'Thủ Dầu Một', address: '156 Lê Lợi', tier: 'BRONZE', creditLimit: 1500000, status: 'OVERDUE' },
    { userId: 6, name: 'Tạp Hóa Hoa Mai', wardId: 5, district: 'Dĩ An', address: '9/2A Trần Đại Nghĩa', tier: 'GOLD', creditLimit: 5000000, status: 'ACTIVE' },
    { userId: 7, name: 'Tạp Hóa Phương Thảo', wardId: 6, district: 'Dĩ An', address: '67 Thạch Ban', tier: 'SILVER', creditLimit: 3000000, status: 'ACTIVE' },
    { userId: 8, name: 'Tạp Hóa Thành Đạt', wardId: 7, district: 'Dĩ An', address: '101 Phạm Ngũ Lão', tier: 'GOLD', creditLimit: 5000000, status: 'ACTIVE' },
  ];
  const shopIds = [];
  for (const s of shopData) {
    const id = cuid();
    shopIds.push(id);
    await pool.query(`INSERT INTO "Shop" (id, "userId", name, "wardId", district, address, "loyaltyTier", "creditLimit", "creditStatus", "totalOrders", "totalGmv", "avgOrderValue") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [id, users[s.userId].id, s.name, wards[s.wardId].id, s.district, s.address, s.tier, s.creditLimit, s.status, Math.floor(Math.random()*20)+5, Math.floor(Math.random()*50000000)+10000000, Math.floor(Math.random()*3000000)+500000]);
  }
  console.log(`  ✓ Shops: ${shopIds.length}`);

  // 7. Products (25 products across 6 categories)
  const products = [
    { name: 'Gạo ST25 5kg', nameEn: 'ST25 Rice 5kg', sku: 'GAO-ST25-5', cat: 0, price: 125000, gbPrice: 118000, stock: 500, brand: 'Bình Dương Food', mfr: 0, dist: 0 },
    { name: 'Gạo thơm Jasmine 10kg', nameEn: 'Jasmine Rice 10kg', sku: 'GAO-JAS-10', cat: 0, price: 230000, gbPrice: null, stock: 200, brand: 'Bình Dương Food', mfr: 0, dist: 0 },
    { name: 'Dầu ăn Tường An 1L', nameEn: 'Tuong An Cooking Oil 1L', sku: 'DA-TA-1L', cat: 1, price: 42000, gbPrice: 38000, stock: 1000, brand: 'Tường An', mfr: 1, dist: 0 },
    { name: 'Dầu ăn Neptune 2L', nameEn: 'Neptune Cooking Oil 2L', sku: 'DA-NEP-2L', cat: 1, price: 78000, gbPrice: null, stock: 500, brand: 'Neptune', mfr: 1, dist: 0 },
    { name: 'Mì Hảo Hảo ly', nameEn: 'Hao Hao Instant Noodle Cup', sku: 'MI-HH-LY', cat: 2, price: 8000, gbPrice: 7000, stock: 3000, brand: 'Acecook', mfr: 1, dist: 0 },
    { name: 'Mì Hảo Hảo bao 5 gói', nameEn: 'Hao Hao Noodle 5-pack', sku: 'MI-HH-5', cat: 2, price: 35000, gbPrice: 32000, stock: 2000, brand: 'Acecook', mfr: 1, dist: 0 },
    { name: 'Coca-Cola lon 330ml', nameEn: 'Coca-Cola Can 330ml', sku: 'NCC-CC-330', cat: 3, price: 12000, gbPrice: 10500, stock: 5000, brand: 'Coca-Cola', mfr: 2, dist: 1 },
    { name: 'Pepsi lon 330ml', nameEn: 'Pepsi Can 330ml', sku: 'NCC-PEP-330', cat: 3, price: 11000, gbPrice: null, stock: 4000, brand: 'PepsiCo', mfr: 2, dist: 1 },
    { name: 'Nước suối Lavie 500ml', nameEn: 'Lavie Water 500ml', sku: 'NCC-LV-500', cat: 3, price: 5000, gbPrice: 4200, stock: 8000, brand: 'Nestlé', mfr: 2, dist: 1 },
    { name: 'Bia Saigon Special 500ml', nameEn: 'Saigon Special Beer 500ml', sku: 'BIA-SG-500', cat: 5, price: 15000, gbPrice: null, stock: 2000, brand: 'Sabeco', mfr: 0, dist: 0 },
    { name: 'Nước mắm Nam Ngư 500ml', nameEn: 'Nam Ngu Fish Sauce 500ml', sku: 'GV-NN-500', cat: 4, price: 32000, gbPrice: 28000, stock: 1500, brand: 'Nam Ngư', mfr: 1, dist: 0 },
    { name: 'Đường tinh luyện 1kg', nameEn: 'Refined Sugar 1kg', sku: 'GV-DUONG-1', cat: 4, price: 25000, gbPrice: null, stock: 2000, brand: 'Tài Khoản', mfr: 0, dist: 0 },
    { name: 'Hạt nêm Knorr 400g', nameEn: 'Knorr Seasoning 400g', sku: 'GV-KN-400', cat: 4, price: 28000, gbPrice: 24000, stock: 1800, brand: 'Knorr', mfr: 2, dist: 1 },
    { name: 'Gạo Nhật Bản 5kg', nameEn: 'Japanese Rice 5kg', sku: 'GAO-JP-5', cat: 0, price: 280000, gbPrice: 260000, stock: 100, brand: 'Bình Dương Food', mfr: 0, dist: 0 },
    { name: 'Mì Omachi hải sản', nameEn: 'Omachi Seafood Noodle', sku: 'MI-OM-HS', cat: 2, price: 9000, gbPrice: null, stock: 2500, brand: 'Acecook', mfr: 1, dist: 0 },
    { name: 'Sprite lon 330ml', nameEn: 'Sprite Can 330ml', sku: 'NCC-SP-330', cat: 3, price: 12000, gbPrice: 10800, stock: 3000, brand: 'Coca-Cola', mfr: 2, dist: 1 },
    { name: 'Trà xanh Không Độ 500ml', nameEn: 'Zero Degree Green Tea 500ml', sku: 'NCC-TX-500', cat: 3, price: 10000, gbPrice: 8500, stock: 4000, brand: 'Unilever', mfr: 2, dist: 1 },
    { name: 'Muối i-ốt 500g', nameEn: 'Iodized Salt 500g', sku: 'GV-MUOI-500', cat: 4, price: 12000, gbPrice: null, stock: 3000, brand: 'Bình Minh', mfr: 0, dist: 0 },
    { name: 'Bia Heineken 330ml', nameEn: 'Heineken Beer 330ml', sku: 'BIA-HK-330', cat: 5, price: 25000, gbPrice: null, stock: 1500, brand: 'Heineken', mfr: 0, dist: 0 },
    { name: 'Dầu hào Chinsu 500ml', nameEn: 'Chinsu Oyster Sauce 500ml', sku: 'GV-CS-500', cat: 4, price: 35000, gbPrice: 31000, stock: 1200, brand: 'Masan', mfr: 1, dist: 0 },
    { name: 'Mì Ly Cay_Kim 5 gói', nameEn: 'CayKim Noodle Cup 5pk', sku: 'MI-CK-5', cat: 2, price: 38000, gbPrice: 35000, stock: 1500, brand: 'CayKim', mfr: 0, dist: 0 },
    { name: 'Gạo thơm sứ Việt 25kg', nameEn: 'Viet Fragrant Rice 25kg', sku: 'GAO-VS-25', cat: 0, price: 550000, gbPrice: 520000, stock: 50, brand: 'Bình Dương Food', mfr: 0, dist: 0 },
    { name: 'Nước tăng lực Number 1', nameEn: 'Number 1 Energy Drink', sku: 'NCC-N1-250', cat: 3, price: 10000, gbPrice: 8500, stock: 5000, brand: 'Tân Hiệp Phát', mfr: 0, dist: 0 },
    { name: 'Tương ớt Cholimex 250ml', nameEn: 'Cholimex Chili Sauce 250ml', sku: 'GV-CL-250', cat: 4, price: 18000, gbPrice: null, stock: 1000, brand: 'Cholimex', mfr: 0, dist: 0 },
    { name: 'Bia 333 500ml', nameEn: '333 Beer 500ml', sku: 'BIA-333-500', cat: 5, price: 14000, gbPrice: null, stock: 3000, brand: 'Sabeco', mfr: 0, dist: 0 },
  ];
  const productIds = [];
  for (const p of products) {
    const id = cuid();
    productIds.push(id);
    await pool.query(`INSERT INTO "Product" (id, sku, name, "nameEn", "categoryId", brand, "basePrice", "groupBuyPrice", "stockQuantity", "unit", "manufacturerId", "distributorId", "isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)`, [id, p.sku, p.name, p.nameEn, cats[p.cat].id, p.brand, p.price, p.gbPrice, p.stock, 'cai', mfrs[p.mfr].id, dists[p.dist].id]);
  }
  console.log(`  ✓ Products: ${products.length}`);

  // 8. Promotions (3)
  const promos = [
    { title: 'Mua 10 Hảo Hảo tặng 1', titleEn: 'Buy 10 Hao Hao Get 1 Free', mfrId: 1, type: 'BUY_X_GET_Y', buy: 10, get: 1, budget: 5000000 },
    { title: 'Giảm 15% Gạo ST25', titleEn: '15% Off ST25 Rice', mfrId: 0, type: 'PERCENT_OFF', pct: 15, budget: 10000000 },
    { title: 'Giảm 5.000đ Coca-Cola', titleEn: '5k Off Coca-Cola', mfrId: 2, type: 'FIXED_DISCOUNT', amount: 5000, budget: 3000000 },
  ];
  const promoIds = [];
  for (const pr of promos) {
    const id = cuid();
    promoIds.push(id);
    const start = new Date(now - days(7)).toISOString();
    const end = new Date(now + days(30)).toISOString();
    await pool.query(`INSERT INTO "Promotion" (id, "manufacturerId", title, "titleEn", "promoType", "buyQty", "getQty", "discountPercent", "discountAmount", "startsAt", "expiresAt", "totalBudget", "isActive") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)`, [id, mfrs[pr.mfrId].id, pr.title, pr.titleEn, pr.type, pr.buy || null, pr.get || null, pr.pct || null, pr.amount || null, start, end, pr.budget]);
  }
  console.log(`  ✓ Promotions: ${promos.length}`);

  // 9. Group Deals (3)
  const deals = [
    { title: 'Group Buy Gạo ST25 Phường Phú Mỹ', prodId: 0, target: 200, current: 156, orig: 125000, disc: 118000, wardId: 0 },
    { title: 'Group Buy Hảo Hảo Dĩ An', prodId: 4, target: 500, current: 423, orig: 8000, disc: 7000, wardId: 5 },
    { title: 'Group Buy Coca-Cola TDM', prodId: 6, target: 1000, current: 887, orig: 12000, disc: 10500, wardId: 1 },
  ];
  const dealIds = [];
  for (const d of deals) {
    const id = cuid();
    dealIds.push(id);
    const start = new Date(now - days(3)).toISOString();
    const end = new Date(now + days(14)).toISOString();
    await pool.query(`INSERT INTO "GroupDeal" (id, title, "productId", "targetQty", "currentQty", "originalPrice", "discountPrice", "wardId", "startsAt", "expiresAt", status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE')`, [id, d.title, productIds[d.prodId], d.target, d.current, d.orig, d.disc, wards[d.wardId].id, start, end]);
  }
  console.log(`  ✓ Group Deals: ${deals.length}`);

  // 10. Orders (15)
  const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'CANCELLED', 'DELIVERED'];
  const paymentMethods = ['COD', 'CREDIT', 'DIGITAL'];
  
  for (let i = 0; i < 15; i++) {
    const orderId = cuid();
    const orderNum = nextOrderNum();
    const shopIdx = i % shopIds.length;
    const status = statuses[i];
    const pmtMethod = paymentMethods[i % 3];
    const itemCount = Math.floor(Math.random() * 4) + 2;
    const subtotal = Math.floor(Math.random() * 500000) + 100000;
    const total = subtotal;
    
    const createdAt = new Date(now - days(15 - i));
    const snapshot = JSON.stringify({ shopId: shopIds[shopIdx], shopName: shopData[shopIdx].name });
    
    await pool.query(`INSERT INTO "Order" (id, "orderNumber", "shopId", "shopSnapshot", status, "paymentMethod", "paymentStatus", "subtotalAmount", "totalAmount", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [orderId, orderNum, shopIds[shopIdx], snapshot, status, pmtMethod, status === 'DELIVERED' ? 'PAID' : 'PENDING', subtotal, total, createdAt.toISOString(), createdAt.toISOString()]);
    
    // Order items
    for (let j = 0; j < itemCount; j++) {
      const pIdx = Math.floor(Math.random() * products.length);
      const qty = Math.floor(Math.random() * 10) + 1;
      const unitPrice = products[pIdx].price;
      await pool.query(`INSERT INTO "OrderItem" (id, "orderId", "productId", "productName", "productSku", "unitPrice", quantity, "totalPrice", "createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [cuid(), orderId, productIds[pIdx], products[pIdx].name, products[pIdx].sku, unitPrice, qty, unitPrice * qty, createdAt.toISOString()]);
    }
  }
  console.log(`  ✓ Orders: 15`);

  // 11. Shipments (6)
  for (let i = 0; i < 6; i++) {
    const shipId = cuid();
    const status = i < 4 ? 'DELIVERED' : i < 5 ? 'IN_TRANSIT' : 'PENDING';
    await pool.query(`INSERT INTO "Shipment" (id, "orderId", type, status, "assignedDriverId", "pickupAddress", "dropoffAddress", "createdAt", "updatedAt") VALUES ($1,$2,'INTERNAL',$3,$4,$5,$6,$7,$8)`, [shipId, null, status, i < 4 ? users[10].id : users[11].id, 'Kho Phân Phối Miền Nam, Số 12, Đại lộ Bình Dương', 'TBD', new Date(now - days(5 - i)).toISOString(), new Date(now - days(3 - i)).toISOString()]);
  }
  console.log(`  ✓ Shipments: 6`);

  // 12. Broker
  await pool.query(`INSERT INTO "Broker" (id, "userId", tier, "commissionRate") VALUES ($1,$2,'WARD_LEVEL',0.03)`, [cuid(), users[12].id]);
  console.log(`  ✓ Broker: 1`);

  await pool.end();
  console.log('\n🎉 ALL DATA SEEDED IN NEON POSTGRESQL!');
  console.log('Login: 0901234567 / aladin123');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });