// GET /api/ai/forecast — Demand forecasting
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '14');

    let distId = getDistributorId(user);
    if (!distId && user.role === ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', ''), { status: 400 });
    }

    // Get daily order quantities for last 30 days (all distributors if admin)
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Use Prisma.sql template for parameterized query — prevents SQL injection
    const conditions: Prisma.Sql[] = [
      Prisma.sql`o."status" = 'DELIVERED' AND o."createdAt" >= ${thirtyDaysAgo.toISOString()}::timestamptz`,
    ];
    if (distId) {
      conditions.unshift(Prisma.sql`o."distributorId" = ${distId} AND`);
    }

    const dailyData: any[] = await db.$queryRaw`
      SELECT DATE(o."createdAt")::date as day, COALESCE(SUM(oi.quantity), 0)::int as qty
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o.id
      ${Prisma.join(conditions, Prisma.raw(' '))}
      GROUP BY DATE(o."createdAt")::date
      ORDER BY day
    `;

    // Simple 7-day moving average forecast
    const forecast = [];
    const avgQty = dailyData.length > 0 ? dailyData.reduce((s, d) => s + d.qty, 0) / dailyData.length : 0;
    for (let i = 1; i <= days; i++) {
      const date = new Date(); date.setDate(date.getDate() + i);
      // Simple: use weighted average (recent 7 days if available)
      const recent7 = dailyData.slice(-7);
      const recentAvg = recent7.length > 0 ? recent7.reduce((s, d) => s + d.qty, 0) / recent7.length : avgQty;
      // Add slight trend (5% growth per week as heuristic)
      const trendFactor = 1 + (i / 7) * 0.05;
      forecast.push({
        date: date.toISOString().slice(0, 10),
        predictedDemand: Math.round(recentAvg * trendFactor),
        confidence: Math.max(0.5, 0.95 - (i * 0.03)),
      });
    }

    return NextResponse.json(successResponse({ forecast, historicalData: dailyData }));
  } catch (error) {
    console.error('[FORECAST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}