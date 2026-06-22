// ALADIN — Ensure Demo Users API
// POST /api/auth/ensure-demo-users
// Creates or updates all 5 demo accounts with correct scrypt password hashes
// This fixes issues where seed scripts used wrong hash algorithms (e.g., SHA-256 instead of scrypt)

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Pre-computed scrypt hash for "aladin123" — used by seed.ts
const SCRYPT_HASH = '8fc022ea8c4aa394ddc9115d7f8808e1:6530711c8439cc9fee88067eea16f152fafb06b00242992000d4dc6bc0081098733af4a32f8fd6d15e98838744579c6d7bad7285d9dd8e6715fc7ec900627b01';

const DEMO_USERS = [
  { phone: '0900000001', name: 'Aladin Admin', nameEn: 'Aladin Admin', role: 'ADMIN' },
  { phone: '0901234600', name: 'Cửa hàng Tạp hóa Minh', nameEn: 'Minh Grocery', role: 'SHOP_OWNER' },
  { phone: '0911111111', name: 'Nguyễn Văn An', nameEn: 'Nguyen Van An', role: 'SALES_REP' },
  { phone: '0922222222', name: 'Trần Văn B driver', nameEn: 'Tran Van B driver', role: 'DRIVER' },
  { phone: '0933333333', name: 'Lê Thị C broker', nameEn: 'Le Thi C broker', role: 'BROKER' },
  { phone: '0944444444', name: 'Nhà phân phối Bình Dương', nameEn: 'Binh Duong Distributor', role: 'DISTRIBUTOR' },
];

export async function POST() {
  try {
    const results: { phone: string; name: string; role: string; action: string }[] = [];

    for (const demo of DEMO_USERS) {
      const existing = await db.user.findUnique({ where: { phone: demo.phone } });

      if (existing) {
        // Fix password hash if it's not scrypt format (must contain ':')
        if (!existing.passwordHash || !existing.passwordHash.includes(':')) {
          await db.user.update({
            where: { phone: demo.phone },
            data: {
              passwordHash: SCRYPT_HASH,
              status: 'ACTIVE',
            },
          });
          results.push({ ...demo, action: 'updated (fixed password hash)' });
        } else if (existing.status !== 'ACTIVE') {
          await db.user.update({
            where: { phone: demo.phone },
            data: { status: 'ACTIVE' },
          });
          results.push({ ...demo, action: 'activated' });
        } else {
          results.push({ ...demo, action: 'already exists (OK)' });
        }
      } else {
        // Create the user with correct scrypt hash
        const newUser = await db.user.create({
          data: {
            phone: demo.phone,
            name: demo.name,
            nameEn: demo.nameEn,
            role: demo.role,
            status: 'ACTIVE',
            passwordHash: SCRYPT_HASH,
          },
        });
        results.push({ ...demo, action: 'created' });

        // For SHOP_OWNER, create a shop
        if (demo.role === 'SHOP_OWNER') {
          await db.shop.create({
            data: {
              userId: newUser.id,
              name: demo.name,
              nameEn: demo.nameEn,
              province: 'Binh Duong',
              shopType: 'TAPHOA',
              loyaltyTier: 'BRONZE',
            },
          });
        }

        // For BROKER, create a broker record
        if (demo.role === 'BROKER') {
          await db.broker.create({
            data: {
              userId: newUser.id,
              tier: 'WARD_LEVEL',
            },
          });
        }

        // For DISTRIBUTOR, create a distributor + DistributorUser link
        if (demo.role === 'DISTRIBUTOR') {
          const distributor = await db.distributor.create({
            data: {
              name: demo.name,
              nameEn: demo.nameEn,
              address: 'Bình Dương, Việt Nam',
              contactPerson: demo.name,
              contactPhone: demo.phone,
              commissionRate: 0.03,
              deliveryFeeShare: 0.5,
              isActive: true,
            },
          });
          await db.distributorUser.create({
            data: {
              userId: newUser.id,
              distributorId: distributor.id,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Demo users verified/fixed',
      results,
    });
  } catch (error) {
    console.error('[ENSURE DEMO USERS ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to ensure demo users.' } },
      { status: 500 }
    );
  }
}

// GET — Check which demo users exist and can log in
export async function GET() {
  try {
    const phones = DEMO_USERS.map(u => u.phone);
    const users = await db.user.findMany({
      where: { phone: { in: phones } },
      select: { phone: true, name: true, role: true, status: true, passwordHash: true },
    });

    const status = DEMO_USERS.map(demo => {
      const user = users.find(u => u.phone === demo.phone);
      if (!user) return { ...demo, exists: false, canLogin: false, reason: 'User not found in database' };
      if (!user.passwordHash || !user.passwordHash.includes(':')) return { ...demo, exists: true, canLogin: false, reason: 'Wrong password hash format (not scrypt)' };
      if (user.status !== 'ACTIVE') return { ...demo, exists: true, canLogin: false, reason: `Account status: ${user.status}` };
      return { ...demo, exists: true, canLogin: true, reason: 'OK' };
    });

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to check demo users.' } },
      { status: 500 }
    );
  }
}
