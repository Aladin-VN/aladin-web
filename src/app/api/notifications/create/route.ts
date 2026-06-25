// ALADIN Notification Creation API
// POST /api/notifications/create — Programmatic notification creation

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse } from '@/lib/security';

// Allowed notification types
const VALID_TYPES = [
  'ORDER_STATUS',
  'SHIPMENT',
  'CREDIT',
  'SETTLEMENT',
  'INVENTORY',
  'SYSTEM',
  'PROMOTION',
  'BROKER_COMMISSION',
  'DEBT_REMINDER',
] as const;

export async function POST(request: NextRequest) {
  try {
    // ============================================
    // Auth
    // ============================================
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const isAdmin = user.role === ROLES.ADMIN;

    // ============================================
    // Parse & validate body
    // ============================================
    const body = await request.json();
    const { userId, role, type, title, message, data } = body as {
      userId?: string;
      role?: string;
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    };

    // Require type
    if (!type || !VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`
        ),
        { status: 400 }
      );
    }

    // Require title
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Title is required / Tiêu đề là bắt buộc'),
        { status: 400 }
      );
    }

    // Require message
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Message is required / Nội dung là bắt buộc'),
        { status: 400 }
      );
    }

    // Non-ADMIN users cannot specify userId or role — only notify themselves
    if (!isAdmin && (userId || role)) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Admin access required to notify other users'),
        { status: 403 }
      );
    }

    // Don't allow both userId and role at once
    if (userId && role) {
      return NextResponse.json(
        errorResponse(
          'VALIDATION_ERROR',
          'Provide either userId or role, not both'
        ),
        { status: 400 }
      );
    }

    const sanitizedTitle = title.trim().slice(0, 200);
    const sanitizedMessage = message.trim().slice(0, 2000);

    // ============================================
    // Create notifications
    // ============================================
    let notificationIds: string[] = [];

    if (userId && isAdmin) {
      // Single user notification — ADMIN targeting a specific user
      const targetUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, deletedAt: true },
      });

      if (!targetUser || targetUser.deletedAt) {
        return NextResponse.json(
          errorResponse('NOT_FOUND', 'Target user not found'),
          { status: 404 }
        );
      }

      const notification = await db.notification.create({
        data: {
          userId,
          type,
          title: sanitizedTitle,
          message: sanitizedMessage,
          data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        },
        select: { id: true },
      });

      notificationIds.push(notification.id);

    } else if (role && isAdmin) {
      // Bulk: all active users with given role
      const targetUsers = await db.user.findMany({
        where: {
          role,
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: { id: true },
      });

      if (targetUsers.length === 0) {
        return NextResponse.json(
          successResponse({ created: 0, notificationIds: [] })
        );
      }

      // createMany doesn't return IDs, so we generate them and use create
      const created = await db.notification.createMany({
        data: targetUsers.map((u) => ({
          userId: u.id,
          type,
          title: sanitizedTitle,
          message: sanitizedMessage,
          data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        })),
      });

      // Fetch the just-created notifications to get their IDs
      if (created.count > 0) {
        const recentNotifications = await db.notification.findMany({
          where: {
            userId: { in: targetUsers.map((u) => u.id) },
            type,
            title: sanitizedTitle,
          },
          select: { id: true },
          orderBy: { createdAt: 'desc' },
          take: created.count,
        });
        notificationIds = recentNotifications.map((n) => n.id);
      }

    } else {
      // No userId or role — create for the authenticated user (self)
      const notification = await db.notification.create({
        data: {
          userId: user.userId,
          type,
          title: sanitizedTitle,
          message: sanitizedMessage,
          data: data ? JSON.parse(JSON.stringify(data)) : undefined,
        },
        select: { id: true },
      });

      notificationIds.push(notification.id);
    }

    return NextResponse.json(
      successResponse({
        created: notificationIds.length,
        notificationIds,
      })
    );
  } catch (error) {
    console.error('[NOTIFICATION CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create notification'),
      { status: 500 }
    );
  }
}