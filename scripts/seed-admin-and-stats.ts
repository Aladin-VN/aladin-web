import { Pool } from 'pg';
import * as fs from 'fs';
import * as crypto from 'crypto';

const envContent = fs.readFileSync('.env', 'utf-8');
const envLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='));
const DATABASE_URL = envLine ? envLine.replace(/^DATABASE_URL=/, '').trim() : '';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // 1. Create Admin user (password: aladin123)
  const adminId = crypto.randomUUID();
  const adminPhone = '0900000001';
  const passwordHash = crypto.createHash('sha256').update('aladin123').digest('hex');

  try {
    await pool.query(
      `INSERT INTO "User" (id, phone, name, role, status, "passwordHash", "mustChangePwd", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [adminId, adminPhone, 'Aladin Admin', 'ADMIN', 'ACTIVE', passwordHash, false]
    );
    console.log('✅ Admin user created (phone: 0900000001, password: aladin123)');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('unique')) {
      console.log('⚠️ Admin user already exists');
    } else {
      console.log(`❌ Admin creation: ${msg}`);
    }
  }

  // 2. Create Platform Settings
  const settings = [
    ['platform.name', '"Aladin B2B"', 'Platform display name', 'general'],
    ['credit.defaultLimit', '1000000', 'Default credit limit in VND', 'credit'],
    ['platform.currency', 'VND', 'Currency code', 'general'],
    ['platform.province', 'Binh Duong', 'Default province', 'general'],
  ];

  for (const [key, value, desc, category] of settings) {
    try {
      await pool.query(
        `INSERT INTO "PlatformSetting" (id, key, value, description, category, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [crypto.randomUUID(), key, value, desc, category]
      );
    } catch { /* duplicate ok */ }
  }
  console.log('✅ Platform settings created');

  // 3. Update Shop statistics from actual order data
  console.log('\n📊 Updating shop statistics...');
  const result = await pool.query(`
    UPDATE "Shop" s
    SET
      "totalOrders" = sub.order_count,
      "totalGmv" = sub.total_gmv,
      "avgOrderValue" = CASE WHEN sub.order_count > 0 THEN sub.total_gmv / sub.order_count ELSE 0 END,
      "updatedAt" = NOW()
    FROM (
      SELECT
        o."shopId",
        COUNT(*) as order_count,
        COALESCE(SUM(o."totalAmount"), 0) as total_gmv
      FROM "Order" o
      GROUP BY o."shopId"
    ) sub
    WHERE s.id = sub."shopId"
  `);
  console.log(`  ✅ Updated ${result.rowCount} shops with order statistics`);

  // 4. Update Product stock from category defaults
  // (already set to 100 during import)

  // 5. Final report
  const tables = [
    ['Category', 'id'], ['Product', 'id'], ['User', 'id'], ['Shop', 'id'],
    ['Order', 'id'], ['OrderItem', 'id'], ['PlatformSetting', 'id'],
  ];

  console.log('\n📋 FINAL DATABASE STATE:');
  for (const [table, col] of tables) {
    const r = await pool.query(`SELECT COUNT(*) as cnt FROM "${table}"`);
    console.log(`  ${table}: ${r.rows[0].cnt} rows`);
  }

  // Show top shops by GMV
  console.log('\n🏆 Top 10 Shops by GMV:');
  const topShops = await pool.query(`
    SELECT s.name, s."totalOrders", s."totalGmv", s."avgOrderValue"
    FROM "Shop" s
    WHERE s."totalGmv" > 0
    ORDER BY s."totalGmv" DESC
    LIMIT 10
  `);
  for (const shop of topShops.rows) {
    console.log(`  ${shop.name}: ${shop.totalOrders} orders, ${(shop.totalGmv / 1000000).toFixed(1)}M VND GMV`);
  }

  // Show order status breakdown
  console.log('\n📊 Order Status Breakdown:');
  const statuses = await pool.query(`
    SELECT status, COUNT(*) as cnt, SUM("totalAmount") as total
    FROM "Order"
    GROUP BY status
    ORDER BY cnt DESC
  `);
  for (const s of statuses.rows) {
    console.log(`  ${s.status}: ${s.cnt} orders, ${(Number(s.total) / 1000000).toFixed(1)}M VND`);
  }

  await pool.end();
}

main();