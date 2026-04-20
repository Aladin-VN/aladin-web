// ALADIN Broker Territories API
// GET /api/brokers/territories — Ward coverage, territory management

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const district = searchParams.get('district') || '';

    // Get all wards with broker assignments
    const wards = await db.ward.findMany({
      where: district ? { district: { contains: district } } : {},
      include: {
        brokers: {
          include: {
            user: {
              select: { id: true, name: true, phone: true, status: true },
            },
          },
        },
        _count: {
          select: { shops: true },
        },
      },
      orderBy: [{ district: 'asc' }, { name: 'asc' }],
    });

    // Get unique districts
    const districts = await db.ward.groupBy({
      by: ['district'],
      _count: { id: true },
    });

    // Transform wards into territory data
    const territories = wards.map(w => ({
      wardId: w.id,
      wardName: w.name,
      wardNameEn: w.nameEn,
      district: w.district,
      shopCount: w._count.shops,
      assignedBrokers: w.brokers.map(b => ({
        brokerId: b.id,
        name: b.user.name,
        phone: b.user.phone,
        tier: b.tier,
        commissionRate: b.commissionRate,
        status: b.user.status,
        totalShopsReferred: b.totalShopsReferred,
        totalGmvGenerated: b.totalGmvGenerated,
      })),
      isCovered: w.brokers.length > 0,
      brokerCount: w.brokers.length,
    }));

    // Summary stats
    const coveredWards = territories.filter(t => t.isCovered).length;
    const uncoveredWards = territories.filter(t => !t.isCovered);
    const totalShops = territories.reduce((sum, t) => sum + t.shopCount, 0);
    const coveredShops = territories
      .filter(t => t.isCovered)
      .reduce((sum, t) => sum + t.shopCount, 0);

    return NextResponse.json(successResponse({
      territories,
      districts: districts.map(d => ({ district: d.district, wardCount: d._count.id })),
      summary: {
        totalWards: territories.length,
        coveredWards,
        uncoveredWards: uncoveredWards.length,
        coveragePercent: territories.length > 0 ? Math.round((coveredWards / territories.length) * 100) : 0,
        totalShops,
        coveredShops,
        uncoveredShops: totalShops - coveredShops,
        shopCoveragePercent: totalShops > 0 ? Math.round((coveredShops / totalShops) * 100) : 0,
      },
    }));
  } catch (error) {
    console.error('[BROKER TERRITORIES ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch territories'),
      { status: 500 }
    );
  }
}
