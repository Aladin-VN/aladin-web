/**
 * Excel → Neon PostgreSQL Data Import Script
 * Uses direct pg (not Prisma Client) for reliable Neon connection
 *
 * Import order (respecting FK constraints):
 * 1. Categories (17)
 * 2. Products (~387)
 * 3. Users + Shops (~295 customers)
 * 4. Orders (~149)
 * 5. OrderItems (~2998)
 */

import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// Read .env manually (tsx doesn't always load .env)
const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
const envLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='));
const DATABASE_URL = envLine ? envLine.replace(/^DATABASE_URL=/, '').trim() : (process.env.DATABASE_URL || '');

if (!DATABASE_URL.startsWith('postgresql://') && !DATABASE_URL.startsWith('postgres://')) {
  console.error('ERROR: DATABASE_URL not found or invalid in .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

const EXCEL_PATH = path.resolve(__dirname, '../upload/New Data Scheme Aladin ERD (1).xlsx');

// ============================================================
// MAPPING TABLES
// ============================================================
const categoryMap = new Map<number, string>();
const productMap = new Map<string, { id: string; basePrice: number; name: string }>();
const customerShopMap = new Map<number, string>();  // excelCustId → shopId
const orderMap = new Map<number, string>();           // excelOrderId → prismaOrderId
const userPhoneToId = new Map<string, string>();

// ============================================================
// HELPERS
// ============================================================

function normalizePhone(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  let phone = String(raw).replace(/[\s\-\.\(\)]/g, '');
  // Take only first line if multi-line phone
  if (phone.includes('\n')) phone = phone.split('\n')[0].trim();
  // Remove leading + if present
  if (phone.startsWith('+84')) phone = '0' + phone.slice(3);
  if (/^84\d{9}$/.test(phone)) phone = '0' + phone.slice(2);
  // Accept 9-10 digit numbers starting with 0
  if (!/^0\d{8,10}$/.test(phone)) {
    // If 9 digits missing leading 0 (very common in VN)
    if (/^\d{9,10}$/.test(phone) && !phone.startsWith('0')) {
      phone = '0' + phone;
    }
  }
  if (!/^0\d{9,10}$/.test(phone)) return '';
  return phone;
}

function slugify(text: string): string {
  const a = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ';
  const b = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuyyyyydAAAAAAAAAAAAAAAAAEEEEEEEEEEIIIIIOOOOOOOOOOOOOOOOOUUUUUUUUUUYYYYYD';
  let result = '';
  for (let i = 0; i < text.length; i++) {
    const idx = a.indexOf(text[i]);
    result += idx >= 0 ? b[idx] : text[i];
  }
  return result.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

function parseDate(val: string | number | null | undefined): string | null {
  if (val === null || val === undefined || val === '') return null;
  try {
    let d: Date;
    if (typeof val === 'number') {
      // Excel serial date: days since 1899-12-30
      d = new Date(1899, 11, 30);
      d.setTime(d.getTime() + val * 86400000);
    } else {
      d = new Date(val);
    }
    if (isNaN(d.getTime()) || d.getFullYear() < 2020 || d.getFullYear() > 2030) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function parseNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseStatus(raw: string | null | undefined): string {
  if (!raw) return 'PENDING';
  const s = raw.trim().toUpperCase();
  if (s.includes('DELIVERED')) return 'DELIVERED';
  if (s.includes('PROCESSING')) return 'PROCESSING';
  if (s.includes('CANCEL')) return 'CANCELLED';
  if (s.includes('CONFIRMED')) return 'CONFIRMED';
  if (s.includes('PACKED')) return 'PACKED';
  return 'PENDING';
}

async function sql(text: string, params: unknown[] = []) {
  const result = await pool.query(text, params);
  return result;
}

// ============================================================
// STEP 1: IMPORT CATEGORIES
// ============================================================

async function importCategories(sheet: XLSX.WorkSheet) {
  console.log('\n📋 STEP 1: Importing Categories...');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });
  let count = 0;
  let catNum = 1; // Fallback ID counter

  for (const row of rows) {
    const rawId = row['Mã Loại sản phẩm'];
    const name = String(row['loại sản phẩm'] || '').trim();
    if (!name) continue;

    // Handle formula-based IDs
    let id = Math.round(parseNum(rawId));
    if (!id || id <= 0) id = catNum;
    catNum = id + 1;

    const slug = slugify(name);
    const id_uuid = randomUUID();

    await sql(
      `INSERT INTO "Category" (id, name, "nameEn", slug, "sortOrder", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())`,
      [id_uuid, name, name, slug, id]
    );

    categoryMap.set(id, id_uuid);
    count++;
    console.log(`  ✅ ${id}: ${name}`);
  }

  console.log(`  → Imported ${count} categories\n`);
}

// ============================================================
// STEP 2: IMPORT PRODUCTS
// ============================================================

async function importProducts(sheet: XLSX.WorkSheet) {
  console.log('📦 STEP 2: Importing Products...');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });
  let count = 0;
  let skipped = 0;

  // Get first category ID as fallback
  const firstCatId = categoryMap.values().next().value as string;

  for (const row of rows) {
    const sku = String(row['product_id'] || '').trim();
    if (!sku || !/^P\d+$/i.test(sku)) continue;

    const name = String(row['product_name'] || '').trim();
    if (!name) { skipped++; continue; }

    const brand = String(row['brand'] || '').trim() || null;
    const retailPrice = parseNum(row['retail_price']);
    const wholesalePrice = parseNum(row['wholesale_price']);
    const volume = String(row['volume'] || '').trim() || null;
    const description = String(row['description'] || '').trim() || null;
    const excelCatId = Math.round(parseNum(row['category_id']));

    // B2B platform: use wholesale_price × 1000 as basePrice, fallback to retail
    const basePrice = wholesalePrice > 0
      ? Math.round(wholesalePrice * 1000)
      : retailPrice > 0
        ? Math.round(retailPrice * 1000)
        : 0;

    const categoryId = categoryMap.get(excelCatId) || firstCatId;

    let cleanDesc: string | null = null;
    if (description && description.length < 500) {
      cleanDesc = description.replace(/[\n\r]+/g, ' ').trim();
    }

    const id = randomUUID();
    try {
      await sql(
        `INSERT INTO "Product" (id, sku, name, "nameEn", brand, "basePrice", "categoryId",
         unit, "unitEn", description, "stockQuantity", "minOrderQty", "isActive", "isPrivateLabel",
         "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'cai', 'piece', $8, 100, 1, true, false, NOW(), NOW())`,
        [id, sku, name, name, brand, basePrice, categoryId, cleanDesc]
      );

      productMap.set(sku, { id, basePrice, name });
      count++;

      if (count % 100 === 0) console.log(`  ... imported ${count} products`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Product ${sku} (${name}): ${msg.substring(0, 80)}`);
    }
  }

  console.log(`  → Imported ${count} products, skipped ${skipped} (no name)\n`);
}

// ============================================================
// STEP 3: IMPORT CUSTOMERS → Users + Shops
// ============================================================

async function importCustomers(sheet: XLSX.WorkSheet) {
  console.log('👥 STEP 3: Importing Customers (Users + Shops)...');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });
  let count = 0;
  let skipped = 0;

  const phoneSeen = new Set<string>();

  for (const row of rows) {
    const excelId = Math.round(parseNum(row['customer_id']));
    if (!excelId || excelId <= 0) continue;

    const name = String(row['customer_name'] || '').trim();
    if (!name) { skipped++; continue; }

    const rawPhone = String(row['phone_number'] || '');
    let phone = normalizePhone(rawPhone);

    // For customers with no phone, generate placeholder
    const hasRealPhone = phone.length > 0;
    if (!hasRealPhone) {
      phone = `NO_PHONE_${excelId}`;
    }

    // Skip duplicate phones
    if (phoneSeen.has(phone)) { skipped++; continue; }
    phoneSeen.add(phone);

    const signUpDate = parseDate(row['sign_up_date']) || new Date().toISOString();
    const neighbourhood = String(row['Neighbourhood Demographic'] || '').trim();

    let district = 'Bầu Bàng';
    if (neighbourhood.includes(':')) {
      district = neighbourhood.split(':')[0].trim();
    } else if (neighbourhood) {
      district = neighbourhood.trim();
    }

    // Clean shop name (remove Vietnamese prefixes)
    const shopName = name.replace(/^(c\.|chị|anh|cô)\s*/i, '').trim() || name;

    const userId = randomUUID();
    const shopId = randomUUID();

    try {
      // Create User
      await sql(
        `INSERT INTO "User" (id, phone, name, role, status, "mustChangePwd", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'SHOP_OWNER', 'ACTIVE', false, $4, NOW())`,
        [userId, phone, name, signUpDate]
      );

      // Create Shop
      await sql(
        `INSERT INTO "Shop" (id, "userId", name, district, province, address, "shopType",
         "loyaltyTier", "creditLimit", "creditBalance", "creditStatus",
         "totalOrders", "totalGmv", "avgOrderValue", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, 'Binh Duong', $5, 'TAPHOA', 'BRONZE',
         1000000, 0, 'ACTIVE', 0, 0, 0, $6, NOW())`,
        [shopId, userId, shopName, district, neighbourhood || null, signUpDate]
      );

      customerShopMap.set(excelId, shopId);
      userPhoneToId.set(phone, userId);
      count++;

      if (count % 50 === 0) console.log(`  ... imported ${count} customers`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // If duplicate phone, check if user already exists
      if (msg.includes('unique') || msg.includes('duplicate')) {
        const existing = await sql(`SELECT id FROM "User" WHERE phone = $1 LIMIT 1`, [phone]);
        if (existing.rows.length > 0) {
          const existUserId = existing.rows[0].id;
          const existShop = await sql(`SELECT id FROM "Shop" WHERE "userId" = $1 LIMIT 1`, [existUserId]);
          if (existShop.rows.length > 0) {
            customerShopMap.set(excelId, existShop.rows[0].id);
            count++;
            continue;
          }
        }
      }
      console.log(`  ❌ Customer ${excelId} (${name}, ${phone}): ${msg.substring(0, 100)}`);
    }
  }

  console.log(`  → Imported ${count} customers, skipped ${skipped}\n`);
}

// ============================================================
// STEP 4: IMPORT ORDERS
// ============================================================

async function importOrders(sheet: XLSX.WorkSheet) {
  console.log('🛒 STEP 4: Importing Orders...');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });

  // Collect valid orders first
  const validOrders: Array<{
    excelId: number; excelCustId: number; orderDate: string | null;
    totalAmount: number; status: string; deliveryDate: string | null;
    statusRaw: string; note: string | null;
  }> = [];

  for (const row of rows) {
    const excelId = Math.round(parseNum(row['order_id']));
    if (!excelId || excelId <= 0) continue;

    const statusRaw = String(row['order_status'] || '').trim();
    if (!statusRaw) continue;

    const excelCustId = Math.round(parseNum(row['customer_id']));
    const totalAmount = parseNum(row['total_amount']);
    const orderDate = parseDate(row['order_date']);
    const deliveryDate = parseDate(row['delivery_date']);
    const note = String(row['Note'] || '').trim() || null;

    validOrders.push({
      excelId, excelCustId, orderDate, totalAmount,
      status: parseStatus(statusRaw), deliveryDate, statusRaw, note,
    });
  }

  // Sort by date
  validOrders.sort((a, b) => {
    const ta = a.orderDate ? new Date(a.orderDate).getTime() : 0;
    const tb = b.orderDate ? new Date(b.orderDate).getTime() : 0;
    return ta - tb;
  });

  let count = 0;
  let skipped = 0;
  const orderCountByMonth = new Map<string, number>();

  for (const order of validOrders) {
    const shopId = customerShopMap.get(order.excelCustId);
    if (!shopId) { skipped++; continue; }

    // Generate order number
    const d = order.orderDate ? new Date(order.orderDate) : new Date();
    const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const monthKey = dateStr.substring(0, 6);
    const seq = (orderCountByMonth.get(monthKey) || 0) + 1;
    orderCountByMonth.set(monthKey, seq);
    const orderNumber = `ALD-${dateStr}-${String(seq).padStart(3, '0')}`;

    const totalAmountVND = Math.round(order.totalAmount);
    const paymentStatus = order.status === 'DELIVERED' ? 'PAID' : 'PENDING';
    const paidAmount = order.status === 'DELIVERED' ? totalAmountVND : 0;

    const id = randomUUID();
    try {
      await sql(
        `INSERT INTO "Order" (id, "orderNumber", "shopId", "shopSnapshot", status,
         "paymentMethod", "paymentStatus", "subtotalAmount", "discountAmount", "deliveryFee",
         "totalAmount", "paidAmount", "creditUsed", "customerNotes",
         "confirmedAt", "deliveredAt", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, '{}', $4, 'COD', $5, $6, 0, 0, $7, $8, 0, $9,
         $10, $11, $12, NOW())`,
        [
          id, orderNumber, shopId, order.status, paymentStatus,
          totalAmountVND, totalAmountVND, paidAmount, order.note,
          order.orderDate, order.deliveryDate, order.orderDate || new Date().toISOString(),
        ]
      );

      orderMap.set(order.excelId, id);
      count++;

      if (count % 25 === 0) console.log(`  ... imported ${count} orders`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ❌ Order ${order.excelId}: ${msg.substring(0, 100)}`);
    }
  }

  console.log(`  → Imported ${count} orders, skipped ${skipped} (no customer mapping)\n`);
}

// ============================================================
// STEP 5: IMPORT ORDER ITEMS
// ============================================================

async function importOrderItems(sheet: XLSX.WorkSheet) {
  console.log('📋 STEP 5: Importing Order Items...');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true });
  let count = 0;
  let skipped = 0;

  // Batch collect for bulk insert
  const items: Array<{
    orderId: string; productId: string; productName: string;
    productSku: string; unitPrice: number; quantity: number; totalPrice: number;
  }> = [];

  for (const row of rows) {
    const excelOrderId = Math.round(parseNum(row['order_id']));
    const productCode = String(row['product_code'] || '').trim().toUpperCase();
    const quantity = Math.round(parseNum(row['quantity']));

    if (!excelOrderId || !productCode || quantity <= 0) continue;

    const orderId = orderMap.get(excelOrderId);
    const productInfo = productMap.get(productCode);

    if (!orderId || !productInfo) { skipped++; continue; }

    const unitPrice = productInfo.basePrice;
    const totalPrice = unitPrice * quantity;

    items.push({
      orderId, productId: productInfo.id, productName: productInfo.name,
      productSku: productCode, unitPrice, quantity, totalPrice,
    });
  }

  // Insert in batches of 200
  const BATCH_SIZE = 200;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const values = batch.map((item, idx) => {
      const base = idx * 8;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    }).join(', ');

    const now = new Date().toISOString();
    const params = batch.flatMap(item => [
      randomUUID(), item.orderId, item.productId, item.productName,
      item.productSku, item.unitPrice, item.quantity, item.totalPrice,
    ]);

    try {
      await sql(
        `INSERT INTO "OrderItem" (id, "orderId", "productId", "productName", "productSku",
         "unitPrice", quantity, "totalPrice", "createdAt")
         VALUES ${values}`,
        [...params, now]
      );
      count += batch.length;
    } catch (err: unknown) {
      // Fallback: insert one by one if batch fails
      for (const item of batch) {
        try {
          await sql(
            `INSERT INTO "OrderItem" (id, "orderId", "productId", "productName", "productSku",
             "unitPrice", quantity, "totalPrice", "createdAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [randomUUID(), item.orderId, item.productId, item.productName,
             item.productSku, item.unitPrice, item.quantity, item.totalPrice]
          );
          count++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (count < 3 || count % 500 === 0) {
            console.log(`  ❌ OrderItem: ${msg.substring(0, 80)}`);
          }
          skipped++;
        }
      }
    }

    if (count % 500 === 0) console.log(`  ... imported ${count} order items`);
  }

  console.log(`  → Imported ${count} order items, skipped ${skipped}\n`);
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('🚀 ALADIN Excel → Neon PostgreSQL Import');
  console.log(`📊 Excel: ${EXCEL_PATH}`);
  console.log(`🗄️  DB: Neon PostgreSQL\n`);

  const wb = XLSX.readFile(EXCEL_PATH);

  try {
    await importCategories(wb.Sheets['ProductCategory']!);
    await importProducts(wb.Sheets['Product']!);
    await importCustomers(wb.Sheets['Customer']!);
    await importOrders(wb.Sheets['Order']!);
    await importOrderItems(wb.Sheets['OrderDetails']!);

    console.log('✅ IMPORT COMPLETE!');
    console.log('========================================');
    console.log(`  Categories:  ${categoryMap.size}`);
    console.log(`  Products:    ${productMap.size}`);
    console.log(`  Customers:   ${customerShopMap.size}`);
    console.log(`  Orders:      ${orderMap.size}`);

    // Final verification
    const tables = ['"Category"', '"Product"', '"User"', '"Shop"', '"Order"', '"OrderItem"'];
    console.log('\n📊 VERIFICATION:');
    for (const table of tables) {
      const res = await sql(`SELECT COUNT(*) as cnt FROM ${table}`);
      console.log(`  ${table.replace(/"/g, '')}: ${res.rows[0].cnt} rows`);
    }
  } catch (err) {
    console.error('\n❌ IMPORT FAILED:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();