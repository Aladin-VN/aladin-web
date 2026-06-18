// ONE-SHOT: Create schema + Seed Neon PostgreSQL
const { Pool } = require('@neondatabase/serverless');
const cs = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: cs });
const crypto = require('crypto');
const Q = (q) => pool.query(q);

async function hashPwd(pwd) {
  return new Promise((res, rej) => crypto.scrypt(pwd, 'aladin-salt', 64, (e, dk) => e ? rej(e) : res(dk.toString('hex'))));
}
const id = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
const days = (n) => n * 86400000;
const now = Date.now();
const iso = (d) => new Date(d).toISOString();
let oSeq = 0;
const orderNum = () => { oSeq++; return `ALD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(oSeq).padStart(3,'0')}`; };

async function schema() {
  const T = [
    `CREATE TABLE "Category" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "slug" TEXT NOT NULL UNIQUE, "icon" TEXT, "sortOrder" INT DEFAULT 0, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Ward" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "district" TEXT NOT NULL, "province" TEXT DEFAULT 'Binh Duong', "shopCount" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Manufacturer" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT, "province" TEXT, "commissionRate" FLOAT8 DEFAULT 0.15, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Distributor" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT, "lat" FLOAT8, "lng" FLOAT8, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "phone" TEXT NOT NULL UNIQUE, "email" TEXT UNIQUE, "passwordHash" TEXT, "name" TEXT NOT NULL, "nameEn" TEXT, "avatarUrl" TEXT, "role" TEXT DEFAULT 'SHOP_OWNER', "status" TEXT DEFAULT 'ACTIVE', "zaloId" TEXT UNIQUE, "lastLoginAt" TIMESTAMPTZ, "mustChangePwd" BOOL DEFAULT false, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE "Shop" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE, "name" TEXT NOT NULL, "nameEn" TEXT, "wardId" TEXT REFERENCES "Ward"("id") ON DELETE SET NULL, "district" TEXT, "province" TEXT DEFAULT 'Binh Duong', "address" TEXT, "lat" FLOAT8, "lng" FLOAT8, "shopType" TEXT DEFAULT 'TAPHOA', "loyaltyTier" TEXT DEFAULT 'BRONZE', "creditLimit" INT DEFAULT 1000000, "creditBalance" INT DEFAULT 0, "creditStatus" TEXT DEFAULT 'ACTIVE', "totalOrders" INT DEFAULT 0, "totalGmv" INT DEFAULT 0, "avgOrderValue" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "sku" TEXT NOT NULL UNIQUE, "name" TEXT NOT NULL, "nameEn" TEXT, "description" TEXT, "descriptionEn" TEXT, "categoryId" TEXT NOT NULL REFERENCES "Category"("id") ON DELETE RESTRICT, "brand" TEXT, "unit" TEXT DEFAULT 'cai', "unitEn" TEXT, "basePrice" INT NOT NULL, "groupBuyPrice" INT, "stockQuantity" INT DEFAULT 0, "minOrderQty" INT DEFAULT 1, "maxOrderQty" INT, "weightKg" FLOAT8, "imageUrl" TEXT, "isActive" BOOL DEFAULT true, "isPrivateLabel" BOOL DEFAULT false, "barcode" TEXT UNIQUE, "manufacturerId" TEXT REFERENCES "Manufacturer"("id") ON DELETE SET NULL, "distributorId" TEXT REFERENCES "Distributor"("id") ON DELETE SET NULL, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE "GroupDeal" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT, "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT, "targetQty" INT NOT NULL, "currentQty" INT DEFAULT 0, "originalPrice" INT NOT NULL, "discountPrice" INT NOT NULL, "maxParticipants" INT, "startsAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "wardId" TEXT REFERENCES "Ward"("id") ON DELETE SET NULL, "status" TEXT DEFAULT 'ACTIVE', "bulkOrderId" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "orderNumber" TEXT NOT NULL UNIQUE, "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE RESTRICT, "shopSnapshot" TEXT NOT NULL, "status" TEXT DEFAULT 'PENDING', "paymentMethod" TEXT DEFAULT 'COD', "paymentStatus" TEXT DEFAULT 'PENDING', "subtotalAmount" INT NOT NULL, "discountAmount" INT DEFAULT 0, "deliveryFee" INT DEFAULT 0, "totalAmount" INT NOT NULL, "paidAmount" INT DEFAULT 0, "creditUsed" INT DEFAULT 0, "groupDealId" TEXT REFERENCES "GroupDeal"("id") ON DELETE SET NULL, "distributorId" TEXT, "assignedDriverId" TEXT REFERENCES "User"("id") ON DELETE SET NULL, "thirdPartyOrderId" TEXT, "customerNotes" TEXT, "adminNotes" TEXT, "idempotencyKey" TEXT UNIQUE, "confirmedAt" TIMESTAMPTZ, "packedAt" TIMESTAMPTZ, "deliveredAt" TIMESTAMPTZ, "cancelledAt" TIMESTAMPTZ, "cancelReason" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE, "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT, "productName" TEXT NOT NULL, "productSku" TEXT NOT NULL, "unitPrice" INT NOT NULL, "quantity" INT NOT NULL, "totalPrice" INT NOT NULL, "promotionId" TEXT REFERENCES "Promotion"("id") ON DELETE SET NULL, "freeQty" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Transaction" ("id" TEXT PRIMARY KEY, "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE RESTRICT, "orderId" TEXT REFERENCES "Order"("id") ON DELETE SET NULL, "type" TEXT NOT NULL, "amount" INT NOT NULL, "runningBalance" INT NOT NULL, "paymentMethod" TEXT, "paymentRef" TEXT, "collectedBy" TEXT, "description" TEXT, "metadata" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "GroupDealParticipant" ("id" TEXT PRIMARY KEY, "groupDealId" TEXT NOT NULL REFERENCES "GroupDeal"("id") ON DELETE CASCADE, "shopId" TEXT NOT NULL REFERENCES "Shop"("id") ON DELETE CASCADE, "committedQty" INT NOT NULL, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), CONSTRAINT "gdp_uniq" UNIQUE ("groupDealId", "shopId"))`,
    `CREATE TABLE "Shipment" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL UNIQUE REFERENCES "Order"("id") ON DELETE CASCADE, "type" TEXT DEFAULT 'INTERNAL', "status" TEXT DEFAULT 'PENDING', "assignedDriverId" TEXT REFERENCES "User"("id") ON DELETE SET NULL, "pickupAddress" TEXT, "pickupLat" FLOAT8, "pickupLng" FLOAT8, "dropoffAddress" TEXT NOT NULL, "dropoffLat" FLOAT8, "dropoffLng" FLOAT8, "deliveredAt" TIMESTAMPTZ, "podPhotoUrl" TEXT, "podSignatureUrl" TEXT, "podOtp" TEXT, "thirdPartyTrackingId" TEXT, "thirdPartyStatus" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Promotion" ("id" TEXT PRIMARY KEY, "manufacturerId" TEXT NOT NULL REFERENCES "Manufacturer"("id") ON DELETE RESTRICT, "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT, "promoType" TEXT NOT NULL, "buyQty" INT, "getQty" INT, "discountPercent" FLOAT8, "discountAmount" INT, "startsAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "totalBudget" INT, "usedBudget" INT DEFAULT 0, "totalRedemptions" INT DEFAULT 0, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "PromotionItem" ("id" TEXT PRIMARY KEY, "promotionId" TEXT NOT NULL REFERENCES "Promotion"("id") ON DELETE CASCADE, "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE, "createdAt" TIMESTAMPTZ DEFAULT now(), CONSTRAINT "pi_uniq" UNIQUE ("promotionId", "productId"))`,
    `CREATE TABLE "MerchandisingAudit" ("id" TEXT PRIMARY KEY, "shopId" TEXT NOT NULL, "productId" TEXT, "promotionId" TEXT REFERENCES "Promotion"("id") ON DELETE SET NULL, "photoUrl" TEXT NOT NULL, "status" TEXT DEFAULT 'PENDING_REVIEW', "reviewerId" TEXT, "reviewNotes" TEXT, "reviewedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Broker" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE, "tier" TEXT DEFAULT 'WARD_LEVEL', "wardId" TEXT REFERENCES "Ward"("id") ON DELETE SET NULL, "commissionRate" FLOAT8 DEFAULT 0.03, "totalShopsReferred" INT DEFAULT 0, "totalCommissionEarned" INT DEFAULT 0, "totalGmvGenerated" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Payment" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE, "gateway" TEXT NOT NULL, "gatewayTxId" TEXT UNIQUE, "amount" INT NOT NULL, "status" TEXT DEFAULT 'PENDING', "paymentUrl" TEXT, "qrCodeUrl" TEXT, "rawRequest" TEXT, "rawCallback" TEXT, "paidAt" TIMESTAMPTZ, "expiresAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL, "entityId" TEXT, "details" TEXT, "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "PlatformSetting" ("id" TEXT PRIMARY KEY, "key" TEXT NOT NULL UNIQUE, "value" TEXT NOT NULL, "description" TEXT, "category" TEXT DEFAULT 'general', "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "ChatMessage" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "direction" TEXT DEFAULT 'OUTGOING', "messageType" TEXT DEFAULT 'TEXT', "content" TEXT NOT NULL, "imageUrl" TEXT, "metadata" TEXT, "isRead" BOOL DEFAULT false, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "_prisma_migrations" (id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ DEFAULT now(), applied_steps_count INT DEFAULT 0)`,
  ];
  let ok = 0;
  for (const t of T) { try { await Q(t); ok++; } catch(e) { console.error('ERR:', e.message?.substring(0,100)); } }
  console.log(`Schema: ${ok}/${T.length} tables`);
}

