// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Products API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface Product {
  productId: string;
  name: string;
  nameEn?: string;
  description?: string;
  descriptionEn?: string;
  sku: string;
  unitPrice: number;
  retailPrice?: number;
  unit: string;
  category: Category;
  imageUrl?: string;
  images?: string[];
  moq: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  categoryId: string;
  name: string;
  nameEn?: string;
  slug: string;
  description?: string;
  productCount?: number;
}

export interface GetProductsParams {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductDetailResponse {
  success: true;
  data: Product;
}

export interface CategoryListResponse {
  success: true;
  data: Category[];
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/products */
export async function getProducts(
  params?: GetProductsParams,
): Promise<PaginatedResponse<Product>> {
  const { data } = await apiClient.get<PaginatedResponse<Product>>(
    '/api/products',
    { params },
  );
  return data;
}

/** GET /api/products/:id */
export async function getProductDetail(
  id: string,
): Promise<ProductDetailResponse> {
  const { data } = await apiClient.get<ProductDetailResponse>(
    `/api/products/${id}`,
  );
  return data;
}

/** GET /api/categories */
export async function getCategories(): Promise<CategoryListResponse> {
  const { data } = await apiClient.get<CategoryListResponse>(
    '/api/categories',
  );
  return data;
}
