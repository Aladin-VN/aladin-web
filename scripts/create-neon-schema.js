// Create Neon PostgreSQL schema using @neondatabase/serverless Pool
const { Pool } = require('@neondatabase/serverless');

const connectionString = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const pool = new Pool({ connectionString });

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  const ver = await pool.query('SELECT version()');
  console.log('Connected:', ver.rows[0].version.substring(0, 50));

  const dropTables = [
    'DROP TABLE IF EXISTS "ChatMessage" CASCADE',
    'DROP TABLE IF EXISTS "AuditLog" CASCADE',
    'DROP TABLE IF EXISTS "PlatformSetting" CASCADE',
    'DROP TABLE IF EXISTS "Payment" CASCADE',
    'DROP TABLE IF EXISTS "PromotionItem" CASCADE',
    'DROP TABLE IF EXISTS "OrderItem" CASCADE',
    'DROP TABLE IF EXISTS "Transaction" CASCADE',
    'DROP TABLE IF EXISTS "Shipment" CASCADE',
    'DROP TABLE IF EXISTS "GroupDealParticipant" CASCADE',
    'DROP TABLE IF EXISTS "Order" CASCADE',
    'DROP TABLE IF EXISTS "GroupDeal" CASCADE',
    'DROP TABLE IF EXISTS "MerchandisingAudit" CASCADE',
    'DROP TABLE IF EXISTS "Promotion" CASCADE',
    'DROP TABLE IF EXISTS "Broker" CASCADE',
    'DROP TABLE IF EXISTS "Product" CASCADE',
    'DROP TABLE IF EXISTS "Distributor" CASCADE',
    'DROP TABLE IF EXISTS "Manufacturer" CASCADE',
    'DROP TABLE IF EXISTS "Shop" CASCADE',
    'DROP TABLE IF EXISTS "Ward" CASCADE',
    'DROP TABLE IF EXISTS "User" CASCADE',
    'DROP TABLE IF EXISTS "Category" CASCADE',
  ];

  console.log('\nDropping existing tables...');
  for (const stmt of dropTables) {
    await pool.query(stmt);
  }
  console.log('Clean slate.');

  const S = [
    `CREATE TABLE "Category" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "slug" TEXT NOT NULL, "icon" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug")`,
    `CREATE TABLE "Ward" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "district" TEXT NOT NULL, "province" TEXT NOT NULL DEFAULT 'Binh Duong', "shopCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "Manufacturer" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT, "province" TEXT, "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.15, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "Distributor" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT, "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT, "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "phone" TEXT NOT NULL, "email" TEXT, "passwordHash" TEXT, "name" TEXT NOT NULL, "nameEn" TEXT, "avatarUrl" TEXT, "role" TEXT NOT NULL DEFAULT 'SHOP_OWNER', "status" TEXT NOT NULL DEFAULT 'ACTIVE', "zaloId" TEXT, "lastLoginAt" TIMESTAMP(3), "mustChangePwd" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3))`,
    `CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone")`,
    `CREATE UNIQUE INDEX "User_email_key" ON "User"("email")`,
    `CREATE UNIQUE INDEX "User_zaloId_key" ON "User"("zaloId")`,
    `CREATE TABLE "Shop" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "nameEn" TEXT, "wardId" TEXT, "district" TEXT, "province" TEXT NOT NULL DEFAULT 'Binh Duong', "address" TEXT, "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION, "shopType" TEXT NOT NULL DEFAULT 'TAPHOA', "loyaltyTier" TEXT NOT NULL DEFAULT 'BRONZE', "creditLimit" INTEGER NOT NULL DEFAULT 1000000, "creditBalance" INTEGER NOT NULL DEFAULT 0, "creditStatus" TEXT NOT NULL DEFAULT 'ACTIVE', "totalOrders" INTEGER NOT NULL DEFAULT 0, "totalGmv" INTEGER NOT NULL DEFAULT 0, "avgOrderValue" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3), CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "Shop_userId_key" ON "Shop"("userId")`,
    `CREATE TABLE "Product" ("id" TEXT NOT NULL PRIMARY KEY, "sku" TEXT NOT NULL, "name" TEXT NOT NULL, "nameEn" TEXT, "description" TEXT, "descriptionEn" TEXT, "categoryId" TEXT NOT NULL, "brand" TEXT, "unit" TEXT NOT NULL DEFAULT 'cai', "unitEn" TEXT, "basePrice" INTEGER NOT NULL, "groupBuyPrice" INTEGER, "stockQuantity" INTEGER NOT NULL DEFAULT 0, "minOrderQty" INTEGER NOT NULL DEFAULT 1, "maxOrderQty" INTEGER, "weightKg" DOUBLE PRECISION, "imageUrl" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "isPrivateLabel" BOOLEAN NOT NULL DEFAULT false, "barcode" TEXT, "manufacturerId" TEXT, "distributorId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "deletedAt" TIMESTAMP(3), CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "Product_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku")`,
    `CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode")`,
    `CREATE TABLE "GroupDeal" ("id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT, "productId" TEXT NOT NULL, "targetQty" INTEGER NOT NULL, "currentQty" INTEGER NOT NULL DEFAULT 0, "originalPrice" INTEGER NOT NULL, "discountPrice" INTEGER NOT NULL, "maxParticipants" INTEGER, "startsAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "wardId" TEXT, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "bulkOrderId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "GroupDeal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "GroupDeal_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE TABLE "Order" ("id" TEXT NOT NULL PRIMARY KEY, "orderNumber" TEXT NOT NULL, "shopId" TEXT NOT NULL, "shopSnapshot" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "paymentMethod" TEXT NOT NULL DEFAULT 'COD', "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING', "subtotalAmount" INTEGER NOT NULL, "discountAmount" INTEGER NOT NULL DEFAULT 0, "deliveryFee" INTEGER NOT NULL DEFAULT 0, "totalAmount" INTEGER NOT NULL, "paidAmount" INTEGER NOT NULL DEFAULT 0, "creditUsed" INTEGER NOT NULL DEFAULT 0, "groupDealId" TEXT, "distributorId" TEXT, "assignedDriverId" TEXT, "thirdPartyOrderId" TEXT, "customerNotes" TEXT, "adminNotes" TEXT, "idempotencyKey" TEXT, "confirmedAt" TIMESTAMP(3), "packedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3), "cancelledAt" TIMESTAMP(3), "cancelReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "Order_groupDealId_fkey" FOREIGN KEY ("groupDealId") REFERENCES "GroupDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber")`,
    `CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey")`,
    `CREATE TABLE "OrderItem" ("id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "productId" TEXT NOT NULL, "productName" TEXT NOT NULL, "productSku" TEXT NOT NULL, "unitPrice" INTEGER NOT NULL, "quantity" INTEGER NOT NULL, "totalPrice" INTEGER NOT NULL, "promotionId" TEXT, "freeQty" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "OrderItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE TABLE "Transaction" ("id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "orderId" TEXT, "type" TEXT NOT NULL, "amount" INTEGER NOT NULL, "runningBalance" INTEGER NOT NULL, "paymentMethod" TEXT, "paymentRef" TEXT, "collectedBy" TEXT, "description" TEXT, "metadata" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Transaction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE, CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE TABLE "GroupDealParticipant" ("id" TEXT NOT NULL PRIMARY KEY, "groupDealId" TEXT NOT NULL, "shopId" TEXT NOT NULL, "committedQty" INTEGER NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "GroupDealParticipant_groupDealId_fkey" FOREIGN KEY ("groupDealId") REFERENCES "GroupDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "GroupDealParticipant_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "GroupDealParticipant_groupDealId_shopId_key" ON "GroupDealParticipant"("groupDealId", "shopId")`,
    `CREATE TABLE "Shipment" ("id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'INTERNAL', "status" TEXT NOT NULL DEFAULT 'PENDING', "assignedDriverId" TEXT, "pickupAddress" TEXT, "pickupLat" DOUBLE PRECISION, "pickupLng" DOUBLE PRECISION, "dropoffAddress" TEXT NOT NULL, "dropoffLat" DOUBLE PRECISION, "dropoffLng" DOUBLE PRECISION, "deliveredAt" TIMESTAMP(3), "podPhotoUrl" TEXT, "podSignatureUrl" TEXT, "podOtp" TEXT, "thirdPartyTrackingId" TEXT, "thirdPartyStatus" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Shipment_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId")`,
    `CREATE TABLE "Promotion" ("id" TEXT NOT NULL PRIMARY KEY, "manufacturerId" TEXT NOT NULL, "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT, "promoType" TEXT NOT NULL, "buyQty" INTEGER, "getQty" INTEGER, "discountPercent" DOUBLE PRECISION, "discountAmount" INTEGER, "startsAt" TIMESTAMP(3) NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "totalBudget" INTEGER, "usedBudget" INTEGER NOT NULL DEFAULT 0, "totalRedemptions" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Promotion_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
    `CREATE TABLE "PromotionItem" ("id" TEXT NOT NULL PRIMARY KEY, "promotionId" TEXT NOT NULL, "productId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "PromotionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "PromotionItem_promotionId_productId_key" ON "PromotionItem"("promotionId", "productId")`,
    `CREATE TABLE "MerchandisingAudit" ("id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "productId" TEXT, "promotionId" TEXT, "photoUrl" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "reviewerId" TEXT, "reviewNotes" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "Broker" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "tier" TEXT NOT NULL DEFAULT 'WARD_LEVEL', "wardId" TEXT, "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.03, "totalShopsReferred" INTEGER NOT NULL DEFAULT 0, "totalCommissionEarned" INTEGER NOT NULL DEFAULT 0, "totalGmvGenerated" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Broker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "Broker_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "Broker_userId_key" ON "Broker"("userId")`,
    `CREATE TABLE "Payment" ("id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "gateway" TEXT NOT NULL, "gatewayTxId" TEXT, "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING', "paymentUrl" TEXT, "qrCodeUrl" TEXT, "rawRequest" TEXT, "rawCallback" TEXT, "paidAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
    `CREATE UNIQUE INDEX "Payment_gatewayTxId_key" ON "Payment"("gatewayTxId")`,
    `CREATE TABLE "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL, "entity" TEXT NOT NULL, "entityId" TEXT, "details" TEXT, "ipAddress" TEXT, "userAgent" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE "PlatformSetting" ("id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "value" TEXT NOT NULL, "description" TEXT, "category" TEXT NOT NULL DEFAULT 'general', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE UNIQUE INDEX "PlatformSetting_key_key" ON "PlatformSetting"("key")`,
    `CREATE TABLE "ChatMessage" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "conversationId" TEXT NOT NULL, "direction" TEXT NOT NULL DEFAULT 'OUTGOING', "messageType" TEXT NOT NULL DEFAULT 'TEXT', "content" TEXT NOT NULL, "imageUrl" TEXT, "metadata" TEXT, "isRead" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  ];

  console.log(`\nCreating ${S.length} tables...`);
  let ok = 0;
  for (const stmt of S) {
    try { await pool.query(stmt); ok++; } catch(e) { console.error('FAIL:', e.message?.substring(0, 150)); }
  }
  console.log(`Tables: ${ok}/${S.length} created`);

  // Indexes
  const I = [
    'CREATE INDEX IF NOT EXISTS "User_phone_idx" ON "User"("phone")',
    'CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role")',
    'CREATE INDEX IF NOT EXISTS "User_status_idx" ON "User"("status")',
    'CREATE INDEX IF NOT EXISTS "Shop_userId_idx" ON "Shop"("userId")',
    'CREATE INDEX IF NOT EXISTS "Shop_wardId_idx" ON "Shop"("wardId")',
    'CREATE INDEX IF NOT EXISTS "Shop_district_idx" ON "Shop"("district")',
    'CREATE INDEX IF NOT EXISTS "Shop_creditStatus_idx" ON "Shop"("creditStatus")',
    'CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId")',
    'CREATE INDEX IF NOT EXISTS "Product_sku_idx" ON "Product"("sku")',
    'CREATE INDEX IF NOT EXISTS "Product_manufacturerId_idx" ON "Product"("manufacturerId")',
    'CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive")',
    'CREATE INDEX IF NOT EXISTS "Order_shopId_idx" ON "Order"("shopId")',
    'CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status")',
    'CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")',
    'CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx" ON "OrderItem"("productId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_shopId_idx" ON "Transaction"("shopId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_orderId_idx" ON "Transaction"("orderId")',
    'CREATE INDEX IF NOT EXISTS "Transaction_type_idx" ON "Transaction"("type")',
    'CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "GroupDeal_productId_idx" ON "GroupDeal"("productId")',
    'CREATE INDEX IF NOT EXISTS "GroupDeal_status_idx" ON "GroupDeal"("status")',
    'CREATE INDEX IF NOT EXISTS "GroupDealParticipant_shopId_idx" ON "GroupDealParticipant"("shopId")',
    'CREATE INDEX IF NOT EXISTS "Shipment_assignedDriverId_idx" ON "Shipment"("assignedDriverId")',
    'CREATE INDEX IF NOT EXISTS "Shipment_status_idx" ON "Shipment"("status")',
    'CREATE INDEX IF NOT EXISTS "Promotion_manufacturerId_idx" ON "Promotion"("manufacturerId")',
    'CREATE INDEX IF NOT EXISTS "MerchandisingAudit_shopId_idx" ON "MerchandisingAudit"("shopId")',
    'CREATE INDEX IF NOT EXISTS "Broker_tier_idx" ON "Broker"("tier")',
    'CREATE INDEX IF NOT EXISTS "Payment_orderId_idx" ON "Payment"("orderId")',
    'CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId")',
    'CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action")',
    'CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId")',
    'CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "ChatMessage_userId_idx" ON "ChatMessage"("userId")',
    'CREATE INDEX IF NOT EXISTS "ChatMessage_conversationId_idx" ON "ChatMessage"("conversationId")',
    'CREATE INDEX IF NOT EXISTS "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt")',
  ];
  console.log(`Creating ${I.length} indexes...`);
  let io = 0;
  for (const idx of I) { try { await pool.query(idx); io++; } catch(e) {} }
  console.log(`Indexes: ${io} created`);

  const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
  console.log(`\n✅ Neon PostgreSQL ready (${tables.rows.length} tables):`);
  for (const t of tables.rows) console.log(`  ✓ ${t.table_name}`);
  await pool.end();
}
main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });