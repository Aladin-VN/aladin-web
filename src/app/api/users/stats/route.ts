// ALADIN User Stats API — Aggregate statistics
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, ROLES } from '@/lib/security';

// GET /api/users/stats — Aggregate user statistics
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

    const whereDeleted = { deletedAt: null };

    // Run all queries in parallel
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingUsers,
      newThisMonth,
      newThisWeek,
      recentLogins,
      admins,
      salesReps,
      drivers,
      shopOwners,
      brokers,
    ] = await Promise.all([
      // Total
      db.user.count({ where: whereDeleted }),
      // Active
      db.user.count({ where: { ...whereDeleted, status: 'ACTIVE' } }),
      // Suspended
      db.user.count({ where: { ...whereDeleted, status: 'SUSPENDED' } }),
      // Pending
      db.user.count({ where: { ...whereDeleted, status: 'PENDING_VERIFICATION' } }),
      // New this month
      db.user.count({
        where: {
          ...whereDeleted,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      // New this week
      db.user.count({
        where: {
          ...whereDeleted,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      // Recent logins (last 24h)
      db.user.count({
        where: {
          ...whereDeleted,
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      // By role
      db.user.count({ where: { ...whereDeleted, role: ROLES.ADMIN } }),
      db.user.count({ where: { ...whereDeleted, role: ROLES.SALES_REP } }),
      db.user.count({ where: { ...whereDeleted, role: ROLES.DRIVER } }),
      db.user.count({ where: { ...whereDeleted, role: ROLES.SHOP_OWNER } }),
      db.user.count({ where: { ...whereDeleted, role: ROLES.BROKER } }),
    ]);

    // Role distribution
    const roleDistribution: Record<string, number> = {
      [ROLES.ADMIN]: admins,
      [ROLES.SHOP_OWNER]: shopOwners,
      [ROLES.SALES_REP]: salesReps,
      [ROLES.DRIVER]: drivers,
      [ROLES.BROKER]: brokers,
    };

    // Status distribution
    const statusDistribution: Record<string, number> = {
      ACTIVE: activeUsers,
      SUSPENDED: suspendedUsers,
      PENDING_VERIFICATION: pendingUsers,
    };

    return NextResponse.json(successResponse({
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingUsers,
      newThisMonth,
      newThisWeek,
      roleDistribution,
      statusDistribution,
      recentLogins,
      admins,
      salesReps,
      drivers,
      shopOwners,
      brokers,
    }));
  } catch (error) {
    console.error('[USER STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch user statistics'),
      { status: 500 }
    );
  }
}
