import { Pool } from 'pg';
import * as fs from 'fs';
import * as crypto from 'crypto';

const envContent = fs.readFileSync('.env', 'utf-8');
const envLine = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='));
const DATABASE_URL = envLine ? envLine.replace(/^DATABASE_URL=/, '').trim() : '';

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
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const password = 'aladin123';
  const hash = await hashPassword(password);

  console.log(`Generated scrypt hash for 'aladin123': ${hash.substring(0, 20)}...`);

  const result = await pool.query(
    `UPDATE "User" SET "passwordHash" = $1 WHERE phone = '0900000001' AND role = 'ADMIN'`,
    [hash]
  );

  console.log(`Updated ${result.rowCount} admin user(s) with correct scrypt password`);
  console.log('Login: 0900000001 / aladin123');

  await pool.end();
}

main();