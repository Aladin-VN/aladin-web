// ALADIN Platform TypeScript Types
// Strict typing for all business entities

// ============================================
// USER TYPES
// ============================================

export type UserRole = 'ADMIN' | 'SHOP_OWNER' | 'SALES_REP' | 'DRIVER' | 'BROKER';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface UserSafe {
  id: string;
  phone: string;
  email?: string | null;
  name: string;
  nameEn?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  status: UserStatus;
  zaloId?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shop?: ShopSummary | null;
  broker?: BrokerSummary | null;
}

// ============================================
// SHOP TYPES
// ============================================

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type CreditStatus = 'ACTIVE' | 'LOCKED' | 'OVERDUE';

export interface ShopSummary {
  id: string;
  name: string;
  district?: string | null;
  province: string;
  loyaltyTier: LoyaltyTier;
  creditLimit: number;
  creditBalance: number;
  creditStatus: CreditStatus;
  totalOrders: number;
}

export interface ShopDetail extends ShopSummary {
  userId: string;
  wardId?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  shopType: string;
  totalGmv: number;
  avgOrderValue: number;
  createdAt: Date;
}

// ============================================
// PRODUCT TYPES
// ============================================

export interface ProductSummary {
  id: string;
  sku: string;
  name: string;
  nameEn?: string | null;
  brand?: string | null;
  unit: string;
  basePrice: number;
  groupBuyPrice?: number | null;
  stockQuantity: number;
  imageUrl?: string | null;
  isActive: boolean;
  category: { id: string; name: string; };
}

export interface ProductDetail extends ProductSummary {
  description?: string | null;
  descriptionEn?: string | null;
  categoryId: string;
  minOrderQty: number;
  maxOrderQty?: number | null;
  weightKg?: number | null;
  isPrivateLabel: boolean;
  barcode?: string | null;
  manufacturer?: { id: string; name: string; } | null;
  distributor?: { id: string; name: string; } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategorySummary {
  id: string;
  name: string;
  nameEn?: string | null;
  slug: string;
  icon?: string | null;
  productCount: number;
}

// ============================================
// ORDER TYPES
// ============================================

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'PACKED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type PaymentMethod = 'CREDIT' | 'DIGITAL' | 'COD';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

export interface OrderItemDetail {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  freeQty: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  shopName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  totalAmountFormatted?: string;
  itemCount: number;
  createdAt: Date;
}

export interface OrderDetail extends OrderSummary {
  shopId: string;
  shopPhone?: string;
  shopAddress?: string;
  shopDistrict?: string;
  shopProvince?: string;
  shopSnapshot?: string;
  subtotalAmount: number;
  subtotalAmountFormatted?: string;
  discountAmount: number;
  discountAmountFormatted?: string;
  deliveryFee: number;
  deliveryFeeFormatted?: string;
  paidAmount: number;
  paidAmountFormatted?: string;
  creditUsed: number;
  creditUsedFormatted?: string;
  customerNotes?: string | null;
  adminNotes?: string | null;
  groupDealId?: string | null;
  thirdPartyOrderId?: string | null;
  confirmedAt?: Date | null;
  packedAt?: Date | null;
  deliveredAt?: Date | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  items: OrderItemDetail[];
  shipment?: ShipmentDetail | null;
  transactions?: TransactionSummary[];
}

// ============================================
// TRANSACTION (CREDIT LEDGER) TYPES
// ============================================

export type TransactionType = 'CREDIT_USED' | 'REPAYMENT' | 'CREDIT_LIMIT_INCREASE' | 'CREDIT_LIMIT_DECREASE' | 'ORDER_PAYMENT' | 'REFUND';

export interface TransactionSummary {
  id: string;
  type: TransactionType;
  amount: number;
  runningBalance: number;
  paymentMethod?: string | null;
  description?: string | null;
  createdAt: Date;
}

// ============================================
// GROUP BUY TYPES
// ============================================

export type GroupDealStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface GroupDealSummary {
  id: string;
  title: string;
  titleEn?: string | null;
  productId: string;
  productName: string;
  targetQty: number;
  currentQty: number;
  originalPrice: number;
  discountPrice: number;
  status: GroupDealStatus;
  expiresAt: Date;
  participantCount: number;
  progressPercent: number; // currentQty / targetQty * 100
}

// ============================================
// SHIPMENT TYPES
// ============================================

export type ShipmentStatus = 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface ShipmentSummary {
  id: string;
  type: 'INTERNAL' | 'THIRD_PARTY';
  status: ShipmentStatus;
  assignedDriverName?: string | null;
  assignedDriverPhone?: string | null;
  dropoffAddress: string;
  pickupAddress?: string | null;
  deliveredAt?: Date | null;
  thirdPartyTrackingId?: string | null;
  createdAt?: Date;
}

export interface ShipmentDetail extends ShipmentSummary {
  orderId: string;
  orderNumber?: string;
  assignedDriverId?: string | null;
  assignedDriver?: {
    id: string;
    name: string;
    phone: string;
    avatarUrl?: string | null;
  } | null;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
  podPhotoUrl?: string | null;
  podSignatureUrl?: string | null;
  podOtp?: string | null;
  thirdPartyStatus?: string | null;
  updatedAt?: Date;
  order?: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    orderTotal: number;
    orderTotalFormatted?: string;
    paymentMethod: string;
    items: Array<{
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      unitPriceFormatted?: string;
      totalPrice: number;
      totalPriceFormatted?: string;
    }>;
    shop: {
      id: string;
      name: string;
      phone: string;
      address?: string;
      district?: string;
      province: string;
    };
  };
}

// ============================================
// BROKER TYPES
// ============================================

export type BrokerTier = 'WARD_LEVEL' | 'CATEGORY_SPECIALIST' | 'FACTORY_GATE';

export interface BrokerSummary {
  id: string;
  userId: string;
  userName: string;
  tier: BrokerTier;
  commissionRate: number;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalGmvGenerated: number;
}

// ============================================
// PROMOTION TYPES
// ============================================

export type PromoType = 'BUY_X_GET_Y' | 'PERCENT_OFF' | 'FIXED_DISCOUNT';

export interface PromotionSummary {
  id: string;
  title: string;
  promoType: PromoType;
  manufacturerName: string;
  isActive: boolean;
  startsAt: Date;
  expiresAt: Date;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  totalShops: number;
  activeShops: number;
  totalOrders: number;
  monthlyGmv: number;
  monthlyGmvGrowth: number; // percentage
  avgOrderValue: number;
  retentionRate: number; // percentage
  creditExposure: number; // total outstanding credit
  overdueAccounts: number;
  pendingShipments: number;
  activeGroupDeals: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalQty: number;
  totalRevenue: number;
}

// ============================================
// API TYPES
// ============================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// CREDIT INFO TYPES (Sprint M5)
// ============================================

export interface CreditInfoData {
  limit: number;
  used: number;
  available: number;
  status: CreditStatus;
  utilizationPercent: number;
  daysUntilDue: number | null;
}

export interface CreditMonthlyStats {
  totalRepaid: number;
  totalCreditUsed: number;
}

export interface CreditMyInfoResponse {
  shop: {
    id: string;
    name: string;
    loyaltyTier: string;
  };
  credit: CreditInfoData;
  monthly: CreditMonthlyStats;
  transactions: TransactionDetail[];
}

export interface TransactionDetail {
  id: string;
  type: TransactionType;
  amount: number;
  runningBalance: number;
  paymentMethod?: string | null;
  description?: string | null;
  orderNumber?: string | null;
  collectedByName?: string | null;
  formattedBalance?: string;
  createdAt: Date;
}
