// ES Module
import { Pool } from 'pg';
const cs = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
  connectionString: cs,
  max: 1,
  idleTimeoutMillis: 0,  // = auto-reconnect
  connectionTimeoutMillis: 30000,
});

async function seed() {
  const crypto = require('crypto');
  const pwHash = crypto.scryptSync('aladin123', 'aladin-salt', 64).toString('hex');
  console.log('Seeding Neon PostgreSQL...');
  
  try {
    // Categories
    await pool.query(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('cat1','Gạo','gao','🌾',1)`);
    await pool.query(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('cat2','Dầu ăn','dau-an','🫒',2)`);
    await pool.query(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('cat3','Mì ăn liền','mi-an-lien','🍜',3)`);
    await pool.query(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('cat4','Nước giải khát','nuoc-giai-khat','🥤',4)`);
    await pool.query(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('cat5','Gia vị & Thực phẩm khô','gia-vi','🧂',5)`);
    await pool.query(`INSERT INTO "Category" (id,name,slug,icon,"sortOrder") VALUES ('cat6','Đồ uống có cồn','do-uong-co-con','🍺',6)`);
    console.log('  Categories: 6');

    // Wards
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w1','Phú Mỹ','Thủ Dầu Một')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w2','Chánh Nghĩa','Thủ Dầu Một')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w3','Hiệp Thành','Thủ Dầu Một')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w4','Phú Thọ','Thủ Dầu Một')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w5','Định Hòa','Thủ Dầu Một')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w6','Tân Hiệp','Dĩ An')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w7','Dĩ An','Dĩ An')`);
    await pool.query(`INSERT INTO "Ward" (id,name,district) VALUES ('w8','Bình An','Dĩ An')`);
    console.log('  Wards: 8');

    // Manufacturers
    await pool.query(`INSERT INTO "Manufacturer" (id,name,email,province,"commissionRate") VALUES ('m1','Công ty Lương thực Bình Dương','sales@bdfood.vn','Bình Dương',0.15)`);
    await pool.query(`INSERT INTO "Manufacturer" (id,name,email,province,"commissionRate") VALUES ('m2','Masan Consumer','trade@masan.com','TP.HCM',0.12)`);
    await pool.query(`INSERT INTO "Manufacturer" (id,name,email,province,"commissionRate") VALUES ('m3','Unilever Vietnam','foodservice@unilever.vn','TP.HCM',0.18)`);
    console.log('  Manufacturers: 3');

    // Distributors
    await pool.query(`INSERT INTO "Distributor" (id,name,address,lat,lng) VALUES ('d1','Kho Phân Phối Miền Nam','12 Đại lộ Bình Dương',10.8802,106.7282)`);
    await pool.query(`INSERT INTO "Distributor" (id,name,address,lat,lng) VALUES ('d2','Kho Tổng TP.HCM','45 Nguyễn Thị Minh Khai Q.1',10.7828,106.6957)`);
    console.log('  Distributors: 2');

    // Users
    const uIds = [];
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u1','0901234567','admin@aladin.vn','Admin Aladin','ADMIN')`);
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u2','0901234600','hanhphuc@aladin.vn','Nguyễn Thị Hạnh Phúc','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u3','0901234601','taman@aladin.vn','Trần Văn Tâm An','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u4','0901234602','binhminh@aladin.vn','Lê Thị Bình Minh','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,"passwordHash",name,role) VALUES ('u5','0901234603','phuoclong@aladin.vn','Phạm Văn Phước Long','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,"passwordHash",name,role) VALUES ('u6','0901234604','locphat@aladin.vn','Hoàng Thị Lộc Phát','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u7','0901234605','hoamai@aladin.vn','Vũ Văn Hoa Mai','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u8','0901234606','phuongthao@aladin.vn','Ngô Thị Phương Thảo','SHOP_OWNER')`);
    await pool.query(`INSERT INTO "User" (id,phone,"passwordHash",name,role) VALUES ('u9','0911111111','sales@aladin.vn','Lý Minh Tuấn','SALES_REP')`);
    await pool.query(`INSERT INTO "User" (id,phone,"passwordHash",name,role) VALUES ('u10','0922222222',null,'Trần Văn Tài','DRIVER')`);
    await pool.query(`INSERT INTO "User" (id,phone,"passwordHash",name,role) VALUES ('u11','0922333333',null,'Nguyễn Văn Tèo','DRIVER')`);
    await pool.query(`INSERT INTO "User" (id,phone,email,"passwordHash",name,role) VALUES ('u12','0933333333','broker@aladin.vn','Phạm Thị Mai','BROKER')`);
    console.log('  Users: 13');

    // Shops
    const sIds = [];
    const shopQ = (idx,userId, name, wardId, district, address, tier, creditLimit, creditStatus) =>
      pool.query(`INSERT INTO "Shop" (id,"userId",name,"wardId",district,address,"loyaltyTier","creditLimit","creditStatus","totalOrders","totalGmv","avgOrderValue") VALUES ($${'s'+idx},${userId},'${name}','${wardId}','${district}','${address}','${tier}',${creditLimit},${creditStatus},${5 + Math.floor(Math.random()*20)+5},${Math.floor(Math.random()*50000000)+10000000},${Math.floor(Math.random()*20)+5})`);
    await shopQ(0, 'u2', 'Tạp Hạnh Phúc', 0, '12 Nguyễn Văn Cừ', 'Thủ Dầu Một', 'GOLD', 5000000, 'ACTIVE');
    await shopQ(1, 'u3', 'Tạp Hóa Tâm An', 1, '45/3 Trần Hưng Đạo', 'Thủ Dầu Một', 'PLATINUM', 10000000, 'ACTIVE');
    await shopQ(2, 'u4', 'Tạp Hóa Bình Minh', 2, '78B Phổ Quang', 'Thủ Dầu Một', 'SILVER', 3000000, 'ACTIVE');
    await shopQ(3, 'u5', 'Tạp Hóa Phước Long', 3, '23 Yersin', 'Thủ Dầu Một', 'PLATINUM', 8000000, 'LOCKED');
    await shopQ(4, 'u6', 'Tạp Hóa Lộc Phát', 4, '156 Lê Lợi', 'Thủ Dầu Một', 'BRONZE', 1500000, 'OVERDUE');
    await shopQ(5, 'u7', 'Tạp Hóa Hoa Mai', 5, '9/2A Trần Đại Nghĩa', 'Dĩ An', 'GOLD', 5000000, 'ACTIVE');
    await shopQ(6, 'u8', 'Tạp Hóa Phương Thảo', 6, '67 Thạch Ban', 'Dĩ An', 'SILVER', 3000000, 'ACTIVE');
    await shopQ(7, 'u9', 'Tạp Hóa Thành Đạt', 7, '101 Phạm Ngũ Lão', 'Dĩ An', 'GOLD', 5000000, 'ACTIVE');
    console.log('  Shops: 8');

    // Products (25 items)
    const pQ = (idx, sku, name, nameEn, catIdx, price, gbp, stock, brand, mfrIdx, distIdx) =>
      pool.query(`INSERT INTO "Product" (id,sku,name,"nameEn","categoryId",brand,"basePrice","groupBuyPrice","stockQuantity","manufacturerId","distributorId","isActive") VALUES ($${'p'+idx}','${sku}','${name}','${nameEn}','${'c'+catIdx}','${brand}',${price},${gbp || null},${stock},${mIds[mfrIdx]},${dIds[distIdx]},true)`);
    await pQ(0, 'GAO-ST25-5', 'Gạo ST25 5kg', 'ST25 Rice 5kg', 0, 125000, 118000, 500, 'Bình Dương Food', 0, 0);
    await pQ(1, 'GAO-JAS-10', 'Gạo thơm Jasmine 10kg', 'Jasmine Rice 10kg', 0, 230000, null, 200, 'Bình Dương Food', 0, 0);
    await pQ(2, 'DA-TA-1L', 'Dầu ăn Tường An 1L', 'Tuong An Oil 1L', 1, 42000, 38000, 1000, 'Tường An', 1, 0);
    await pQ(3, 'MI-HH-LY', 'Mì Hảo Hảo ly', 'Hao Hao Cup', 2, 8000, 7000, 3000, 'Acecook', 1, 0);
    await pQ(4, 'MI-HH-5', 'Mì Hảo Hảo bao 5', 'Hao Hao 5pk', 2, 35000, 32000, 2000, 'Acecook', 1, 0);
    await pQ(6, 'NCC-CC-330', 'Coca-Cola 330ml', 'Coca-Cola Can', 3, 12000, 10500, 5000, 'Coca-Cola', 2, 1);
    await pQ(7, 'NCC-PEP-330', 'Pepsi Can', 'Pepsi Can', 3, 11000, null, 4000, 'PepsiCo', 2, 1);
    await pQ(8, 'NCC-LV-500', 'Nước suối Lavie 500ml', 'Lavie 500ml', 3, 5000, 4200, 8000, 'Nestlé', 2, 1);
    await pQ(9, 'BIA-SG-500', 'Bia Saigon Special 500ml', 'SG Special 500ml', 5, 15000, null, 2000, 'Sabeco', 0, 0);
    await pQ(10, 'GV-NN-500', 'Nước mắm Nam Ngư 500ml', 'Nam Ngu 500ml', 4, 32000, 28000, 1500, 'Nam Ngư', 1, 0);
    await pQ(11, 'GV-DUONG-1', 'Đường tinh luyện 1kg', 'Sugar 1kg', 4, 25000, null, 2000, 'Tài Khoản', 0, 0);
    await pQ(12, 'GV-KN-400', 'Hạt nêm Knorr 400g', 'Knorr 400g', 4, 28000, 24000, 1800, 'Knorr', 2, 1);
    await pQ(13, 'GAO-JP-5', 'Gạo Nhật 5kg', 'JP Rice 5kg', 0, 280000, 260000, 100, 'Bình Dương Food', 0, 0);
    await pQ(14, 'MI-OM-HS', 'Mì Omachi hải sản', 'Omachi Seafood', 2, 9000, null, 2500, 'Acecook', 1, 0);
    await pQ(15, 'NCC-SP-330', 'Sprite Can', 'Sprite Can', 3, 12000, 10800, 3000, 'Coca-Cola', 2, 1);
    await pQ(16, 'NCC-TX-500', 'Trà xanh Không Độ 500ml', 'Zero Degree Tea', 3, 10000, 8500, 4000, 'Unilever', 2, 1);
    await pQ(17, 'GV-MUOI-500', 'Iodized Salt', 'Iodized Salt', 4, 12000, null, 3000, 'Bình Minh', 0, 0);
    await pQ(18, 'BIA-HK-330', 'Bia Heineken 330ml', 'Heineken 330ml', 5, 25000, null, 1500, 'Heineken', 0, 0);
    await pQ(19, 'GV-CS-500', 'Dầu hào Chinsu 250ml', 'Chinsu Oyster', 4, 35000, 31000, 1200, 'Masan', 1, 0);
    await pQ(20, 'MI-CK-5', 'Mì CayKim 5 gói', 'CayKim 5pk', 2, 38000, 35000, 1500, 'CayKim', 0, 0);
    await pQ(21, 'GAO-VS-25', 'Gạo sứ Việt 25kg', 'Viet Rice 25kg', 0, 550000, 520000, 50, 'Bình Dương Food', 0, 0);
    await pQ(22, 'NCC-N1-250', 'Nước tăng lực Number 1', 'Number 1 Energy', 3, 10000, 8500, 5000, 'Tân Hiệp Phát', 0, 0);
    await pQ(23, 'GV-CL-250', 'Tương ớt Cholimex 250ml', 'Cholimex Chili', 4, 18000, null, 1000, 'Cholimex', 0, 0);
    await pQ(24, 'BIA-333-500', 'Bia 333 Beer 500ml', '333 Beer 500ml', 5, 14000, null, 3000, 'Sabeco', 0, 0);
    console.log('  Products: 25');

    // Promotions
    await pool.query(`INSERT INTO "Promotion" (id,"manufacturerId",title,"promoType","buyQty","getQty","discountPercent","discountAmount","startsAt","expiresAt","totalBudget") VALUES ('pr1','${mIds[0]}','Mua 10 Hảo Hảo tặng 1','BUY_X_GET_Y',10,1,null,null,5000000)`);
    await pool.query(`INSERT INTO "Promotion" (id,"manufacturerId",title,"promoType","buyQty","getQty","discountPercent","discountAmount","startsAt","expiresAt","totalBudget") VALUES ('pr2','${mIds[1]}','Giảm 15% Gạo ST25','PERCENT_OFF',0,null,15,null,10000000)`);
    await pool.query(`INSERT INTO "Promotion" (id,"manufacturerId",title,"promoType","buyQty","getQty","discountPercent","discountAmount","startsAt","expiresAt","totalBudget") VALUES ('pr3','${mIds[2]}','Giảm 5k Coca-Cola','FIXED_DISCOUNT',2,null,null,5000,3000000)`);
    console.log('  Promotions: 3');

    // Group Deals
    await pool.query(`INSERT INTO "GroupDeal" (id,title,"productId","targetQty","currentQty","originalPrice","discountPrice","wardId","startsAt","expiresAt",status) VALUES ('gd1','Group Buy Gạo ST25 Phú Mỹ','${pIds[0]}',200,156,125000,118000,0,'${wIds[0]}','2026-06-18T00:00:00Z','2026-07-02T14:00:00Z','ACTIVE')`);
    await pool.query(`INSERT INTO "GroupDeal" (id,title,"productId","targetQty","currentQty","originalPrice","discountPrice","wardId","startsAt","expiresAt",status) VALUES ('gd2','Group Buy Hảo Hảo Dĩ An','${pIds[4]}',500,423,8000,7000,5,'${wIds[5]}','2026-06-15T00:00:00Z','2026-07-02T14:00:00Z','ACTIVE')`);
    await pool.query(`INSERT INTO "GroupDeal" (id,title,"productId","targetQty","currentQty","originalPrice","discountPrice","wardId","startsAt","expiresAt",status) VALUES ('gd3','Group Buy Coca-Cola TDM','${pIds[6]}',1000,887,12000,10500,1)`);
    console.log('  Group Deals: 3');

    // Orders (15)
    const statuses = ['PENDING','CONFIRMED','PROCESSING','PACKED','OUT_FOR_DELIVERY','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','DELIVERED','CANCELLED','DELIVERED'];
    const pmtMethods = ['COD','CREDIT','DIGITAL'];
    for (let i = 0; i < 15; i++) {
      const oid = `o${id()}`;
      const onum = `ALD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${i+1}`;
      const si = i % 8;
      const st = statuses[i];
      const pm = pmtMethods[i % 3];
      const sub = Math.floor(Math.random()*500000)+100000;
      const ct = new Date(now - (15-i) * 864000).toISOString();
      await pool.query(`INSERT INTO "Order" (id,"orderNumber","shopId","shopSnapshot",status,"paymentMethod","paymentStatus","subtotalAmount","totalAmount","createdAt","updatedAt") VALUES ('${oid}','${onum}','${sIds[si]}','{"shopName":"${sData[si]?.[0] || ""}','${st}','${pm}','${st==='DELIVERED'?'PAID':'PENDING'}',${sub},${sub},${ct})`);
      // Order items
      const pLen = Math.floor(Math.random()*4)+2;
      for (let j = 0; j < pLen; j++) {
        const pi = Math.floor(Math.random()*25);
        const qty = Math.floor(Math.random()*10)+1;
        await pool.query(`INSERT INTO "OrderItem" (id,"orderId","productId","productName","productSku","unitPrice",quantity,"totalPrice","createdAt") VALUES ('oi${id()}','${oid}','${pIds[pi]}','${prods[pi]?.[0] || ""}','${prods[pi]?.[2] || ""}',${prods[pi]?.[4] || ""},${prods[pi]?.[4]*qty || 0},${ct})`);
      }
    }
    console.log('  Orders: 15 + OrderItems');

    // Shipments (6)
    for (let i = 0; i < 6; i++) {
      const st = i < 4 ? 'DELIVERED' : i < 5 ? 'IN_TRANSIT' : 'PENDING';
      const ct = new Date(now - (5-i) * 864000).toISOString();
      await pool.query(`INSERT INTO "Shipment" (id,"orderId",type,status,"assignedDriverId","pickupAddress","dropoffAddress","createdAt","updatedAt") VALUES ('si${id()}','o${oid}','INTERNAL','${st}','${i<4?10:11}','Kho Phân Phối Miền Nam','TBD','${ct}')`);
    }
    console.log('  Shipments: 6');

    // Broker
    await pool.query(`INSERT INTO "Broker" (id,"userId",tier,"commissionRate") VALUES ('br1','${uIds[12]}','WARD_LEVEL',0.03)`);
    console.log('  Broker: 1');

    // Prisma migration record
    await pool.query(`INSERT INTO "_prisma_migrations" (id,checksum,migration_name,started_at,applied_steps_count) VALUES ('mig0','init','${new Date().toISOString()}',1)`);

    console.log('\n✅ ALL DATA SEEDED IN NEON!');
    
    // Verify
    const r = await pool.query(`SELECT 'Category' as t, count(*) as c FROM "Category" UNION ALL SELECT 'User' as t, count(*) as c FROM "User" UNION ALL SELECT 'Shop' as t, count(*) as c FROM "Shop" UNION ALL SELECT 'Product' as t, count(*) as c FROM "Product" UNION ALL SELECT 'Order' as t, count(*) as c FROM "Order" UNION ALL SELECT 'OrderItem' as t, count(*) as c FROM "OrderItem" UNION ALL SELECT 'Shipment' as t, count(*) as c FROM "Shipment"`);
    console.log('Table counts:');
    for (const row of r.rows) console.log(`  ${row.t}: ${row.c}`);
    
    await pool.end();
}

seed().catch(e) => { console.error('FATAL:', e.message); process.exit(1); });