// ALADIN Category API — Get, Update, Delete, Reorder
// GET /api/categories/[id]
// PUT /api/categories/[id]
// DELETE /api/categories/[id]
// PATCH /api/categories/[id] — reorder, bulk reorder

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { sanitizeInput, successResponse, errorResponse, rateLimit } from '@/lib/security';

// ============================================
// GET /api/categories/[id] — Get Single Category
// ============================================

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
    const category = await db.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { deletedAt: null, isActive: true },
          take: 10,
          orderBy: { basePrice: 'desc' },
          select: { id: true, name: true, sku: true, basePrice: true, stockQuantity: true },
        },
        _count: {
          select: { products: { where: { deletedAt: null, isActive: true } } },
        },
      },
    });

    if (!category) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Category not found'), { status: 404 });
    }

    return NextResponse.json(successResponse({ category }));
  } catch (error) {
    console.error('[CATEGORY GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to fetch category'), { status: 500 });
  }
}

// ============================================
// PUT /api/categories/[id] — Update Category
// ============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    const existing = await db.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Category not found'), { status: 404 });
    }

    // Validation
    const errors: string[] = [];
    if (body.name && body.name.trim().length < 2) errors.push('Name must be at least 2 characters');
    if (body.slug) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(body.slug.trim())) {
        errors.push('Slug must be lowercase with hyphens');
      }
      if (body.slug.trim() !== existing.slug) {
        const dup = await db.category.findUnique({ where: { slug: body.slug.trim() } });
        if (dup) errors.push('Slug already exists');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    const updatableFields = ['name', 'nameEn', 'slug', 'icon', 'sortOrder', 'isActive'];
    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = typeof body[field] === 'string' ? sanitizeInput(body[field].trim()) : body[field];
      }
    }

    const category = await db.category.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(successResponse({ category }));
  } catch (error) {
    console.error('[CATEGORY UPDATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update category'), { status: 500 });
  }
}

// ============================================
// DELETE /api/categories/[id] — Delete Category
// ============================================

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
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;

    // Check for products in this category
    const productCount = await db.product.count({
      where: { categoryId: id, deletedAt: null },
    });

    if (productCount > 0) {
      return NextResponse.json(
        errorResponse('HAS_PRODUCTS', `Cannot delete category with ${productCount} product(s). Reassign products first.`),
        { status: 409 }
      );
    }

    await db.category.delete({ where: { id } });

    return NextResponse.json(successResponse({ id, deleted: true }));
  } catch (error) {
    console.error('[CATEGORY DELETE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to delete category'), { status: 500 });
  }
}

// ============================================
// PATCH /api/categories/[id] — Bulk Reorder
// ============================================

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
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.action === 'reorder' && Array.isArray(body.order)) {
      // Bulk reorder: body.order = [{ id, sortOrder }, ...]
      const updates = body.order.map((item: { id: string; sortOrder: number }) =>
        db.category.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      );
      await Promise.all(updates);

      return NextResponse.json(successResponse({ reordered: body.order.length }));
    }

    if (body.action === 'move' && typeof body.newSortOrder === 'number') {
      const category = await db.category.findUnique({ where: { id } });
      if (!category) {
        return NextResponse.json(errorResponse('NOT_FOUND', 'Category not found'), { status: 404 });
      }

      await db.category.update({
        where: { id },
        data: { sortOrder: body.newSortOrder },
      });

      return NextResponse.json(successResponse({ id, sortOrder: body.newSortOrder }));
    }

    if (body.action === 'toggle_active') {
      const category = await db.category.findUnique({ where: { id } });
      if (!category) {
        return NextResponse.json(errorResponse('NOT_FOUND', 'Category not found'), { status: 404 });
      }

      const updated = await db.category.update({
        where: { id },
        data: { isActive: !category.isActive },
      });

      return NextResponse.json(successResponse({ id: updated.id, isActive: updated.isActive }));
    }

    return NextResponse.json(errorResponse('INVALID_ACTION', 'Unknown action'), { status: 400 });
  } catch (error) {
    console.error('[CATEGORY PATCH ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Failed to update category'), { status: 500 });
  }
}
