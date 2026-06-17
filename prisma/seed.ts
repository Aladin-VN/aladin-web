// ALADIN Database Seed Script — CLI entry point
// Run: DATABASE_URL=file:./db/custom.db npx tsx prisma/seed.ts

import { seedDatabase } from '../src/lib/seed';

async function main() {
  console.log('🌱 Seeding ALADIN database (full workflow)...\n');
  const result = await seedDatabase();

  console.log('\n🎉 Full seed completed!\n');
  console.log('📋 DATA SUMMARY:');
  console.log(`  📁 Categories:        ${result.categories}`);
  console.log(`  📍 Wards:             ${result.wards}`);
  console.log(`  🏭 Manufacturers:     ${result.manufacturers}`);
  console.log(`  🚚 Distributors:      ${result.distributors}`);
  console.log(`  👤 Users:             ${result.users} (admin + sales_rep + 2 drivers + 1 broker + 8 shops)`);
  console.log(`  🏪 Shops:             ${result.shops}`);
  console.log(`  📦 Products:          ${result.products}`);
  console.log(`  🏷️  Promotions:        ${result.promotions}`);
  console.log(`  👥 Group Deals:       ${result.groupDeals}`);
  console.log(`  📋 Orders:            ${result.orders}`);
  console.log(`  📦 Shipments:         ${result.shipments}`);
  console.log('\n🔐 LOGIN CREDENTIALS:');
  console.log('  Admin:    0901234567  (password: aladin123)');
  console.log('  Shop 0:   0901234600  (Tạp Hóa Hạnh Phúc — GOLD)');
  console.log('  Shop 1:   0901234601  (Tâm An — PLATINUM)');
  console.log('  Shop 2:   0901234602  (Bình Minh — SILVER)');
  console.log('  Shop 3:   0901234603  (Phước Long — PLATINUM, LOCKED)');
  console.log('  Shop 4:   0901234604  (Lộc Phát — BRONZE, OVERDUE)');
  console.log('  Shop 5:   0901234605  (Hoa Mai — GOLD)');
  console.log('  Shop 6:   0901234606  (Phương Thảo — SILVER)');
  console.log('  Shop 7:   0901234607  (Thành Đạt — GOLD)');
  console.log('  Sales:    0911111111');
  console.log('  Driver1:  0922222222');
  console.log('  Driver2:  0922333333');
  console.log('  Broker:   0933333333');
  console.log('\n💡 TIP: Use Shop 0 (0901234600) to see the fullest workflow experience!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    const { db } = await import('../src/lib/db');
    await db.$disconnect();
  });