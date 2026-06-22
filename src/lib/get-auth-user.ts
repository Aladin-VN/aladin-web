// ALADIN — getAuthUser helper for API routes
// Extracts user from JWT + fetches from DB with role-based info

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken, getCurrentUser } from '@/lib/auth';
import { ROLES } from '@/lib/security';

export interface AuthUser {
  userId: string;
  phone: string;
  name: string;
  role: string;
  shopId?: string | null;
  shop?: {
    id: string;
    name: string;
    district?: string;
    province: string;
    loyaltyTier: string;
    creditLimit: number;
    creditBalance: number;
    creditStatus: string;
  } | null;
  broker?: {
    id: string;
    tier: string;
    wardId?: string;
    commissionRate: number;
  } | null;
  distributorId?: string | null;
  distributor?: {
    id: string;
    name: string;
    address?: string;
    commissionRate: number;
    pendingPayoutAmount: number;
  } | null;
}

/**
 * Extract and verify the current user from a request.
 * Returns null if not authenticated.
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = extractBearerToken(request.headers.get('authorization'));
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const dbUser = await getCurrentUser(payload.userId);
  if (!dbUser) return null;

  // Map DB fields (id) to AuthUser fields (userId)
  const authUser: AuthUser = {
    userId: dbUser.id as string,
    phone: dbUser.phone as string,
    name: dbUser.name as string,
    role: dbUser.role as string,
    shopId: (dbUser as Record<string, unknown>).shopId as string | null ?? null,
    shop: dbUser.shop as AuthUser['shop'],
    broker: dbUser.broker as AuthUser['broker'],
    distributorId: (dbUser as Record<string, unknown>).distributorId as string | null ?? null,
    distributor: dbUser.distributor as AuthUser['distributor'],
  };

  return authUser;
}

/**
 * Require authentication — returns user or 401 response.
 * Usage: const user = await requireAuth(request); if (!user) return;
 */
export async function requireAuth(request: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }
  return user;
}

/**
 * Require admin role — returns user or 403 response.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthUser | NextResponse> {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
      { status: 401 }
    );
  }
  if (user.role !== ROLES.ADMIN) {
    return NextResponse.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required.' } },
      { status: 403 }
    );
  }
  return user;
}

/**
 * Build a Prisma `where` filter for orders based on user role.
 * - ADMIN: no filter (see all)
 * - SHOP_OWNER: only their shop's orders
 * - SALES_REP: see all (territory-wide)
 * - DRIVER: only orders assigned to them
 * - BROKER: orders from their referred shops
 * - DISTRIBUTOR: only orders assigned to their distributor
 */
export function getOrderFilter(user: AuthUser) {
  switch (user.role) {
    case ROLES.SHOP_OWNER:
      return { shop: { userId: user.userId } };
    case ROLES.DRIVER:
      return { OR: [
        { assignedDriverId: user.userId },
        { shipments: { some: { assignedDriverId: user.userId } } },
      ]};
    case ROLES.BROKER:
      return {};
    case ROLES.DISTRIBUTOR:
      return { distributorId: user.distributorId };
    default:
      return {}; // ADMIN, SALES_REP see all
  }
}

/**
 * Build a Prisma `where` filter for shops based on user role.
 */
export function getShopFilter(user: AuthUser) {
  switch (user.role) {
    case ROLES.SHOP_OWNER:
      return { userId: user.userId };
    case ROLES.BROKER:
      // Broker sees shops in their assigned ward
      // Return empty filter — route-level RBAC handles ward filtering
      return {};
    default:
      return {}; // ADMIN, SALES_REP, DRIVER see all
  }
}

/**
 * Get distributor ID for a user (if they are a DISTRIBUTOR role)
 */
export function getDistributorId(user: AuthUser): string | null {
  if (user.role === ROLES.DISTRIBUTOR) {
    return user.distributorId || null;
  }
  return null;
}

/**
 * Build a Prisma `where` filter for shipments based on user role.
 */
export function getShipmentFilter(user: AuthUser) {
  switch (user.role) {
    case ROLES.DRIVER:
      return { assignedDriverId: user.userId };
    case ROLES.SHOP_OWNER:
      return { order: { shop: { userId: user.userId } } };
    default:
      return {}; // ADMIN, SALES_REP, BROKER see all
  }
}