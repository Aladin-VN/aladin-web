// Set default password 'aladin123' for ALL users in Neon PostgreSQL
// Run: npx tsx scripts/set-default-passwords.ts

import { config } from 'dotenv';
config({ override: true });

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, key) => (err ? reject(err) : resolve(key))
    );
  });
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  const db = new PrismaClient();
  
  try {
    // Count users
    const totalUsers = await db.user.count();
    console.log(`Total users in DB: ${totalUsers}`);
    
    // Get all users
    const users = await db.user.findMany({
      select: { id: true, phone: true, role: true, name: true },
    });
    
    console.log(`Setting password 'aladin123' for ${users.length} users...\n`);
    
    // Hash the default password ONCE to use for all users (same password, different salt each time)
    let updated = 0;
    let failed = 0;
    
    // Process in batches of 20
    for (let i = 0; i < users.length; i += 20) {
      const batch = users.slice(i, i + 20);
      const updates = batch.map(async (user) => {
        try {
          const passwordHash = await hashPassword('aladin123');
          await db.user.update({
            where: { id: user.id },
            data: { passwordHash, status: 'ACTIVE' },
          });
          return { phone: user.phone, role: user.role, name: user.name, success: true };
        } catch (err) {
          return { phone: user.phone, error: String(err), success: false };
        }
      });
      
      const results = await Promise.all(updates);
      for (const r of results) {
        if (r.success) {
          updated++;
          console.log(`  ✓ ${r.phone} (${r.role}) — ${r.name}`);
        } else {
          failed++;
          console.log(`  ✗ ${r.phone} — ${(r as any).error}`);
        }
      }
    }
    
    console.log(`\n=== DONE ===`);
    console.log(`Updated: ${updated}`);
    console.log(`Failed: ${failed}`);
    
    // Verify: count users with passwordHash
    const withPassword = await db.user.count({ where: { passwordHash: { not: null } } });
    console.log(`Users with password set: ${withPassword}/${totalUsers}`);
    
    // List some sample users for verification
    console.log('\n=== SAMPLE USERS FOR LOGIN TEST ===');
    const sampleUsers = await db.user.findMany({
      where: { role: { in: ['SHOP_OWNER', 'SALES_REP'] } },
      select: { phone: true, role: true, name: true },
      take: 10,
    });
    for (const u of sampleUsers) {
      console.log(`  Phone: ${u.phone} | Role: ${u.role} | Name: ${u.name} | Password: aladin123`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.$disconnect();
  }
}

main();