// ALADIN Zalo Bot — Product Search Engine
// Fuzzy search optimized for Vietnamese text input from Zalo messages

import { db } from '../db';
import type { ZaloProductResult } from './config';

// ============================================
// PRODUCT SEARCH (Optimized for Vietnamese)
// ============================================

/**
 * Search products by Vietnamese text query
 * Supports: product name, brand, category, SKU
 * Returns top N results sorted by relevance
 */
export async function searchProducts(query: string, limit: number = 5): Promise<ZaloProductResult[]> {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim().toLowerCase();

  // Strategy 1: Exact prefix match on product name (highest priority)
  const namePrefix = await db.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      OR: [
        { name: { contains: cleanQuery } },
        { nameEn: { contains: cleanQuery } },
        { sku: { contains: cleanQuery.toUpperCase() } },
        { brand: { contains: cleanQuery } },
        { barcode: cleanQuery },
      ],
    },
    include: { category: { select: { name: true } } },
    take: limit + 5,
    orderBy: [
      { stockQuantity: 'desc' }, // In-stock items first
      { basePrice: 'asc' },     // Cheaper items first
    ],
  });

  // Strategy 2: Category match (medium priority)
  const categoryMatch = await db.category.findMany({
    where: { name: { contains: cleanQuery } },
    select: { id: true },
  });

  let catProducts: typeof namePrefix = [];
  if (categoryMatch.length > 0) {
    const catIds = categoryMatch.map((c) => c.id);
    catProducts = await db.product.findMany({
      where: { isActive: true, deletedAt: null, categoryId: { in: catIds } },
      include: { category: { select: { name: true } } },
      take: limit,
      orderBy: { basePrice: 'asc' },
    });
  }

  // Merge and deduplicate
  const seen = new Set<string>();
  const results: ZaloProductResult[] = [];

  for (const product of [...namePrefix, ...catProducts]) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);

    results.push({
      id: product.id,
      sku: product.sku,
      name: product.name,
      nameEn: product.nameEn || undefined,
      basePrice: product.basePrice,
      groupBuyPrice: product.groupBuyPrice,
      unit: product.unit,
      stockQuantity: product.stockQuantity,
      category: product.category?.name || '',
      isPrivateLabel: product.isPrivateLabel,
    });

    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Get popular/trending products for "browse" mode
 */
export async function getPopularProducts(limit: number = 5): Promise<ZaloProductResult[]> {
  // Get products with most order items in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const popular = await db.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'CANCELLED' } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });

  const productIds = popular.map((p) => p.productId);

  if (productIds.length === 0) {
    // Fallback: return newest active products
    const products = await db.product.findMany({
      where: { isActive: true, deletedAt: null, stockQuantity: { gt: 0 } },
      include: { category: { select: { name: true } } },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      nameEn: p.nameEn || undefined,
      basePrice: p.basePrice,
      groupBuyPrice: p.groupBuyPrice,
      unit: p.unit,
      stockQuantity: p.stockQuantity,
      category: p.category?.name || '',
      isPrivateLabel: p.isPrivateLabel,
    }));
  }

  const products = await db.product.findMany({
    where: { id: { in: productIds }, isActive: true, deletedAt: null },
    include: { category: { select: { name: true } } },
  });

  // Sort by popularity order
  const orderMap = new Map(popular.map((p, i) => [p.productId, i]));

  return products
    .sort((a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999))
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      nameEn: p.nameEn || undefined,
      basePrice: p.basePrice,
      groupBuyPrice: p.groupBuyPrice,
      unit: p.unit,
      stockQuantity: p.stockQuantity,
      category: p.category?.name || '',
      isPrivateLabel: p.isPrivateLabel,
    }));
}

/**
 * Get all active categories for browse menu
 */
export async function getCategoryList(): Promise<Array<{ id: string; name: string; icon: string | null; productCount: number }>> {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, icon: true },
  });

  const counts = await db.product.groupBy({
    by: ['categoryId'],
    where: { deletedAt: null, isActive: true },
    _count: { id: true },
  });

  const countMap = new Map(counts.map((c) => [c.categoryId, c._count.id]));

  return categories
    .map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      productCount: countMap.get(c.id) || 0,
    }))
    .filter((c) => c.productCount > 0);
}

/**
 * Get products by category
 */
export async function getProductsByCategory(categoryId: string, limit: number = 5): Promise<ZaloProductResult[]> {
  const products = await db.product.findMany({
    where: { categoryId, isActive: true, deletedAt: null },
    include: { category: { select: { name: true } } },
    take: limit,
    orderBy: { basePrice: 'asc' },
  });

  return products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    nameEn: p.nameEn || undefined,
    basePrice: p.basePrice,
    groupBuyPrice: p.groupBuyPrice,
    unit: p.unit,
    stockQuantity: p.stockQuantity,
    category: p.category?.name || '',
    isPrivateLabel: p.isPrivateLabel,
  }));
}

// ============================================
// FORMAT HELPERS
// ============================================

export function formatVNDShort(amount: number): string {
  if (amount >= 1_000_000) {
    return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'tr';
  }
  if (amount >= 1_000) {
    return (amount / 1_000).toFixed(0) + 'K';
  }
  return amount.toString();
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'd';
}

export function formatProductLine(product: ZaloProductResult, index: number): string {
  const priceStr = formatVNDShort(product.basePrice);
  const stockIcon = product.stockQuantity > 50 ? '' : product.stockQuantity > 0 ? ' (còn ít!)' : ' (hết hàng!)';
  const plTag = product.isPrivateLabel ? ' [ALADIN]' : '';

  return `${index}. ${product.name}${plTag}\n   ${product.sku} | ${priceStr}/${product.unit}${stockIcon}`;
}
