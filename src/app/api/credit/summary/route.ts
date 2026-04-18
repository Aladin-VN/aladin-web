// ALADIN Platform Credit Summary API
// GET /api/credit/summary — Platform-wide credit metrics dashboard

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP'])) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Admin or Sales Rep access required'),
        { status: 403 }
      );
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // ---- Aggregate all key metrics in parallel ----

    // Total exposure: sum of all creditBalance
    const totalExposure = await db.shop.aggregate({
      _sum: { creditBalance: true },
    });

    // Overdue shops: count and amount
    const overdueShops = await db.shop.findMany({
      where: { creditStatus: 'OVERDUE' },
      select: { id: true, creditBalance: true },
    });
    const overdueCount = overdueShops.length;
    const overdueAmount = overdueShops.reduce((sum, s) => sum + s.creditBalance, 0);

    // Locked shops count
    const lockedCount = await db.shop.count({
      where: { creditStatus: 'LOCKED' },
    });

    // Active credit lines
    const activeCount = await db.shop.count({
      where: { creditStatus: 'ACTIVE' },
    });

    // Total shops with any credit system
    const totalShops = await db.shop.count();

    // Total credit ever used (sum of all CREDIT_USED amounts where amount > 0)
    const totalCreditUsed = await db.transaction.aggregate({
      where: {
        type: 'CREDIT_USED',
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });

    // Total repaid (sum of absolute REPAYMENT amounts)
    const totalRepaid = await db.transaction.aggregate({
      where: {
        type: 'REPAYMENT',
      },
      _sum: { amount: true },
    });

    // Collection rate
    const collectionRate = totalCreditUsed._sum.amount && totalCreditUsed._sum.amount > 0
      ? Math.round((Math.abs(totalRepaid._sum.amount || 0) / totalCreditUsed._sum.amount) * 100)
      : 100;

    // This month: new credit extended
    const monthlyCreditExtended = await db.transaction.aggregate({
      where: {
        type: 'CREDIT_USED',
        amount: { gt: 0 },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    });

    // This month: total repaid
    const monthlyRepaid = await db.transaction.aggregate({
      where: {
        type: 'REPAYMENT',
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    });

    // Top 5 shops by credit exposure
    const topExposureShops = await db.shop.findMany({
      where: { creditBalance: { gt: 0 } },
      orderBy: { creditBalance: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        district: true,
        creditLimit: true,
        creditBalance: true,
        creditStatus: true,
      },
    });

    return NextResponse.json(
      successResponse({
        exposure: {
          total: totalExposure._sum.creditBalance || 0,
          overdueAmount,
          overdueCount,
          lockedCount,
        },
        creditLines: {
          total: totalShops,
          active: activeCount,
          overdue: overdueCount,
          locked: lockedCount,
        },
        collection: {
          totalUsed: totalCreditUsed._sum.amount || 0,
          totalRepaid: Math.abs(totalRepaid._sum.amount || 0),
          collectionRate,
        },
        thisMonth: {
          creditExtended: monthlyCreditExtended._sum.amount || 0,
          totalRepaid: Math.abs(monthlyRepaid._sum.amount || 0),
        },
        topExposureShops: topExposureShops.map((s) => ({
          shopId: s.id,
          shopName: s.name,
          district: s.district,
          creditUsed: s.creditBalance,
          creditLimit: s.creditLimit,
          creditStatus: s.creditStatus,
        })),
      })
    );
  } catch (error) {
    console.error('[CREDIT SUMMARY ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch credit summary'),
      { status: 500 }
    );
  }
}
