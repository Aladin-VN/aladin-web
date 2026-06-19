// Set aladin123 as default password for ALL non-admin users
import { Pool } from 'pg';

const DATABASE_URL = 'postgresql://neondb_owner:npg_4kRzjDV8pTEA@ep-twilight-river-aotfef9p-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

async function hashScrypt(password: string, saltHex: string): Promise<string> {
  const crypto = await import('crypto');
  const salt = Buffer.from(saltHex, 'hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (err, key) => {
      if (err) reject(err);
      else resolve(saltHex + ':' + key.toString('hex'));
    });
  });
}

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // Get all users without proper password (null or empty)
  const { rows } = await pool.query(`
    SELECT id, phone, "passwordHash"
    FROM "User"
    WHERE "deletedAt" IS NULL
    ORDER BY phone
  `);

  console.log(`Found ${rows.length} users total`);

  const crypto = await import('crypto');
  let updated = 0;

  for (const user of rows) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await hashScrypt('aladin123', salt);

    await pool.query(`UPDATE "User" SET "passwordHash" = $1 WHERE id = $2`, [hash, user.id]);
    updated++;
    if (updated <= 5 || updated === rows.length) {
      console.log(`  ${updated}. ${user.phone} -> aladin123`);
    } else if (updated === 6) {
      console.log(`  ... (${rows.length - 6} more)`);
    }
  }

  console.log(`\nDone! Updated ${updated} users with password: aladin123`);
  await pool.end();
}

main().catch(console.error);