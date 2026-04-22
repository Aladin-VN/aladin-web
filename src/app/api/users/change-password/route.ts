// ALADIN Change Password API — User's own password change
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, verifyPassword, hashPassword } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-log';

// PATCH /api/users/change-password — Change own password
export async function PATCH(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Current password and new password are required'),
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        errorResponse('INVALID_PASSWORD', 'New password must be at least 8 characters'),
        { status: 400 }
      );
    }

    // Find user with password hash
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, passwordHash: true, mustChangePwd: true },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        errorResponse('USER_NOT_FOUND', 'User not found or no password set'),
        { status: 404 }
      );
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        errorResponse('INVALID_PASSWORD', 'Current password is incorrect'),
        { status: 401 }
      );
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: payload.userId },
      data: {
        passwordHash: newHash,
        mustChangePwd: false,
      },
    });

    // Audit log
    await logAction({
      userId: payload.userId,
      action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
      entity: 'User',
      entityId: payload.userId,
      req: request,
    });

    return NextResponse.json(successResponse({ changed: true }));
  } catch (error) {
    console.error('[CHANGE PASSWORD ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to change password'),
      { status: 500 }
    );
  }
}
