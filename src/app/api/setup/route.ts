import { NextResponse } from 'next/server';

// POST /api/setup — Seed the database with demo data (for Vercel deployment)
// Call this once after deploying to populate the database
export async function POST(request: Request) {
  try {
    const { secret } = await request.json().catch(() => ({}));

    // Simple protection against accidental runs
    if (secret !== process.env.SETUP_SECRET && process.env.SETUP_SECRET) {
      return NextResponse.json({ error: 'Invalid setup secret' }, { status: 403 });
    }

    // Dynamic import to avoid bundling issues
    const { seedDatabase } = await import('@/lib/seed');

    const result = await seedDatabase();

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Seed failed:', error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// GET /api/setup — Check if database has data
export async function GET() {
  try {
    const { db } = await import('@/lib/db');
    const productCount = await db.product.count();

    return NextResponse.json({
      seeded: productCount > 0,
      productCount,
      message: productCount > 0
        ? 'Database already seeded. Use POST to re-seed.'
        : 'Database is empty. POST to /api/setup to seed.',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}