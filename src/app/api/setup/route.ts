import { NextResponse } from 'next/server';

// POST /api/setup — Seed the database with demo data
// On Vercel: creates SQLite in /tmp, pushes schema, and seeds
// On local: assumes schema already pushed, just seeds
export async function POST(request: Request) {
  try {
    const { secret } = await request.json().catch(() => ({}));

    if (secret !== process.env.SETUP_SECRET && process.env.SETUP_SECRET) {
      return NextResponse.json({ error: 'Invalid setup secret' }, { status: 403 });
    }

    const { db } = await import('@/lib/db');

    // Check if already seeded
    const existingCount = await db.product.count().catch(() => 0);
    if (existingCount > 0) {
      // Clean and re-seed
      const tables = [
        'chatMessage', 'auditLog', 'platformSetting', 'payment',
        'promotionItem', 'orderItem', 'transaction', 'shipment',
        'groupDealParticipant', 'order', 'groupDeal',
        'merchandisingAudit', 'promotion',
        'broker', 'product', 'distributor', 'manufacturer',
        'shop', 'ward', 'user', 'category',
      ] as const;
      for (const t of tables) {
        try { await (db as any)[t].deleteMany(); } catch {}
      }
    }

    // On Vercel with /tmp SQLite, push schema using raw SQL
    const isVercel = !!process.env.VERCEL;
    if (isVercel) {
      const { Prisma } = await import('@prisma/client');
      // Destructure to get the generated SQL
      const schemaSql = getCreateTablesSql();
      for (const sql of schemaSql) {
        try { await db.$executeRawUnsafe(sql); } catch {}
      }
    }

    const { seedDatabase } = await import('@/lib/seed');
    const result = await seedDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      environment: isVercel ? 'vercel-tmp-sqlite' : 'local',
      note: isVercel
        ? 'Data stored in /tmp (ephemeral). Re-run POST /api/setup after each redeploy.'
        : 'Data stored in local SQLite file.',
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Seed failed:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/setup — Check if database has data
export async function GET() {
  try {
    const { db } = await import('@/lib/db');
    const productCount = await db.product.count();

    return NextResponse.json({
      seeded: productCount > 0,
      productCount,
      environment: process.env.VERCEL ? 'vercel-tmp-sqlite' : 'local',
      message: productCount > 0
        ? 'Database already seeded. Use POST to re-seed.'
        : 'Database is empty. POST to /api/setup to seed.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Minimal CREATE TABLE statements for Vercel /tmp SQLite
// This is a fallback — Prisma normally handles schema via db push
function getCreateTablesSql(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS "Category" (
      "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT,
      "slug" TEXT NOT NULL, "icon" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Ward" (
      "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT,
      "district" TEXT NOT NULL, "province" TEXT NOT NULL DEFAULT 'Binh Duong',
      "shopCount" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Manufacturer" (
      "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT,
      "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT,
      "province" TEXT, "commissionRate" REAL NOT NULL DEFAULT 0.15,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Distributor" (
      "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "nameEn" TEXT,
      "contactPerson" TEXT, "contactPhone" TEXT, "email" TEXT, "address" TEXT,
      "lat" REAL, "lng" REAL, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY, "phone" TEXT NOT NULL, "email" TEXT,
      "passwordHash" TEXT, "name" TEXT NOT NULL, "nameEn" TEXT, "avatarUrl" TEXT,
      "role" TEXT NOT NULL DEFAULT 'SHOP_OWNER', "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "zaloId" TEXT, "lastLoginAt" DATETIME, "mustChangePwd" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      "deletedAt" DATETIME
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_key" ON "User"("phone")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_zaloId_key" ON "User"("zaloId")`,
    `CREATE TABLE IF NOT EXISTS "Shop" (
      "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "name" TEXT NOT NULL,
      "nameEn" TEXT, "wardId" TEXT, "district" TEXT, "province" TEXT NOT NULL DEFAULT 'Binh Duong',
      "address" TEXT, "lat" REAL, "lng" REAL, "shopType" TEXT NOT NULL DEFAULT 'TAPHOA',
      "loyaltyTier" TEXT NOT NULL DEFAULT 'BRONZE', "creditLimit" INTEGER NOT NULL DEFAULT 1000000,
      "creditBalance" INTEGER NOT NULL DEFAULT 0, "creditStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
      "totalOrders" INTEGER NOT NULL DEFAULT 0, "totalGmv" INTEGER NOT NULL DEFAULT 0,
      "avgOrderValue" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      "deletedAt" DATETIME,
      CONSTRAINT "Shop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Shop_userId_key" ON "Shop"("userId")`,
    `CREATE TABLE IF NOT EXISTS "Product" (
      "id" TEXT NOT NULL PRIMARY KEY, "sku" TEXT NOT NULL, "name" TEXT NOT NULL,
      "nameEn" TEXT, "description" TEXT, "descriptionEn" TEXT, "categoryId" TEXT NOT NULL,
      "brand" TEXT, "unit" TEXT NOT NULL DEFAULT 'cai', "unitEn" TEXT,
      "basePrice" INTEGER NOT NULL, "groupBuyPrice" INTEGER, "stockQuantity" INTEGER NOT NULL DEFAULT 0,
      "minOrderQty" INTEGER NOT NULL DEFAULT 1, "maxOrderQty" INTEGER, "weightKg" REAL,
      "imageUrl" TEXT, "isActive" BOOLEAN NOT NULL DEFAULT true, "isPrivateLabel" BOOLEAN NOT NULL DEFAULT false,
      "barcode" TEXT, "manufacturerId" TEXT, "distributorId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      "deletedAt" DATETIME,
      CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Product_distributorId_fkey" FOREIGN KEY ("distributorId") REFERENCES "Distributor"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku")`,
    `CREATE TABLE IF NOT EXISTS "Order" (
      "id" TEXT NOT NULL PRIMARY KEY, "orderNumber" TEXT NOT NULL, "shopId" TEXT NOT NULL,
      "shopSnapshot" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
      "paymentMethod" TEXT NOT NULL DEFAULT 'COD', "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "subtotalAmount" INTEGER NOT NULL, "discountAmount" INTEGER NOT NULL DEFAULT 0,
      "deliveryFee" INTEGER NOT NULL DEFAULT 0, "totalAmount" INTEGER NOT NULL,
      "paidAmount" INTEGER NOT NULL DEFAULT 0, "creditUsed" INTEGER NOT NULL DEFAULT 0,
      "groupDealId" TEXT, "distributorId" TEXT, "assignedDriverId" TEXT,
      "thirdPartyOrderId" TEXT, "customerNotes" TEXT, "adminNotes" TEXT,
      "idempotencyKey" TEXT,
      "confirmedAt" DATETIME, "packedAt" DATETIME, "deliveredAt" DATETIME,
      "cancelledAt" DATETIME, "cancelReason" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Order_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Order_groupDealId_fkey" FOREIGN KEY ("groupDealId") REFERENCES "GroupDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Order_shipmentId_fkey" FOREIGN KEY ("id") REFERENCES "Shipment"("orderId") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Order_orderNumber_key" ON "Order"("orderNumber")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Order_idempotencyKey_key" ON "Order"("idempotencyKey")`,
    `CREATE TABLE IF NOT EXISTS "OrderItem" (
      "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "productId" TEXT NOT NULL,
      "productName" TEXT NOT NULL, "productSku" TEXT NOT NULL, "unitPrice" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL, "totalPrice" INTEGER NOT NULL, "promotionId" TEXT,
      "freeQty" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "OrderItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Transaction" (
      "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "orderId" TEXT,
      "type" TEXT NOT NULL, "amount" INTEGER NOT NULL, "runningBalance" INTEGER NOT NULL,
      "paymentMethod" TEXT, "paymentRef" TEXT, "collectedBy" TEXT,
      "description" TEXT, "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Transaction_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "GroupDeal" (
      "id" TEXT NOT NULL PRIMARY KEY, "title" TEXT NOT NULL, "titleEn" TEXT,
      "description" TEXT, "productId" TEXT NOT NULL, "targetQty" INTEGER NOT NULL,
      "currentQty" INTEGER NOT NULL DEFAULT 0, "originalPrice" INTEGER NOT NULL,
      "discountPrice" INTEGER NOT NULL, "maxParticipants" INTEGER,
      "startsAt" DATETIME NOT NULL, "expiresAt" DATETIME NOT NULL, "wardId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE', "bulkOrderId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "GroupDeal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
      CONSTRAINT "GroupDeal_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "GroupDealParticipant" (
      "id" TEXT NOT NULL PRIMARY KEY, "groupDealId" TEXT NOT NULL, "shopId" TEXT NOT NULL,
      "committedQty" INTEGER NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "GroupDealParticipant_groupDealId_fkey" FOREIGN KEY ("groupDealId") REFERENCES "GroupDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "GroupDealParticipant_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "GroupDealParticipant_groupDealId_shopId_key" ON "GroupDealParticipant"("groupDealId", "shopId")`,
    `CREATE TABLE IF NOT EXISTS "Shipment" (
      "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL,
      "type" TEXT NOT NULL DEFAULT 'INTERNAL', "status" TEXT NOT NULL DEFAULT 'PENDING',
      "assignedDriverId" TEXT, "pickupAddress" TEXT, "pickupLat" REAL, "pickupLng" REAL,
      "dropoffAddress" TEXT NOT NULL, "dropoffLat" REAL, "dropoffLng" REAL,
      "deliveredAt" DATETIME, "podPhotoUrl" TEXT, "podSignatureUrl" TEXT, "podOtp" TEXT,
      "thirdPartyTrackingId" TEXT, "thirdPartyStatus" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Shipment_orderId_key" ON "Shipment"("orderId")`,
    `CREATE TABLE IF NOT EXISTS "Promotion" (
      "id" TEXT NOT NULL PRIMARY KEY, "manufacturerId" TEXT NOT NULL,
      "title" TEXT NOT NULL, "titleEn" TEXT, "description" TEXT,
      "promoType" TEXT NOT NULL, "buyQty" INTEGER, "getQty" INTEGER,
      "discountPercent" REAL, "discountAmount" INTEGER,
      "startsAt" DATETIME NOT NULL, "expiresAt" DATETIME NOT NULL,
      "totalBudget" INTEGER, "usedBudget" INTEGER NOT NULL DEFAULT 0,
      "totalRedemptions" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Promotion_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "PromotionItem" (
      "id" TEXT NOT NULL PRIMARY KEY, "promotionId" TEXT NOT NULL, "productId" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PromotionItem_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PromotionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PromotionItem_promotionId_productId_key" ON "PromotionItem"("promotionId", "productId")`,
    `CREATE TABLE IF NOT EXISTS "MerchandisingAudit" (
      "id" TEXT NOT NULL PRIMARY KEY, "shopId" TEXT NOT NULL, "productId" TEXT,
      "promotionId" TEXT, "photoUrl" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      "reviewerId" TEXT, "reviewNotes" TEXT, "reviewedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Broker" (
      "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
      "tier" TEXT NOT NULL DEFAULT 'WARD_LEVEL', "wardId" TEXT,
      "commissionRate" REAL NOT NULL DEFAULT 0.03,
      "totalShopsReferred" INTEGER NOT NULL DEFAULT 0,
      "totalCommissionEarned" INTEGER NOT NULL DEFAULT 0,
      "totalGmvGenerated" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Broker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Broker_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Broker_userId_key" ON "Broker"("userId")`,
    `CREATE TABLE IF NOT EXISTS "Payment" (
      "id" TEXT NOT NULL PRIMARY KEY, "orderId" TEXT NOT NULL, "gateway" TEXT NOT NULL,
      "gatewayTxId" TEXT, "amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'PENDING',
      "paymentUrl" TEXT, "qrCodeUrl" TEXT, "rawRequest" TEXT, "rawCallback" TEXT,
      "paidAt" DATETIME, "expiresAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Payment_gatewayTxId_key" ON "Payment"("gatewayTxId")`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT, "action" TEXT NOT NULL,
      "entity" TEXT NOT NULL, "entityId" TEXT, "details" TEXT,
      "ipAddress" TEXT, "userAgent" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "PlatformSetting" (
      "id" TEXT NOT NULL PRIMARY KEY, "key" TEXT NOT NULL, "value" TEXT NOT NULL,
      "description" TEXT, "category" TEXT NOT NULL DEFAULT 'general',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSetting_key_key" ON "PlatformSetting"("key")`,
    `CREATE TABLE IF NOT EXISTS "ChatMessage" (
      "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
      "conversationId" TEXT NOT NULL, "direction" TEXT NOT NULL DEFAULT 'OUTGOING',
      "messageType" TEXT NOT NULL DEFAULT 'TEXT', "content" TEXT NOT NULL,
      "imageUrl" TEXT, "metadata" TEXT, "isRead" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    // Disable foreign keys for seed (insert order matters)
    `PRAGMA foreign_keys=OFF`,
  ];
}