async function seed() {
  const pw = await hashPwd('aladin123');

  // Categories
  const cIds = [];
  for (const c of ['Gạo|gao|🌾','Dầu ăn|dau-an|🫒','Mì ăn liền|mi-an-lien|🍜','Nước giải khát|nuoc-giai-khat|🥤','Gia vị & Thực phẩm khô|gia-vi|🧂','Đồ uống có cồn|do-uong-co-con|🍺']) {
    const [name,slug,icon] = c.split('|');
    const cid = id(); cIds.push(cid);
    await Q(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('${cid}','${name}','${slug}','${icon}',${cIds.length})`);
  }
  console.log(`  Categories: ${cIds.length}`);

  // Wards
  const wIds = [];
  for (const w of ['Phú Mỹ|Thủ Dầu Một','Chánh Nghĩa|Thủ Dầu Một','Hiệp Thành|Thủ Dầu Một','Phú Thọ|Thủ Dầu Một','Định Hòa|Thủ Dầu Một','Tân Hiệp|Dĩ An','Dĩ An|Dĩ An','Bình An|Dĩ An']) {
    const [name,dist] = w.split('|');
    const wid = id(); wIds.push(wid);
    await Q(`INSERT INTO "Ward" (id,name,district) VALUES ('${wid}','${name}','${dist}')`);
  }
  console.log(`  Wards: ${wIds.length}`);

  // Manufacturers
  const mIds = [];
  for (const m of ['Công ty Lương thực Bình Dương|sales@bdfood.vn|Bình Dương','Masan Consumer|trade@masan.com|TP.HCM','Unilever Vietnam|foodservice@unilever.vn|TP.HCM']) {
    const [name,email,prov] = m.split('|');
    const mid = id(); mIds.push(mid);
    await Q(`INSERT INTO "Manufacturer" (id,name,email,province,"commissionRate") VALUES ('${mid}','${name}','${email}','${prov}',0.15)`);
  }
  console.log(`  Manufacturers: ${mIds.length}`);

  // Distributors
  const dIds = [];
  for (const d of ['Kho Phân Phối Miền Nam|12 Đại lộ Bình Dương|10.8802|106.7282','Kho Tổng TP.HCM|45 Nguyễn Thị Minh Khai Q.1|10.7828|106.6957']) {
    const [name,addr,lat,lng] = d.split('|');
    const did = id(); dIds.push(did);
    await Q(`INSERT INTO "Distributor" (id,name,address,lat,lng) VALUES ('${did}','${name}','${addr}',${lat},${lng})`);
  }
  console.log(`  Distributors: ${dIds.length}`);

  // Users
  const uIds = [];
  const uData = [
    ['0901234567','admin@aladin.vn','Admin Aladin','ADMIN'],
    ['0901234600','hanhphuc@aladin.vn','Nguyễn Thị Hạnh Phúc','SHOP_OWNER'],
    ['0901234601','taman@aladin.vn','Trần Văn Tâm An','SHOP_OWNER'],
    ['0901234602','binhminh@aladin.vn','Lê Thị Bình Minh','SHOP_OWNER'],
    ['0901234603','phuoclong@aladin.vn','Phạm Văn Phước Long','SHOP_OWNER'],
    ['0901234604','locphat@aladin.vn','Hoàng Thị Lộc Phát','SHOP_OWNER'],
    ['0901234605','hoamai@aladin.vn','Vũ Văn Hoa Mai','SHOP_OWNER'],
    ['0901234606','phuongthao@aladin.vn','Ngô Thị Phương Thảo','SHOP_OWNER'],
    ['0901234607','thanhdat@aladin.vn','Đặng Văn Thành Đạt','SHOP_OWNER'],
    ['0911111111','sales@aladin.vn','Lý Minh Tuấn','SALES_REP'],
    ['0922222222',null,'Trần Văn Tài','DRIVER'],
    ['0922333333',null,'Nguyễn Văn Tèo','DRIVER'],
    ['0933333333','broker@aladin.vn','Phạm Thị Mai','BROKER'],
  ];
  for (const [phone,email,name,role] of uData) {
    const uid = id(); uIds.push(uid);
    await Q(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('${uid}','${phone}',${email ? "'"+email+"'" : 'NULL'},'${pw}','${name}','${role}')`);
  }
  console.log(`  Users: ${uIds.length}`);

  // Shops
  const sData = [
    ['Tạp Hóa Hạnh Phúc',0,'12 Nguyễn Văn Cừ','Thủ Dầu Một','GOLD',5000000,'ACTIVE'],
    ['Tạp Hóa Tâm An',1,'45/3 Trần Hưng Đạo','Thủ Dầu Một','PLATINUM',10000000,'ACTIVE'],
    ['Tạp Hóa Bình Minh',2,'78B Phổ Quang','Thủ Dầu Một','SILVER',3000000,'ACTIVE'],
    ['Tạp Hóa Phước Long',3,'23 Yersin','Thủ Dầu Một','PLATINUM',8000000,'LOCKED'],
    ['Tạp Hóa Lộc Phát',4,'156 Lê Lợi','Thủ Dầu Một','BRONZE',1500000,'OVERDUE'],
    ['Tạp Hóa Hoa Mai',5,'9/2A Trần Đại Nghĩa','Dĩ An','GOLD',5000000,'ACTIVE'],
    ['Tạp Hóa Phương Thảo',6,'67 Thạch Ban','Dĩ An','SILVER',3000000,'ACTIVE'],
    ['Tạp Hóa Thành Đạt',7,'101 Phạm Ngũ Lão','Dĩ An','GOLD',5000000,'ACTIVE'],
  ];
  const sIds = [];
  for (const [name,wIdx,addr,dist,tier,climit,cstatus] of sData) {
    const sid = id(); sIds.push(sid);
    const gmv = Math.floor(Math.random()*50000000)+10000000;
    const aov = Math.floor(gmv/(Math.floor(Math.random()*20)+5));
    await Q(`INSERT INTO "Shop" (id,"userId",name,"wardId",district,address,"loyaltyTier","creditLimit","creditStatus","totalOrders","totalGmv","avgOrderValue") VALUES ('${sid}','${uIds[wIdx+1]}','${name}','${wIds[wIdx]}','${dist}','${addr}','${tier}',${climit},'${cstatus}',${Math.floor(Math.random()*20)+5},${gmv},${aov})`);
  }
  console.log(`  Shops: ${sIds.length}`);

  // Products
  const pIds = [];
  const prods = [
    ['Gạo ST25 5kg','ST25 Rice 5kg','GAO-ST25-5',0,125000,118000,500,'Bình Dương Food',0,0],
    ['Gạo thơm Jasmine 10kg','Jasmine Rice 10kg','GAO-JAS-10',0,230000,null,200,'Bình Dương Food',0,0],
    ['Dầu ăn Tường An 1L','Tuong An Oil 1L','DA-TA-1L',1,42000,38000,1000,'Tường An',1,0],
    ['Dầu ăn Neptune 2L','Neptune Oil 2L','DA-NEP-2L',1,78000,null,500,'Neptune',1,0],
    ['Mì Hảo Hảo ly','Hao Hao Cup','MI-HH-LY',2,8000,7000,3000,'Acecook',1,0],
    ['Mì Hảo Hảo bao 5','Hao Hao 5pk','MI-HH-5',2,35000,32000,2000,'Acecook',1,0],
    ['Coca-Cola 330ml','Coca-Cola Can','NCC-CC-330',3,12000,10500,5000,'Coca-Cola',2,1],
    ['Pepsi 330ml','Pepsi Can','NCC-PEP-330',3,11000,null,4000,'PepsiCo',2,1],
    ['Nước suối Lavie 500ml','Lavie 500ml','NCC-LV-500',3,5000,4200,8000,'Nestlé',2,1],
    ['Bia Saigon Special 500ml','SG Special 500ml','BIA-SG-500',5,15000,null,2000,'Sabeco',0,0],
    ['Nước mắm Nam Ngư 500ml','Nam Ngu 500ml','GV-NN-500',4,32000,28000,1500,'Nam Ngư',1,0],
    ['Đường tinh luyện 1kg','Sugar 1kg','GV-DUONG-1',4,25000,null,2000,'Tài Khoản',0,0],
    ['Hạt nêm Knorr 400g','Knorr 400g','GV-KN-400',4,28000,24000,1800,'Knorr',2,1],
    ['Gạo Nhật 5kg','JP Rice 5kg','GAO-JP-5',0,280000,260000,100,'Bình Dương Food',0,0],
    ['Mì Omachi hải sản','Omachi Seafood','MI-OM-HS',2,9000,null,2500,'Acecook',1,0],
    ['Sprite 330ml','Sprite Can','NCC-SP-330',3,12000,10800,3000,'Coca-Cola',2,1],
    ['Trà xanh Không Độ 500ml','Zero Degree Tea','NCC-TX-500',3,10000,8500,4000,'Unilever',2,1],
    ['Muối i-ốt 500g','Iodized Salt','GV-MUOI-500',4,12000,null,3000,'Bình Minh',0,0],
    ['Bia Heineken 330ml','Heineken 330ml','BIA-HK-330',5,25000,null,1500,'Heineken',0,0],
    ['Dầu hào Chinsu 500ml','Chinsu Oyster','GV-CS-500',4,35000,31000,1200,'Masan',1,0],
    ['Mì CayKim 5 gói','CayKim 5pk','MI-CK-5',2,38000,35000,1500,'CayKim',0,0],
    ['Gạo sứ Việt 25kg','Viet Rice 25kg','GAO-VS-25',0,550000,520000,50,'Bình Dương Food',0,0],
    ['Nước tăng lực Number 1','Number 1 Energy','NCC-N1-250',3,10000,8500,5000,'Tân Hiệp Phát',0,0],
    ['Tương ớt Cholimex 250ml','Cholimex Chili','GV-CL-250',4,18000,null,1000,'Cholimex',0,0],
    ['Bia 333 500ml','333 Beer 500ml','BIA-333-500',5,14000,null,3000,'Sabeco',0,0],
  ];
  for (const [name,nameEn,sku,catIdx,price,gbp,stock,brand,mfrIdx,distIdx] of prods) {
    const pid = id(); pIds.push(pid);
    await Q(`INSERT INTO "Product" (id,sku,name,"nameEn","categoryId",brand,"basePrice","groupBuyPrice","stockQuantity","manufacturerId","distributorId","isActive") VALUES ('${pid}','${sku}','${name}','${nameEn}','${cIds[catIdx]}','${brand}',${price},${gbp||'NULL'},${stock},'${mIds[mfrIdx]}','${dIds[distIdx]}',true)`);
  }
  console.log(`  Products: ${prods.length}`);

  // Promotions
  const prIds = [];
  const prStart = iso(now - days(7));
  const prEnd = iso(now + days(30));
  for (const [title,type,mfrIdx,buy,get,pct,amt,budget] of [
    ['Mua 10 Hảo Hảo tặng 1','BUY_X_GET_Y',1,10,1,null,null,5000000],
    ['Giảm 15% Gạo ST25','PERCENT_OFF',0,null,null,15,null,10000000],
    ['Giảm 5k Coca-Cola','FIXED_DISCOUNT',2,null,null,null,5000,3000000],
  ]) {
    const prid = id(); prIds.push(prid);
    await Q(`INSERT INTO "Promotion" (id,"manufacturerId",title,"promoType","buyQty","getQty","discountPercent","discountAmount","startsAt","expiresAt","totalBudget") VALUES ('${prid}','${mIds[mfrIdx]}','${title}','${type}',${buy||'NULL'},${get||'NULL'},${pct||'NULL'},${amt||'NULL'},'${prStart}','${prEnd}',${budget})`);
  }
  console.log(`  Promotions: ${prIds.length}`);

  // Group Deals
  const gdIds = [];
  const gdStart = iso(now - days(3));
  const gdEnd = iso(now + days(14));
  for (const [title,pIdx,target,current,orig,disc,wIdx] of [
    ['Group Buy Gạo ST25 Phú Mỹ',0,200,156,125000,118000,0],
    ['Group Buy Hảo Hảo Dĩ An',4,500,423,8000,7000,5],
    ['Group Buy Coca-Cola TDM',6,1000,887,12000,10500,1],
  ]) {
    const gdid = id(); gdIds.push(gdid);
    await Q(`INSERT INTO "GroupDeal" (id,title,"productId","targetQty","currentQty","originalPrice","discountPrice","wardId","startsAt","expiresAt",status) VALUES ('${gdid}','${title}','${pIds[pIdx]}',${target},${current},${orig},${disc},'${wIds[wIdx]}','${gdStart}','${gdEnd}','ACTIVE')`);
  }
  console.log(`  Group Deals: ${gdIds.length}`);

  // Orders
  const statuses = ['PENDING','CONFIRMED','PROCESSING','PACKED','OUT_FOR_DELIVERY','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','CANCELLED','DELIVERED'];
  const pmtMethods = ['COD','CREDIT','DIGITAL'];
  for (let i = 0; i < 15; i++) {
    const oid = id();
    const onum = orderNum();
    const si = i % sIds.length;
    const st = statuses[i];
    const pm = pmtMethods[i % 3];
    const sub = Math.floor(Math.random()*500000)+100000;
    const ct = new Date(now - days(15-i));
    await Q(`INSERT INTO "Order" (id,"orderNumber","shopId","shopSnapshot",status,"paymentMethod","paymentStatus","subtotalAmount","totalAmount","createdAt","updatedAt") VALUES ('${oid}','${onum}','${sIds[si]}','{"shopName":"${sData[si][0]}"}','${st}','${pm}','${st==='DELIVERED'?'PAID':'PENDING'}',${sub},${sub},'${ct.toISOString()}','${ct.toISOString()}')`);
    // Order items
    for (let j = 0; j < Math.floor(Math.random()*4)+2; j++) {
      const pi = Math.floor(Math.random()*prods.length);
      const qty = Math.floor(Math.random()*10)+1;
      await Q(`INSERT INTO "OrderItem" (id,"orderId","productId","productName","productSku","unitPrice",quantity,"totalPrice","createdAt") VALUES ('${id()}','${oid}','${pIds[pi]}','${prods[pi][0]}','${prods[pi][2]}',${prods[pi][4]},${qty},${prods[pi][4]*qty},'${ct.toISOString()}')`);
    }
  }
  console.log('  Orders: 15 + OrderItems');

  // Shipments
  for (let i = 0; i < 6; i++) {
    const sid = id();
    const st = i < 4 ? 'DELIVERED' : i < 5 ? 'IN_TRANSIT' : 'PENDING';
    const ct = new Date(now - days(5-i));
    await Q(`INSERT INTO "Shipment" (id,"orderId",type,status,"assignedDriverId","pickupAddress","dropoffAddress","createdAt","updatedAt") VALUES ('${sid}',NULL,'INTERNAL','${st}','${uIds[i<4?10:11]}','Kho Phân Phối Miền Nam','TBD','${ct.toISOString()}','${new Date(now-days(3-i)).toISOString()}')`);
  }
  console.log('  Shipments: 6');

  // Broker
  await Q(`INSERT INTO "Broker" (id,"userId",tier,"commissionRate") VALUES ('${id()}','${uIds[12]}','WARD_LEVEL',0.03)`);
  console.log('  Broker: 1');

  // _prisma_migrations
  await Q(`INSERT INTO "_prisma_migrations" (id,checksum,migration_name,started_at,applied_steps_count) VALUES ('00000000-0000-0000-0000-000000000000','','init','${new Date().toISOString()}',1)`);

  const r = await Q(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`);
  console.log(`\n✅ TOTAL: ${r.rows.length} tables, ALL DATA SEEDED`);
  await pool.end();
}

async function main() {
  console.log('🌐 Creating schema in Neon PostgreSQL 16...');
  await schema();
  console.log('🌱 Seeding data...');
  await seed();
}
main().catch(e => { console.error('FATAL:', e.message?.substring(0,200)); process.exit(1); });