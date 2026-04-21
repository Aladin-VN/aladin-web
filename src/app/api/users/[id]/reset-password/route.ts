// ALADIN Admin Reset Password API — Admin resets another user's password
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hashPassword } from '@/lib/auth';
import { successResponse, errorResponse, ROLES } from '@/lib/security';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-log';

// PATCH /api/users/[id]/reset-password — Admin-only password reset
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
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only admins can reset passwords'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { newPassword } = body;

    if (!newPassword) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'New password is required'),
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        errorResponse('INVALID_PASSWORD', 'Password must be at least 8 characters'),
        { status: 400 }
      );
    }

    // Find target user
    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      return NextResponse.json(errorResponse('USER_NOT_FOUND', 'User not found'), { status: 404 });
    }

    // Hash and update password
    const passwordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePwd: true, // Force user to change password on next login
      },
    });

    // Audit log
    await logAction({
      userId: payload.userId,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      entity: 'User',
      entityId: id,
      details: {
        adminId: payload.userId,
        targetUserId: id,
        targetUserName: targetUser.name,
      },
      req: request,
    });

    return NextResponse.json(successResponse({
      reset: true,
      mustChangePwd: true,
    }));
  } catch (error) {
    console.error('[RESET PASSWORD ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to reset password'),
      { status: 500 }
    );
  }
}
