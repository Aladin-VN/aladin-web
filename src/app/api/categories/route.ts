// ALADIN Category API — List & Create
// GET /api/categories — list all categories (sorted by sortOrder)
// POST /api/categories — create new category

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { sanitizeInput, successResponse, errorResponse, rateLimit } from '@/lib/security';

// ============================================
// GET /api/categories — List Categories
// ============================================

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

    // Fetch categories with product counts in parallel
    const [categories, categoryCounts] = await Promise.all([
      db.category.findMany({
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          name: true,
          nameEn: true,
          slug: true,
          icon: true,
          sortOrder: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.product.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null, isActive: true },
        _count: { id: true },
      }),
    ]);

    // Merge product counts
    const countMap = new Map(categoryCounts.map((c) => [c.categoryId, c._count.id]));

    const items = categories.map((cat) => ({
      ...cat,
      productCount: countMap.get(cat.id) || 0,
    }));

    return NextResponse.json(successResponse({ items }));
  } catch (error) {
    console.error('[CATEGORIES LIST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch categories'), { status: 500 });
  }
}

// ============================================
// POST /api/categories — Create Category
// ============================================

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const rl = rateLimit(`category:create:${payload.userId}`, { maxRequests: 20, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const body = await request.json();
    const { name, nameEn, slug, icon, sortOrder } = body;

    // Validation
    const errors: string[] = [];
    if (!name || name.trim().length < 2) errors.push('Category name is required (min 2 characters)');
    if (!slug || slug.trim().length < 2) errors.push('Slug is required (min 2 characters)');

    // Check slug format (lowercase, hyphens only)
    if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug.trim())) {
      errors.push('Slug must be lowercase with hyphens (e.g., "gao", "dau-an")');
    }

    // Check uniqueness
    if (slug) {
      const existing = await db.category.findUnique({ where: { slug: slug.trim() } });
      if (existing) errors.push('Slug already exists');
    }

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // Get max sortOrder
    const maxOrder = await db.category.aggregate({ _max: { sortOrder: true } });

    const category = await db.category.create({
      data: {
        name: sanitizeInput(name.trim()),
        nameEn: nameEn ? sanitizeInput(nameEn.trim()) : null,
        slug: slug.trim(),
        icon: icon || null,
        sortOrder: sortOrder ?? ((maxOrder._max.sortOrder || 0) + 1),
        isActive: true,
      },
    });

    return NextResponse.json(successResponse({ category }), { status: 201 });
  } catch (error) {
    console.error('[CATEGORY CREATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to create category'), { status: 500 });
  }
}
