// ALADIN User Detail API — Get, Update, Soft Delete
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, sanitizeUser } from '@/lib/auth';
import { successResponse, errorResponse, sanitizeInput, ROLES } from '@/lib/security';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-log';

const VALID_ROLES = Object.values(ROLES);
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];

// GET /api/users/[id] — Full user detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        name: true,
        nameEn: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        mustChangePwd: true,
        createdAt: true,
        updatedAt: true,
        shop: {
          select: { id: true, name: true, loyaltyTier: true, creditLimit: true, creditBalance: true },
        },
        broker: {
          select: { id: true, tier: true, commissionRate: true, totalShopsReferred: true, totalCommissionEarned: true },
        },
      },
    });

    if (!user || (user as unknown as { deletedAt?: string | null }).deletedAt) {
      return NextResponse.json(errorResponse('USER_NOT_FOUND', 'User not found'), { status: 404 });
    }

    // Count related records
    const [ordersCount, transactionsCount] = await Promise.all([
      db.order.count({
        where: { shop: { userId: id } },
      }),
      db.transaction.count({
        where: { shop: { userId: id } },
      }),
    ]);

    const result = sanitizeUser(user as Record<string, unknown>);
    result.ordersCount = ordersCount;
    result.transactionsCount = transactionsCount;

    return NextResponse.json(successResponse(result));
  } catch (error) {
    console.error('[USER DETAIL ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch user'),
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] — Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }
    if (payload.role !== ROLES.ADMIN) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only admins can update users'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, nameEn, email, role, status } = body;

    // Find existing user
    const existing = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true, name: true, deletedAt: true },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(errorResponse('USER_NOT_FOUND', 'User not found'), { status: 404 });
    }

    // Cannot change own role
    if (role && role !== existing.role && id === payload.userId) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Cannot change your own role'),
        { status: 403 }
      );
    }

    // Validate role
    if (role && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        errorResponse('INVALID_ROLE', `Role must be one of: ${VALID_ROLES.join(', ')}`),
        { status: 400 }
      );
    }

    // Validate status
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        errorResponse('INVALID_STATUS', `Status must be one of: ${VALID_STATUSES.join(', ')}`),
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = sanitizeInput(name);
    if (nameEn !== undefined) updateData.nameEn = nameEn ? sanitizeInput(nameEn) : null;
    if (email !== undefined) updateData.email = email ? sanitizeInput(email) : null;
    if (role !== undefined) updateData.role = role;
    if (status !== undefined) updateData.status = status;

    // Update user
    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        phone: true,
        name: true,
        nameEn: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        lastLoginAt: true,
        mustChangePwd: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Audit logging for specific changes
    const details: Record<string, unknown> = {};
    if (role && role !== existing.role) {
      await logAction({
        userId: payload.userId,
        action: AUDIT_ACTIONS.USER_ROLE_CHANGED,
        entity: 'User',
        entityId: id,
        details: { before: existing.role, after: role, userName: updated.name },
        req: request,
      });
    }
    if (status && status !== existing.status) {
      await logAction({
        userId: payload.userId,
        action: AUDIT_ACTIONS.USER_STATUS_CHANGED,
        entity: 'User',
        entityId: id,
        details: { before: existing.status, after: status, userName: updated.name },
        req: request,
      });
    }

    // General update log (only if not already logged as role/status change)
    if (!role && !status) {
      await logAction({
        userId: payload.userId,
        action: AUDIT_ACTIONS.USER_UPDATED,
        entity: 'User',
        entityId: id,
        details: { changes: Object.keys(updateData), userName: updated.name },
        req: request,
      });
    } else if (role && status) {
      // Log general update if both changed
      await logAction({
        userId: payload.userId,
        action: AUDIT_ACTIONS.USER_UPDATED,
        entity: 'User',
        entityId: id,
        details: { changes: Object.keys(updateData), userName: updated.name },
        req: request,
      });
    }

    return NextResponse.json(successResponse(sanitizeUser(updated as Record<string, unknown>)));
  } catch (error) {
    console.error('[USER UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update user'),
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] — Soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }
    if (payload.role !== ROLES.ADMIN) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only admins can delete users'), { status: 403 });
    }

    const { id } = await params;

    // Cannot delete self
    if (id === payload.userId) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Cannot delete your own account'),
        { status: 403 }
      );
    }

    // Find user
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true, shop: { select: { id: true } } },
    });

    if (!user || user.deletedAt) {
      return NextResponse.json(errorResponse('USER_NOT_FOUND', 'User not found'), { status: 404 });
    }

    // Check for active orders (if shop owner)
    if (user.shop) {
      const activeOrdersCount = await db.order.count({
        where: {
          shopId: user.shop.id,
          status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED'] },
        },
      });

      if (activeOrdersCount > 0) {
        return NextResponse.json(
          errorResponse('ACTIVE_ORDERS', `Cannot delete user with ${activeOrdersCount} active order(s). Cancel or complete them first.`),
          { status: 400 }
        );
      }
    }

    // Soft delete
    await db.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Audit log
    await logAction({
      userId: payload.userId,
      action: AUDIT_ACTIONS.USER_DELETED,
      entity: 'User',
      entityId: id,
      details: { deletedUserName: user.name, deletedUserPhone: 'REDACTED' },
      req: request,
    });

    return NextResponse.json(successResponse({ deleted: true }));
  } catch (error) {
    console.error('[USER DELETE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to delete user'),
      { status: 500 }
    );
  }
}
