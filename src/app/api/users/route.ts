// ALADIN User Management API — List + Create
// Sprint 5H — Settings & Auth Hardening

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hashPassword, sanitizeUser } from '@/lib/auth';
import { successResponse, errorResponse, sanitizeInput, isValidVNPhone, ROLES } from '@/lib/security';
import { logAction, AUDIT_ACTIONS } from '@/lib/audit-log';

const VALID_ROLES = Object.values(ROLES);
const VALID_CREATE_ROLES = [ROLES.ADMIN, ROLES.SALES_REP, ROLES.DRIVER];
const VALID_STATUSES = ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];

// GET /api/users — Paginated user list with filters
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
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build WHERE
    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameEn: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (role && VALID_ROLES.includes(role as typeof ROLES[keyof typeof ROLES])) {
      where.role = role;
    }

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }

    // Build ORDER BY
    type SortField = 'createdAt' | 'name' | 'lastLoginAt' | 'role';
    const validSortFields: SortField[] = ['createdAt', 'name', 'lastLoginAt', 'role'];
    const sortField: SortField = validSortFields.includes(sortBy as SortField) ? (sortBy as SortField) : 'createdAt';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortField]: orderDir };

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
            select: { id: true, name: true, loyaltyTier: true },
          },
          broker: {
            select: { id: true, tier: true, commissionRate: true },
          },
        },
      }),
      db.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Sanitize
    const items = users.map((u) => sanitizeUser(u as Record<string, unknown>));

    return NextResponse.json(successResponse({
      items,
      pagination: { page, limit, total, totalPages },
      roleFilterOptions: VALID_ROLES,
      statusFilterOptions: VALID_STATUSES,
    }));
  } catch (error) {
    console.error('[USERS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch users'),
      { status: 500 }
    );
  }
}

// POST /api/users — Create admin/sales-rep/driver user
export async function POST(request: NextRequest) {
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
      return NextResponse.json(errorResponse('FORBIDDEN', 'Only admins can create users'), { status: 403 });
    }

    const body = await request.json();
    const { phone, password, name, nameEn, email, role } = body;

    // Validate required fields
    if (!phone || !password || !name || !role) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Phone, password, name, and role are required'),
        { status: 400 }
      );
    }

    // Validate phone
    if (!isValidVNPhone(phone)) {
      return NextResponse.json(
        errorResponse('INVALID_PHONE', 'Please provide a valid Vietnamese phone number'),
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        errorResponse('INVALID_PASSWORD', 'Password must be at least 8 characters'),
        { status: 400 }
      );
    }

    // Validate role
    if (!VALID_CREATE_ROLES.includes(role)) {
      return NextResponse.json(
        errorResponse('INVALID_ROLE', `Role must be one of: ${VALID_CREATE_ROLES.join(', ')}`),
        { status: 400 }
      );
    }

    // Check duplicate phone
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing) {
      return NextResponse.json(
        errorResponse('USER_EXISTS', 'A user with this phone number already exists'),
        { status: 409 }
      );
    }

    // Hash password and create
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        phone: sanitizeInput(phone),
        passwordHash,
        name: sanitizeInput(name),
        nameEn: nameEn ? sanitizeInput(nameEn) : undefined,
        email: email ? sanitizeInput(email) : undefined,
        role,
        status: 'ACTIVE',
      },
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

    // Audit log
    await logAction({
      userId: payload.userId,
      action: AUDIT_ACTIONS.USER_CREATED,
      entity: 'User',
      entityId: user.id,
      details: { phone: user.phone, name: user.name, role: user.role },
      req: request,
    });

    return NextResponse.json(successResponse(sanitizeUser(user as Record<string, unknown>)), { status: 201 });
  } catch (error) {
    console.error('[USER CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create user'),
      { status: 500 }
    );
  }
}
