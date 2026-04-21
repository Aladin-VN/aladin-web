// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Shipments API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';
import type { PaginatedResponse } from './products';

// ─── Types ──────────────────────────────────────────────────────────

export type ShipmentStatus =
  | 'pending'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned';

export interface ShipmentTrackingEvent {
  status: ShipmentStatus;
  timestamp: string;
  location?: string;
  description?: string;
}

export interface Shipment {
  shipmentId: string;
  trackingNumber: string;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  carrier: string;
  status: ShipmentStatus;
  origin: string;
  destination: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  trackingHistory: ShipmentTrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface GetShipmentsParams {
  search?: string;
  status?: ShipmentStatus | '';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface ShipmentDetailResponse {
  success: true;
  data: Shipment;
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/shipments */
export async function getShipments(
  params?: GetShipmentsParams,
): Promise<PaginatedResponse<Shipment>> {
  const { data } = await apiClient.get<PaginatedResponse<Shipment>>(
    '/api/shipments',
    { params },
  );
  return data;
}

/** GET /api/shipments/:id */
export async function getShipmentDetail(
  id: string,
): Promise<ShipmentDetailResponse> {
  const { data } = await apiClient.get<ShipmentDetailResponse>(
    `/api/shipments/${id}`,
  );
  return data;
}
