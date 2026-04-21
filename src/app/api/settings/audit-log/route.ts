// ALADIN Audit Log API — Query audit logs with filters
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from '@/lib/audit-log';

// GET /api/settings/audit-log — Paginated audit log with filters
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
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const action = searchParams.get('action') || '';
    const entity = searchParams.get('entity') || '';
    const userId = searchParams.get('userId') || '';
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';

    // Build WHERE
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { action: { contains: search } },
        { entity: { contains: search } },
        { details: { contains: search } },
      ];
    }

    if (action) {
      where.action = action;
    }

    if (entity) {
      where.entity = entity;
    }

    if (userId) {
      where.userId = userId;
    }

    // Date range
    if (from || to) {
      const dateFilter: Record<string, Date> = {};
      if (from) {
        dateFilter.gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.createdAt = dateFilter;
    }

    // Fetch logs
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { id: true, name: true, role: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Parse details JSON for display
    const items = logs.map((log) => {
      let parsedDetails: unknown = null;
      try {
        if (log.details) {
          parsedDetails = JSON.parse(log.details);
        }
      } catch {
        parsedDetails = log.details;
      }

      return {
        id: log.id,
        userId: log.userId,
        userName: log.user?.name || null,
        userRole: log.user?.role || null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: parsedDetails,
        detailsRaw: log.details,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      };
    });

    // Filter options
    const actionOptions = Object.values(AUDIT_ACTIONS);
    const entityOptions = Object.values(AUDIT_ENTITIES);

    return NextResponse.json(successResponse({
      items,
      pagination: { page, limit, total, totalPages },
      filterOptions: {
        actions: actionOptions,
        entities: entityOptions,
      },
    }));
  } catch (error) {
    console.error('[AUDIT LOG ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch audit logs'),
      { status: 500 }
    );
  }
}
