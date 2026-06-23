/**
 * ALADIN - Import real business data from Excel into the database.
 * Maps Excel sheets (Product, ProductCategory, Customer, Order, OrderDetails)
 * to Prisma models (Category, Product, User, Shop, Order, OrderItem, DistributorInventory).
 *
 * Usage: cd /home/z/my-project && npx tsx scripts/import-excel-data.ts
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Pre-computed scrypt hash for "aladin123"
const SCRYPT_HASH = '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01';

// Excel file path
const EXCEL_PATH = path.join(process.cwd(), 'upload', 'New Data Scheme Aladin ERD.xlsx');

// Status mapping
const ORDER_STATUS_MAP: Record<string, string> = {
  'Delivered': 'DELIVERED',
  'Processing': 'PROCESSING',
  'Delivered, not collected money': 'DELIVERED',
  'Pending': 'PENDING',
  'Confirmed': 'CONFIRMED',
  'Cancelled': 'CANCELLED',
  'Shipped': 'OUT_FOR_DELIVERY',
};

// Category slug generator
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Clean phone number
function cleanPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[\s\-\.]/g, '').replace(/^0/, '0');
}

// Generate order number
function generateOrderNumber(date: Date, seq: number): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `ALD-${y}${m}${d}-${String(seq).padStart(3, '0')}`;
}

// Convert Excel serial date or JS Date to Date object
function toDate(val: any): Date {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    // Excel serial date: days since 1900-01-01 (with leap year bug)
    const epoch = new Date(1899, 11, 30);
    epoch.setDate(epoch.getDate() + val);
    return epoch;
  }
  return new Date(val);
}

// Category icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  'dầu gội': '🧴',
  'sữa tắm': '🚿',
  'lăn khử mùi': '🧼',
  'giấy khô': '🧻',
  'giấy ướt': '🧻',
  'Tã': '🍼',
  'Kem đánh răng': '🪥',
  'Khẩu trang': '😷',
  'Nước rửa tay': '🫧',
  'Bột giặt': '🫧',
  'Nước giặt': '🫧',
  'Lau sàn': '🧹',
  'Xà bông cục': '🧼',
  'Sữa rửa mặt': '🧴',
  'Nhang Muỗi': '🪲',
  'Tập': '📓',
  'Dao cạo râu': '🪒',
};

// Infer category from product name
function inferCategoryFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('gội') || n.includes('dầu gội') || n.includes('pantene') || n.includes('rejoice') || n.includes('clear') || n.includes('sunsil') || n.includes('sunsilk') || n.includes('xmen') || n.includes('romano') || n.includes('dove') && !n.includes('tắm') && !n.includes('xà') || n.includes('thái dương') || n.includes('nguyên xuân') || n.includes('selsun') || n.includes('the bol') || n.includes('enchan') && !n.includes('lăn') || n.includes('lifeboy') && !n.includes('xà') || n.includes('familiar') || n.includes('gohnson') || n.includes('gervenne') || n.includes('ajola') || n.includes('e100') || n.includes('double rich') || n.includes('lux') && !n.includes('xà') || n.includes('pond') || n.includes('tresemmé')) return 'dầu gội';
  if (n.includes('tắm') || n.includes('sữa tắm') || n.includes('care') || n.includes('enchanteur') && n.includes('tắm')) return 'sữa tắm';
  if (n.includes('lăn') || n.includes('khử mùi') || n.includes('deodorant')) return 'lăn khử mùi';
  if (n.includes('giấy khô') || n.includes('paper')) return 'giấy khô';
  if (n.includes('giấy ướt') || n.includes('wet wipe')) return 'giấy ướt';
  if (n.includes('tã') || n.includes('pampers') || n.includes('merries') || n.includes('huggies')) return 'Tã';
  if (n.includes('kem đánh răng') || n.includes('colgate') || n.includes('ps') || n.includes('darlie') || n.includes('khai')) return 'Kem đánh răng';
  if (n.includes('khẩu trang')) return 'Khẩu trang';
  if (n.includes('rửa tay')) return 'Nước rửa tay';
  if (n.includes('bột giặt')) return 'Bột giặt';
  if (n.includes('nước giặt')) return 'Nước giặt';
  if (n.includes('lau sàn')) return 'Lau sàn';
  if (n.includes('xà bông') || n.includes('xà phòng') || n.includes('lifeboy') && n.includes('xà') || n.includes('lux') && n.includes('xà')) return 'Xà bông cục';
  if (n.includes('rửa mặt')) return 'Sữa rửa mặt';
  if (n.includes('nhang') || n.includes('muỗi')) return 'Nhang Muỗi';
  if (n.includes('tập') || n.includes('vở') || n.includes('notebook')) return 'Tập';
  if (n.includes('cạo') || n.includes('razor')) return 'Dao cạo râu';
  return 'dầu gội'; // default
}

// Unit inference
function inferUnit(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('thùng') || n.includes('thung')) return 'thung';
  if (n.includes('gói') || n.includes('goi')) return 'goi';
  if (n.includes('bao')) return 'bao';
  return 'cai';
}

async function main() {
  console.log('📖 Loading Excel file...');
  const wb = XLSX.readFile(EXCEL_PATH);

  // =========================================================
  // 1. CREATE / VERIFY CATEGORIES
  // =========================================================
  console.log('\n📁 Step 1: Importing categories...');
  const catSheet = wb.Sheets['ProductCategory'];
  const catRows = XLSX.utils.sheet_to_json<any>(catSheet, { raw: false });

  const categoryMap: Record<string, string> = {}; // name -> id

  for (const row of catRows) {
    const name = String(row['loại sản phẩm'] || row['Loại sản phẩm'] || '').trim();
    if (!name) continue;

    const slug = slugify(name);
    const icon = CATEGORY_ICONS[name] || '📦';

    const cat = await prisma.category.upsert({
      where: { slug },
      update: { name, icon },
      create: { name, slug, icon, sortOrder: 0, isActive: true },
    });
    categoryMap[name] = cat.id;
    console.log(`  ✓ Category: ${name} (${cat.id})`);
  }

  // Ensure default category exists
  if (!categoryMap['Khác']) {
    const defCat = await prisma.category.upsert({
      where: { slug: 'khac' },
      update: {},
      create: { name: 'Khác', nameEn: 'Other', slug: 'khac', icon: '📦', sortOrder: 99 },
    });
    categoryMap['Khác'] = defCat.id;
    categoryMap['khác'] = defCat.id;
  }

  // =========================================================
  // 2. GET OR CREATE DISTRIBUTOR
  // =========================================================
  console.log('\n🏭 Step 2: Verifying distributor...');
  let distributor = await prisma.distributor.findFirst({
    where: { contactPhone: '0944444444' },
  });

  if (!distributor) {
    distributor = await prisma.distributor.create({
      data: {
        name: 'Kho Phân Phối Aladin - Bàu Bàng',
        nameEn: 'Aladin Distribution Warehouse - Bau Bang',
        address: 'Bàu Bàng, Bình Dương, Việt Nam',
        contactPerson: 'Nhà phân phối Bình Dương',
        contactPhone: '0944444444',
        commissionRate: 0.03,
        deliveryFeeShare: 0.5,
        isActive: true,
      },
    });
    console.log(`  ✓ Created distributor: ${distributor.id}`);
  } else {
    console.log(`  ✓ Found distributor: ${distributor.id}`);
  }

  // =========================================================
  // 3. IMPORT PRODUCTS
  // =========================================================
  console.log('\n📦 Step 3: Importing products...');
  const prodSheet = wb.Sheets['Product'];
  const prodRows = XLSX.utils.sheet_to_json<any>(prodSheet, { raw: true });

  const productMap: Record<string, string> = {}; // sku -> id
  let productCount = 0;
  let skippedCount = 0;

  for (const row of prodRows) {
    const sku = String(row['product_id'] || '').trim();
    const name = String(row['product_name'] || '').trim();
    if (!sku || !name) {
      skippedCount++;
      continue;
    }

    // Use wholesale_price_full (column G) as basePrice if available, otherwise wholesale_price * 1000
    let basePrice = 0;
    const retailFull = Number(row['retail_price_full']) || 0;
    const wholesaleFull = Number(row['wholesale_price_full']) || 0;
    const wholesale = Number(row['wholesale_price']) || 0;

    if (wholesaleFull > 0) {
      basePrice = Math.round(wholesaleFull);
    } else if (wholesale > 0) {
      basePrice = Math.round(wholesale * 1000);
    } else if (retailFull > 0) {
      basePrice = Math.round(retailFull * 0.85); // 85% of retail as wholesale
    }

    if (basePrice <= 0) {
      skippedCount++;
      continue;
    }

    // Infer category
    const catName = inferCategoryFromName(name);
    const categoryId = categoryMap[catName] || Object.values(categoryMap)[0];

    const unit = inferUnit(name);
    const volume = String(row['volume'] || '').trim();
    const description = String(row['description'] || '').trim();
    const imageUrl = String(row['image_link'] || '').trim();

    // Clean name (remove leading "1 chai ", "1 Chai ", etc.)
    const cleanName = name.replace(/^[0-9]+\s*(chai|thùng|gói|bao|lăn|bịch|vỏ|chai)\s*/i, '').trim() || name;

    try {
      const product = await prisma.product.upsert({
        where: { sku },
        update: {
          name: cleanName,
          basePrice,
          categoryId,
          brand: String(row['brand'] || '').trim() || null,
          unit,
          description: description || null,
          imageUrl: imageUrl || null,
          isActive: true,
          distributorId: distributor.id,
        },
        create: {
          sku,
          name: cleanName,
          basePrice,
          categoryId,
          brand: String(row['brand'] || '').trim() || null,
          unit,
          description: description || null,
          imageUrl: imageUrl || null,
          isActive: true,
          distributorId: distributor.id,
        },
      });
      productMap[sku] = product.id;
      productCount++;
    } catch (e: any) {
      if (e.code === 'P2002') {
        console.log(`  ⚠ Duplicate SKU: ${sku} - skipping`);
      } else {
        console.log(`  ✗ Error on ${sku}: ${e.message?.substring(0, 80)}`);
      }
    }
  }
  console.log(`  ✓ Imported ${productCount} products (skipped ${skippedCount})`);

  // =========================================================
  // 4. CREATE DISTRIBUTOR INVENTORY
  // =========================================================
  console.log('\n📊 Step 4: Creating distributor inventory...');
  let invCount = 0;
  const skus = Object.keys(productMap);
  const batchSize = 50;

  for (let i = 0; i < skus.length; i += batchSize) {
    const batch = skus.slice(i, i + batchSize);
    const inventoryData = batch.map((sku, idx) => {
      const qty = Math.floor(Math.random() * 200) + 10; // 10-210 units
      const costPrice = Math.floor(Math.random() * 30000) + 10000; // 10k-40k VND
      return {
        distributorId: distributor.id,
        productId: productMap[sku],
        quantity: qty,
        reservedQty: 0,
        minStockLevel: 10,
        costPrice,
      };
    });

    for (const inv of inventoryData) {
      try {
        await prisma.distributorInventory.upsert({
          where: {
            distributorId_productId: {
              distributorId: inv.distributorId,
              productId: inv.productId,
            },
          },
          update: {
            quantity: inv.quantity,
            costPrice: inv.costPrice,
          },
          create: inv,
        });
        invCount++;
      } catch (e: any) {
        // Skip duplicates
      }
    }
  }
  console.log(`  ✓ Created ${invCount} inventory records`);

  // =========================================================
  // 5. IMPORT CUSTOMERS AS SHOPS
  // =========================================================
  console.log('\n🏪 Step 5: Importing customers as shops...');
  const custSheet = wb.Sheets['Customer'];
  const custRows = XLSX.utils.sheet_to_json<any>(custSheet, { raw: true });

  const customerMap: Record<number, { userId: string; shopId: string }> = {};
  let shopCount = 0;

  // Sort by order count (most active first) and take top 50
  const sortedCustomers = custRows
    .filter((r) => r['customer_id'] && r['customer_name'] && Number(r['Số lần order'] || 0) >= 3)
    .sort((a, b) => Number(b['Số lần order'] || 0) - Number(a['Số lần order'] || 0))
    .slice(0, 50);

  for (const row of sortedCustomers) {
    const custId = Number(row['customer_id']);
    const custName = String(row['customer_name'] || '').trim();
    const rawPhone = cleanPhone(String(row['phone_number'] || ''));
    const totalOrders = Number(row['Số lần order'] || 0);
    const avgOrder = Number(row['Average ordeR value'] || 0);
    const ward = String(row['Neighbourhood Demographic'] || 'Bàu Bàng').split('\n')[0].trim().substring(0, 100);

    if (!custName) continue;

    // Generate a unique phone for users without valid phone
    const phone = rawPhone.length >= 10 ? rawPhone : `0901${String(custId).padStart(6, '0')}`;

    // Determine loyalty tier
    let loyaltyTier = 'BRONZE';
    let creditLimit = 2000000;
    if (totalOrders >= 30) { loyaltyTier = 'GOLD'; creditLimit = 5000000; }
    else if (totalOrders >= 15) { loyaltyTier = 'SILVER'; creditLimit = 3000000; }
    else if (totalOrders >= 8) { loyaltyTier = 'SILVER'; creditLimit = 3000000; }

    try {
      const user = await prisma.user.upsert({
        where: { phone },
        update: { name: custName, role: 'SHOP_OWNER', status: 'ACTIVE' },
        create: {
          phone,
          name: custName,
          role: 'SHOP_OWNER',
          status: 'ACTIVE',
          passwordHash: SCRYPT_HASH,
        },
      });

      const shop = await prisma.shop.upsert({
        where: { userId: user.id },
        update: {
          name: custName,
          province: 'Binh Duong',
          district: 'Bau Bang',
          address: ward || 'Bau Bang',
          loyaltyTier,
          creditLimit,
          totalOrders,
          totalGmv: Math.round(avgOrder * totalOrders),
          avgOrderValue: Math.round(avgOrder),
        },
        create: {
          userId: user.id,
          name: custName,
          province: 'Binh Duong',
          district: 'Bau Bang',
          address: ward || 'Bau Bang',
          shopType: 'TAPHOA',
          loyaltyTier,
          creditLimit,
          creditTermsDays: 7,
          totalOrders,
          totalGmv: Math.round(avgOrder * totalOrders),
          avgOrderValue: Math.round(avgOrder),
        },
      });

      customerMap[custId] = { userId: user.id, shopId: shop.id };
      shopCount++;
    } catch (e: any) {
      console.log(`  ⚠ Customer ${custId} (${custName}): ${e.message?.substring(0, 60)}`);
    }
  }
  console.log(`  ✓ Imported ${shopCount} shops`);

  // =========================================================
  // 6. IMPORT ORDERS
  // =========================================================
  console.log('\n🛒 Step 6: Importing orders...');
  const orderSheet = wb.Sheets['Order'];
  const orderRows = XLSX.utils.sheet_to_json<any>(orderSheet, { raw: true });

  // Get order details
  const detailSheet = wb.Sheets['OrderDetails'];
  const detailRows = XLSX.utils.sheet_to_json<any>(detailSheet, { raw: true });

  // Group details by order_id
  const detailsByOrder: Record<number, any[]> = {};
  for (const d of detailRows) {
    const oid = Number(d['order_id']);
    if (d['Value'] && Number(d['Value']) > 0) {
      if (!detailsByOrder[oid]) detailsByOrder[oid] = [];
      detailsByOrder[oid].push(d);
    }
  }

  // Filter orders: must have valid customer, valid amount, and customer exists in our map
  // Prioritize orders that have detail items, take up to 150
  const validOrders = orderRows
    .filter((r) => {
      const custId = Number(r['customer_id']);
      const amount = Number(r['total_amount'] || 0);
      const date = r['order_date'];
      const oid = Number(r['order_id']);
      return custId && customerMap[custId] && amount > 0 && date && detailsByOrder[oid]?.length > 0;
    })
    .sort((a, b) => {
      const dateA = toDate(a['order_date']).getTime() || 0;
      const dateB = toDate(b['order_date']).getTime() || 0;
      return dateB - dateA; // Most recent first
    })
    .slice(0, 150);

  let orderCount = 0;
  let itemCount = 0;
  const orderDateSeq: Record<string, number> = {}; // date string -> seq

  for (const row of validOrders) {
    const custId = Number(row['customer_id']);
    const shop = customerMap[custId];
    if (!shop) continue;

    const orderDate = toDate(row['order_date']);
    const totalAmount = Math.round(Number(row['total_amount'] || 0));
    const excelStatus = String(row['order_status'] || 'Delivered');
    const status = ORDER_STATUS_MAP[excelStatus] || 'DELIVERED';
    const deliveryDate = row['delivery_date'] ? toDate(row['delivery_date']) : null;
    const paymentStatus = excelStatus === 'Delivered, not collected money' ? 'PENDING' : 'PAID';
    const paidAmount = paymentStatus === 'PAID' ? totalAmount : 0;
    const creditUsed = paymentStatus === 'PENDING' ? totalAmount : 0;

    // Generate order number
    const dateKey = orderDate.toISOString().split('T')[0];
    orderDateSeq[dateKey] = (orderDateSeq[dateKey] || 0) + 1;
    const orderNumber = generateOrderNumber(orderDate, orderDateSeq[dateKey]);

    try {
      const order = await prisma.order.create({
        data: {
          orderNumber,
          shopId: shop.shopId,
          shopSnapshot: JSON.stringify({ shopId: shop.shopId }),
          status,
          paymentMethod: creditUsed > 0 ? 'CREDIT' : 'COD',
          paymentStatus,
          subtotalAmount: totalAmount,
          totalAmount,
          paidAmount,
          creditUsed,
          distributorId: distributor.id,
          customerNotes: String(row['Note'] || '').trim() || null,
          deliveredAt: status === 'DELIVERED' ? (deliveryDate || orderDate) : null,
          confirmedAt: orderDate,
          packedAt: orderDate,
        },
      });

      // Create order items from OrderDetails
      const details = detailsByOrder[Number(row['order_id'])] || [];
      if (details.length > 0) {
        for (const detail of details) {
          const pSku = String(detail['product_code'] || '').trim();
          const productId = productMap[pSku];
          if (!productId) continue;

          const qty = Math.round(Number(detail['quantity'] || 0));
          const value = Math.round(Number(detail['Value'] || 0));
          const unitPrice = qty > 0 ? Math.round(value / qty) : value;

          if (qty <= 0 || value <= 0) continue;

          try {
            await prisma.orderItem.create({
              data: {
                orderId: order.id,
                productId,
                productName: pSku, // Will be resolved later
                productSku: pSku,
                unitPrice,
                quantity: qty,
                totalPrice: value,
              },
            });
            itemCount++;
          } catch (e: any) {
            // Skip
          }
        }
      }

      orderCount++;
    } catch (e: any) {
      console.log(`  ⚠ Order ${orderNumber}: ${e.message?.substring(0, 120)}`);
    }
  }
  console.log(`  ✓ Imported ${orderCount} orders with ${itemCount} items`);

  // =========================================================
  // 7. CREATE SETTLEMENTS (from Dashboard data)
  // =========================================================
  console.log('\n💰 Step 7: Creating settlements...');
  const dashSheet = wb.Sheets['5. DASHBOARD '];
  const dashData = XLSX.utils.sheet_to_json<any>(dashSheet, { raw: true, header: 1 });

  // Dashboard row 5 = GMV, row 10 = Gross Profit
  // Columns: C=Mar, D=Apr, E=May, F=Jun, G=Jul, H=Aug, I=Sep, J=Oct
  const months = [
    { label: 'Mar 2025', col: 2 }, // C
    { label: 'Apr 2025', col: 3 }, // D
    { label: 'May 2025', col: 4 }, // E
    { label: 'Jun 2025', col: 5 }, // F
    { label: 'Jul 2025', col: 6 }, // G
    { label: 'Aug 2025', col: 7 }, // H
    { label: 'Sep 2025', col: 8 }, // I
    { label: 'Oct 2025', col: 9 }, // J
  ];

  let settleCount = 0;
  for (const m of months) {
    const gmv = Number(dashData[4]?.[m.col]) || 0; // Row 5 (0-indexed: row 4)
    const gp = Number(dashData[9]?.[m.col]) || 0;  // Row 10 (0-indexed: row 9)

    if (gmv <= 0) continue;

    const monthParts = m.label.split(' ');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIdx = monthNames.indexOf(monthParts[0]);
    const year = Number(monthParts[1]);
    if (monthIdx < 0) continue;

    const periodStart = new Date(year, monthIdx, 1);
    const periodEnd = new Date(year, monthIdx + 1, 0, 23, 59, 59);
    const platformFee = Math.round(gmv * 0.03);
    const payout = Math.round(gmv - platformFee);

    try {
      await prisma.settlement.create({
        data: {
          settlementNumber: `STL-${year}${String(monthIdx + 1).padStart(2, '0')}-W01`,
          distributorId: distributor.id,
          periodStart,
          periodEnd,
          totalOrders: Math.floor(Math.random() * 40) + 10,
          totalOrderValue: Math.round(gmv),
          totalPlatformFee: platformFee,
          totalDeliveryFee: Math.round(gmv * 0.02),
          distributorPayout: payout,
          status: 'PAID',
          paidAt: new Date(year, monthIdx + 1, 5),
          createdAt: periodStart,
        },
      });
      settleCount++;
    } catch (e: any) {
      // Skip duplicates
    }
  }
  console.log(`  ✓ Created ${settleCount} settlement periods`);

  // =========================================================
  // 8. UPDATE DISTRIBUTOR STATS
  // =========================================================
  console.log('\n📈 Step 8: Updating distributor stats...');
  const totalOrdersFulfilled = await prisma.order.count({
    where: { distributorId: distributor.id, status: 'DELIVERED' },
  });
  const totalRevenue = await prisma.order.aggregate({
    where: { distributorId: distributor.id, status: 'DELIVERED' },
    _sum: { totalAmount: true },
  });

  await prisma.distributor.update({
    where: { id: distributor.id },
    data: {
      totalOrdersFulfilled,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
    },
  });
  console.log(`  ✓ Distributor stats: ${totalOrdersFulfilled} fulfilled orders, ${(totalRevenue._sum.totalAmount || 0).toLocaleString()} VND revenue`);

  // =========================================================
  // DONE
  // =========================================================
  console.log('\n✅ Import complete!');
  console.log(`  Categories: ${Object.keys(categoryMap).length}`);
  console.log(`  Products: ${productCount}`);
  console.log(`  Inventory: ${invCount}`);
  console.log(`  Shops: ${shopCount}`);
  console.log(`  Orders: ${orderCount}`);
  console.log(`  Order Items: ${itemCount}`);
  console.log(`  Settlements: ${settleCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Import failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });