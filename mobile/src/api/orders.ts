// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Orders API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';
import type { PaginatedResponse } from './products';

// ─── Types ──────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  total: number;
  imageUrl?: string;
}

export interface Order {
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  shippingAddress?: string;
  notes?: string;
  cancelledReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetOrdersParams {
  search?: string;
  status?: OrderStatus | '';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface OrderDetailResponse {
  success: true;
  data: Order;
}

export interface CreateOrderPayload {
  shopId: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
  shippingAddress?: string;
  notes?: string;
}

export interface CreateOrderResponse {
  success: true;
  data: Order;
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  notes?: string;
}

export interface UpdateOrderStatusResponse {
  success: true;
  data: Order;
}

export interface CancelOrderPayload {
  reason: string;
}

export interface CancelOrderResponse {
  success: true;
  data: Order;
}

export interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  totalRevenue: number;
}

export interface OrderStatsResponse {
  success: true;
  data: OrderStats;
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/orders */
export async function getOrders(
  params?: GetOrdersParams,
): Promise<PaginatedResponse<Order>> {
  const { data } = await apiClient.get<PaginatedResponse<Order>>(
    '/api/orders',
    { params },
  );
  return data;
}

/** GET /api/orders/:id */
export async function getOrderDetail(
  id: string,
): Promise<OrderDetailResponse> {
  const { data } = await apiClient.get<OrderDetailResponse>(
    `/api/orders/${id}`,
  );
  return data;
}

/** POST /api/orders */
export async function createOrder(
  payload: CreateOrderPayload,
): Promise<CreateOrderResponse> {
  const { data } = await apiClient.post<CreateOrderResponse>(
    '/api/orders',
    payload,
  );
  return data;
}

/** PATCH /api/orders/:id/status */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  notes?: string,
): Promise<UpdateOrderStatusResponse> {
  const { data } = await apiClient.patch<UpdateOrderStatusResponse>(
    `/api/orders/${id}/status`,
    { status, notes },
  );
  return data;
}

/** PATCH /api/orders/:id/cancel */
export async function cancelOrder(
  id: string,
  reason: string,
): Promise<CancelOrderResponse> {
  const { data } = await apiClient.patch<CancelOrderResponse>(
    `/api/orders/${id}/cancel`,
    { reason },
  );
  return data;
}

/** GET /api/orders/stats */
export async function getOrderStats(): Promise<OrderStatsResponse> {
  const { data } = await apiClient.get<OrderStatsResponse>(
    '/api/orders/stats',
  );
  return data;
}
