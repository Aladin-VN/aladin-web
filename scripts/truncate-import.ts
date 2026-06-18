import { Pool } from 'pg';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const envLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='));
const DATABASE_URL = envLine ? envLine.replace(/^DATABASE_URL=/, '').trim() : '';

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Truncate all tables in correct FK order (most dependent first)
  const tables = [
    '"OrderItem"', '"Payment"', '"Transaction"', '"Shipment"',
    '"GroupDealParticipant"', '"GroupDeal"',
    '"MerchandisingAudit"', '"PromotionItem"', '"Promotion"',
    '"Order"', '"ChatMessage"', '"AuditLog"',
    '"Shop"', '"Broker"',
    '"Product"', '"Distributor"', '"Manufacturer"',
    '"User"', '"Ward"', '"Category"', '"PlatformSetting"'
  ];

  for (const t of tables) {
    try {
      const res = await pool.query(`DELETE FROM ${t}`);
      console.log(`  ${t}: deleted ${res.rowCount} rows`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${t}: SKIPPED - ${msg.substring(0, 80)}`);
    }
  }

  console.log('\nDone — all tables truncated');
  await pool.end();
}

main();