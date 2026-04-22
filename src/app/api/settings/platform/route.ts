// ALADIN Platform Settings API — GET + PATCH
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, ROLES } from '@/lib/security';
import { seedPlatformSettings } from '@/lib/audit-log';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-log';

// GET /api/settings/platform — Return all settings grouped by category
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

    // Seed default settings (idempotent upsert)
    await seedPlatformSettings();

    // Fetch all settings
    const settings = await db.platformSetting.findMany({
      orderBy: { category: 'asc' },
    });

    // Group by category
    const grouped: Record<string, typeof settings> = {
      general: [],
      credit: [],
      notification: [],
      security: [],
    };

    for (const s of settings) {
      if (!grouped[s.category]) {
        grouped[s.category] = [];
      }
      grouped[s.category].push(s);
    }

    return NextResponse.json(successResponse({
      settings: grouped,
      flat: settings,
    }));
  } catch (error) {
    console.error('[PLATFORM SETTINGS GET ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch platform settings'),
      { status: 500 }
    );
  }
}

// PATCH /api/settings/platform — Update one or more settings
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
    if (payload.role !== ROLES.ADMIN) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only admins can update platform settings'), { status: 403 });
    }

    const body = await request.json();
    const { settings: settingsToUpdate } = body as { settings: { key: string; value: string }[] };

    if (!Array.isArray(settingsToUpdate) || settingsToUpdate.length === 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Settings array is required'),
        { status: 400 }
      );
    }

    const updatedSettings = [];

    for (const item of settingsToUpdate) {
      if (!item.key || item.value === undefined) continue;

      // Check key exists
      const existing = await db.platformSetting.findUnique({
        where: { key: item.key },
      });

      if (!existing) {
        continue;
      }

      // Update
      const updated = await db.platformSetting.update({
        where: { key: item.key },
        data: { value: item.value },
      });

      updatedSettings.push(updated);

      // Audit log
      await logAction({
        userId: payload.userId,
        action: AUDIT_ACTIONS.PLATFORM_SETTING_UPDATED,
        entity: 'PlatformSetting',
        entityId: updated.id,
        details: {
          key: updated.key,
          before: existing.value,
          after: item.value,
          description: updated.description,
        },
        req: request,
      });
    }

    return NextResponse.json(successResponse({
      updated: updatedSettings,
      count: updatedSettings.length,
    }));
  } catch (error) {
    console.error('[PLATFORM SETTINGS PATCH ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update platform settings'),
      { status: 500 }
    );
  }
}
