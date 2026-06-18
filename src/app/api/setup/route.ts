import { NextResponse } from 'next/server';

// POST /api/setup — Seed the database with demo data
// Works with Neon PostgreSQL — persistent, no re-seeding needed after deploy
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

    const { seedDatabase } = await import('@/lib/seed');
    const result = await seedDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      environment: 'neon-postgresql',
      note: 'Data persists in Neon PostgreSQL. No re-seeding needed after deploy.',
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
    const productCount = await db.product.count().catch(() => 0);

    return NextResponse.json({
      seeded: productCount > 0,
      productCount,
      environment: 'neon-postgresql',
      message: productCount > 0
        ? 'Database already seeded. Use POST to re-seed.'
        : 'Database is empty. POST to /api/setup to seed.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, seeded: false }, { status: 500 });
  }
}