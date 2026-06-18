// Final clean schema creation — order matters for FKs
const {Pool} = require('@neondatabase/serverless');
const cs = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({ connectionString: cs, max: 1 });

async function main() {
  // Step 1: Drop all
  const existing = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
  for (const t of existing.rows) await pool.query(`DROP TABLE IF EXISTS "${t.table_name}" CASCADE`);
  console.log('Dropped all');

  // Step 2: Create tables WITHOUT FKs first, then add FKs
  // This avoids Neon pooler connection issues with dependent creation order
  
  const TABLES_NO_FK = [
    `CREATE TABLE "Category" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "slug" TEXT, "icon" TEXT, "sortOrder" INT DEFAULT 0, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Ward" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "district" TEXT NOT NULL, "province" TEXT DEFAULT 'Binh Duong', "shopCount" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Manufacturer" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT, "province" TEXT, "commissionRate" FLOAT8 DEFAULT 0.15, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Distributor" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT, "lat" FLOAT8, "lng" FLOAT8, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "User" ("id" TEXT PRIMARY KEY, "phone" TEXT NOT NULL, "email" TEXT, "passwordHash" TEXT, "name" TEXT NOT NULL, "nameEn" TEXT, "avatarUrl" TEXT, "role" TEXT DEFAULT 'SHOP_OWNER', "status" TEXT DEFAULT 'ACTIVE', "zaloId" TEXT, "lastLoginAt" TIMESTAMPTZ, "mustChangePwd" BOOL DEFAULT false, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE "Shop" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "nameEn" TEXT, "wardId" TEXT, "district" TEXT, "province" TEXT DEFAULT 'Binh Duong', "address" TEXT, "lat" FLOAT8, "lng" FLOAT8, "shopType" TEXT DEFAULT 'TAPHOA', "loyaltyTier" TEXT DEFAULT 'BRONZE', "creditLimit" INT DEFAULT 1000000, "creditBalance" INT DEFAULT 0, "creditStatus" TEXT DEFAULT 'ACTIVE', "totalOrders" INT DEFAULT 0, "totalGmv" INT DEFAULT 0, "avgOrderValue" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE "Product" ("id" TEXT PRIMARY KEY, "sku" TEXT NOT NULL, "name" TEXT NOT NULL, "nameEn" TEXT, "description" TEXT, "descriptionEn" TEXT, "categoryId" TEXT NOT NULL, "brand" TEXT, "unit" TEXT DEFAULT 'cai', "unitEn" TEXT, "basePrice" INT NOT NULL, "groupBuyPrice" INT, "stockQuantity" INT DEFAULT 0, "minOrderQty" INT DEFAULT 1, "maxOrderQty" INT, "weightKg" FLOAT8, "imageUrl" TEXT, "isActive" BOOL DEFAULT true, "isPrivateLabel" BOOL DEFAULT false, "barcode" TEXT, "manufacturerId" TEXT, "distributorId" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now(), "deletedAt" TIMESTAMPTZ)`,
    `CREATE TABLE "GroupDeal" ("id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT, "productId" TEXT NOT NULL, "targetQty" INT NOT NULL, "currentQty" INT DEFAULT 0, "originalPrice" INT NOT NULL, "discountPrice" INT NOT NULL, "maxParticipants" INT, "startsAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "wardId" TEXT, "status" TEXT DEFAULT 'ACTIVE', "bulkOrderId" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Order" ("id" TEXT PRIMARY KEY, "orderNumber" TEXT NOT NULL, "shopId" TEXT NOT NULL, "shopSnapshot" TEXT NOT NULL, "status" TEXT DEFAULT 'PENDING', "paymentMethod" TEXT DEFAULT 'COD', "paymentStatus" TEXT DEFAULT 'PENDING', "subtotalAmount" INT NOT NULL, "discountAmount" INT DEFAULT 0, "deliveryFee" INT DEFAULT 0, "totalAmount" INT NOT NULL, "paidAmount" INT DEFAULT 0, "creditUsed" INT DEFAULT 0, "groupDealId" TEXT, "distributorId" TEXT, "assignedDriverId" TEXT, "thirdPartyOrderId" TEXT, "customerNotes" TEXT, "adminNotes" TEXT, "idempotencyKey" TEXT, "confirmedAt" TIMESTAMPTZ, "packedAt" TIMESTAMPTZ, "deliveredAt" TIMESTAMPTZ, "cancelledAt" TIMESTAMPTZ, "cancelReason" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "OrderItem" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "productName" TEXT NOT NULL, "productSku" TEXT NOT NULL, "unitPrice" INT NOT NULL, "quantity" INT NOT NULL, "totalPrice" INT NOT NULL, "promotionId" TEXT, "freeQty" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Transaction" ("id" TEXT PRIMARY KEY, "shopId" TEXT NOT NULL, "orderId" TEXT, "type" TEXT NOT NULL, "amount" INT NOT NULL, "runningBalance" INT NOT NULL, "paymentMethod" TEXT, "paymentRef" TEXT, "collectedBy" TEXT, "description" TEXT, "metadata" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "GroupDealParticipant" ("id" TEXT PRIMARY KEY, "groupDealId" TEXT NOT NULL, "shopId" TEXT NOT NULL, "committedQty" INT NOT NULL, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Shipment" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "type" TEXT DEFAULT 'INTERNAL', "status" TEXT DEFAULT 'PENDING', "assignedDriverId" TEXT, "pickupAddress" TEXT, "pickupLat" FLOAT8, "pickupLng" FLOAT8, "dropoffAddress" TEXT NOT NULL, "dropoffLat" FLOAT8, "dropoffLng" FLOAT8, "deliveredAt" TIMESTAMPTZ, "podPhotoUrl" TEXT, "podSignatureUrl" TEXT, "podOtp" TEXT, "thirdPartyTrackingId" TEXT, "thirdPartyStatus" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Promotion" ("id" TEXT PRIMARY KEY, "manufacturerId" TEXT NOT NULL, "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT, "promoType" TEXT NOT NULL, "buyQty" INT, "getQty" INT, "discountPercent" FLOAT8, "discountAmount" INT, "startsAt" TIMESTAMPTZ NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "totalBudget" INT, "usedBudget" INT DEFAULT 0, "totalRedemptions" INT DEFAULT 0, "isActive" BOOL DEFAULT true, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "PromotionItem" ("id" TEXT PRIMARY KEY, "promotionId" TEXT NOT NULL, "productId" TEXT NOT NULL, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "MerchandisingAudit" ("id" TEXT PRIMARY KEY, "shopId" TEXT NOT NULL, "productId" TEXT, "promotionId" TEXT, "photoUrl" TEXT NOT NULL, "status" TEXT DEFAULT 'PENDING_REVIEW', "reviewerId" TEXT, "reviewNotes" TEXT, "reviewedAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Broker" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "tier" TEXT DEFAULT 'WARD_LEVEL', "wardId" TEXT, "commissionRate" FLOAT8 DEFAULT 0.03, "totalShopsReferred" INT DEFAULT 0, "totalCommissionEarned" INT DEFAULT 0, "totalGmvGenerated" INT DEFAULT 0, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "Payment" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL, "gateway" TEXT NOT NULL, "gatewayTxId" TEXT, "amount" INT NOT NULL, "status" TEXT DEFAULT 'PENDING', "paymentUrl" TEXT, "qrCodeUrl" TEXT, "rawRequest" TEXT, "rawCallback" TEXT, "paidAt" TIMESTAMPTZ, "expiresAt" TIMESTAMPTZ, "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "AuditLog" ("id" TEXT PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL, "entityId" TEXT, "details" TEXT, "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "PlatformSetting" ("id" TEXT PRIMARY KEY, "key" TEXT NOT NULL, "value" TEXT NOT NULL, "description" TEXT, "category" TEXT DEFAULT 'general', "createdAt" TIMESTAMPTZ DEFAULT now(), "updatedAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "ChatMessage" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "direction" TEXT DEFAULT 'OUTGOING', "messageType" TEXT DEFAULT 'TEXT', "content" TEXT NOT NULL, "imageUrl" TEXT, "metadata" TEXT, "isRead" BOOL DEFAULT false, "createdAt" TIMESTAMPTZ DEFAULT now())`,
    `CREATE TABLE "_prisma_migrations" (id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL, finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL, logs TEXT, rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ DEFAULT now(), applied_steps_count INT DEFAULT 0)`,
  ];

  console.log('Creating 22 tables without FKs...');
  let ok = 0;
  for (const t of TABLES_NO_FK) {
    try { await pool.query(t); ok++; } catch(e) { console.error('FAIL:', e.message?.substring(0, 120)); }
  }
  console.log(`Tables: ${ok}/22`);

  // Step 3: Add all FKs
  console.log('Adding foreign keys...');
  const FKS = [
    'ALTER TABLE "Shop" ADD CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE',
    'ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT',
    'ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL',
    'ALTER TABLE "Product" ADD CONSTRAINT "Product_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL',
    'ALTER TABLE "GroupDeal" ADD CONSTRAINT "GroupDeal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT',
    'ALTER TABLE "GroupDeal" ADD CONSTRAINT "GroupDeal_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL',
    'ALTER TABLE "Order" ADD CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT',
    'ALTER TABLE "Order" ADD CONSTRAINT "Order_groupDealId_fkey" FOREIGN KEY ("groupDealId") REFERENCES "GroupDeal"("id") ON DELETE SET NULL',
    'ALTER TABLE "Order" ADD CONSTRAINT "Order_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User"("id") ON DELETE SET NULL',
    'ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE',
    'ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT',
    'ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL',
    'ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT',
    'ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL',
    'ALTER TABLE "GroupDealParticipant" ADD CONSTRAINT "GDP_groupDealId_fkey" FOREIGN KEY ("groupDealId") REFERENCES "GroupDeal"("id") ON DELETE CASCADE',
    'ALTER TABLE "GroupDealParticipant" ADD CONSTRAINT "GDP_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE',
    'ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE',
    'ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User"("id") ON DELETE SET NULL',
    'ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT',
    'ALTER TABLE "PromotionItem" ADD CONSTRAINT "PI_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE',
    'ALTER TABLE "PromotionItem" ADD CONSTRAINT "PI_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE',
    'ALTER TABLE "MerchandisingAudit" ADD CONSTRAINT "MA_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL',
    'ALTER TABLE "Broker" ADD CONSTRAINT "Broker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE',
    'ALTER TABLE "Broker" ADD CONSTRAINT "Broker_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL',
    'ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE',
  ];
  let fkOk = 0;
  for (const fk of FKS) {
    try { await pool.query(fk); fkOk++; } catch(e) { console.error('FK FAIL:', e.message?.substring(0, 120)); }
  }
  console.log(`FKs: ${fkOk}/${FKS.length}`);

  // Step 4: Unique indexes
  console.log('Adding unique indexes...');
  const UQ = [
    'CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone")',
    'CREATE UNIQUE INDEX "User_email_key" ON "User"("email")',
    'CREATE UNIQUE INDEX "User_zaloId_key" ON "User"("zaloId")',
    'CREATE UNIQUE INDEX "Shop_userId_key" ON "Shop"("userId")',
    'CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku")',
    'CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode")',
    'CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber")',
    'CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey")',
    'CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId")',
    'CREATE UNIQUE INDEX "PromotionItem_promotionId_productId_key" ON "PromotionItem"("promotionId", "productId")',
    'CREATE UNIQUE INDEX "GDP_gdp_shop_key" ON "GroupDealParticipant"("groupDealId", "shopId")',
    'CREATE UNIQUE INDEX "Broker_userId_key" ON "Broker"("userId")',
    'CREATE UNIQUE INDEX "Payment_gatewayTxId_key" ON "Payment"("gatewayTxId")',
    'CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key")',
  ];
  let uqOk = 0;
  for (const u of UQ) { try { await pool.query(u); uqOk++; } catch(e) {} }
  console.log(`Indexes: ${uqOk}/${UQ.length}`);

  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name");
  console.log(`\n✅ SCHEMA READY: ${tables.rows.length} tables`);
  for (const t of tables.rows) console.log(`  ✓ ${t.table_name}`);

  await pool.end();
}
main().catch(e => { console.error('FATAL:', e.message?.substring(0, 200)); process.exit(1); });