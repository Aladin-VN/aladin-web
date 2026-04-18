// ALADIN Product Catalog API — List & Create
// GET /api/products — paginated list with search, filter, sort
// POST /api/products — create new product

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { sanitizeInput, isValidVNDAmount, generateIdempotencyKey, successResponse, errorResponse, rateLimit } from '@/lib/security';

// ============================================
// GET /api/products — List Products
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const brand = searchParams.get('brand') || '';
    const isActive = searchParams.get('isActive');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const lowStock = searchParams.get('lowStock') === 'true';
    const outOfStock = searchParams.get('outOfStock') === 'true';

    // Build WHERE clause
    const where: Record<string, unknown> = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameEn: { contains: search } },
        { sku: { contains: search } },
        { brand: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (brand) {
      where.brand = { contains: brand };
    }

    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (lowStock) {
      where.stockQuantity = { gt: 0, lte: 50 };
      where.isActive = true;
    }

    if (outOfStock) {
      where.stockQuantity = 0;
      where.isActive = true;
    }

    // Build ORDER BY
    const orderBy: Record<string, string> = {};
    if (sortBy === 'price' || sortBy === 'basePrice') {
      orderBy.basePrice = sortOrder;
    } else if (sortBy === 'stock') {
      orderBy.stockQuantity = sortOrder;
    } else if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Parallel queries for performance
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true, nameEn: true, slug: true, icon: true } },
          manufacturer: { select: { id: true, name: true } },
          distributor: { select: { id: true, name: true } },
        },
      }),
      db.product.count({ where }),
    ]);

    // Calculate category product counts in a single query
    const categoryCounts = await db.product.groupBy({
      by: ['categoryId'],
      where: { deletedAt: null, isActive: true },
      _count: { id: true },
    });

    // Get distinct brands for filter
    const brandFilter = await db.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: { brand: true },
      distinct: ['brand'],
    });

    return NextResponse.json(
      successResponse({
        items: products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          nameEn: p.nameEn,
          description: p.description,
          categoryId: p.categoryId,
          category: p.category,
          brand: p.brand,
          unit: p.unit,
          unitEn: p.unitEn,
          basePrice: p.basePrice,
          groupBuyPrice: p.groupBuyPrice,
          stockQuantity: p.stockQuantity,
          minOrderQty: p.minOrderQty,
          maxOrderQty: p.maxOrderQty,
          weightKg: p.weightKg,
          imageUrl: p.imageUrl,
          isActive: p.isActive,
          isPrivateLabel: p.isPrivateLabel,
          barcode: p.barcode,
          manufacturer: p.manufacturer,
          distributor: p.distributor,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        filters: {
          categories: categoryCounts.map((c) => ({ categoryId: c.categoryId, count: c._count.id })),
          brands: brandFilter.map((b) => b.brand).filter(Boolean),
        },
      })
    );
  } catch (error) {
    console.error('[PRODUCTS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch products'),
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/products — Create Product
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

    // Rate limit
    const rl = rateLimit(`product:create:${payload.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const body = await request.json();
    const {
      sku,
      name,
      nameEn,
      description,
      descriptionEn,
      categoryId,
      brand,
      unit,
      unitEn,
      basePrice,
      groupBuyPrice,
      stockQuantity,
      minOrderQty,
      maxOrderQty,
      weightKg,
      barcode,
      manufacturerId,
      distributorId,
      isPrivateLabel,
    } = body;

    // Validation
    const errors: string[] = [];
    if (!sku || sku.trim().length < 3) errors.push('SKU is required (min 3 characters)');
    if (!name || name.trim().length < 2) errors.push('Product name is required (min 2 characters)');
    if (!categoryId) errors.push('Category is required');
    if (!basePrice || !isValidVNDAmount(basePrice)) errors.push('Valid base price is required');
    if (basePrice < 100) errors.push('Price must be at least 100 VND');
    if (groupBuyPrice !== undefined && groupBuyPrice !== null && (groupBuyPrice >= basePrice || groupBuyPrice < 100)) {
      errors.push('Group buy price must be less than base price and at least 100 VND');
    }
    if (stockQuantity !== undefined && stockQuantity < 0) errors.push('Stock cannot be negative');
    if (minOrderQty !== undefined && minOrderQty < 1) errors.push('Min order qty must be at least 1');
    if (maxOrderQty !== undefined && maxOrderQty !== null && maxOrderQty < minOrderQty) {
      errors.push('Max order qty must be greater than or equal to min order qty');
    }
    if (barcode) {
      const existingBarcode = await db.product.findFirst({ where: { barcode } });
      if (existingBarcode) errors.push('Barcode already exists');
    }

    // Check SKU uniqueness
    const existingSku = await db.product.findUnique({ where: { sku: sku.trim() } });
    if (existingSku) errors.push('SKU already exists');

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // Create product
    const product = await db.product.create({
      data: {
        sku: sanitizeInput(sku.trim()),
        name: sanitizeInput(name.trim()),
        nameEn: nameEn ? sanitizeInput(nameEn.trim()) : null,
        description: description ? sanitizeInput(description.trim()) : null,
        descriptionEn: descriptionEn ? sanitizeInput(descriptionEn.trim()) : null,
        categoryId,
        brand: brand ? sanitizeInput(brand.trim()) : null,
        unit: unit || 'cai',
        unitEn: unitEn || null,
        basePrice: Math.round(basePrice),
        groupBuyPrice: groupBuyPrice ? Math.round(groupBuyPrice) : null,
        stockQuantity: stockQuantity ?? 0,
        minOrderQty: minOrderQty ?? 1,
        maxOrderQty: maxOrderQty ?? null,
        weightKg: weightKg ?? null,
        barcode: barcode ? barcode.trim() : null,
        manufacturerId: manufacturerId || null,
        distributorId: distributorId || null,
        isPrivateLabel: isPrivateLabel || false,
        isActive: true,
      },
      include: {
        category: { select: { id: true, name: true, nameEn: true, slug: true } },
        manufacturer: { select: { id: true, name: true } },
        distributor: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      successResponse({ product }, undefined),
      { status: 201 }
    );
  } catch (error) {
    console.error('[PRODUCT CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create product'),
      { status: 500 }
    );
  }
}
