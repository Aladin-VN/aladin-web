// ALADIN Zalo Bot — Configuration & Types
// Zalo OA Integration with <5s webhook response guarantee

// ============================================
// ZALO OA CONFIGURATION
// ============================================

export const ZALO_CONFIG = {
  OA_ID: process.env.ZALO_OA_ID || '',
  OA_ACCESS_TOKEN: process.env.ZALO_OA_ACCESS_TOKEN || '',
  APP_ID: process.env.ZALO_APP_ID || '',
  APP_SECRET: process.env.ZALO_APP_SECRET || '',
  WEBHOOK_VERIFICATION_TOKEN: process.env.ZALO_WEBHOOK_TOKEN || 'aladin-zalo-webhook-token-dev',

  // API Endpoints
  API_BASE: 'https://openapi.zalo.me/v2.0',
  SEND_MESSAGE_URL: 'https://openapi.zalo.me/v2.0/oa/message',
  GET_PROFILE_URL: 'https://openapi.zalo.me/v2.0/oa/getprofile',

  // Timeouts
  WEBHOOK_RESPONSE_MS: 4500, // Must respond <5s, leave 500ms margin
  ASYNC_PROCESS_TIMEOUT_MS: 30000, // Max time for async AI processing
} as const;

// ============================================
// CONVERSATION STATE MACHINE
// ============================================

export type ConversationState =
  | 'IDLE'
  | 'AWAITING_PRODUCT_SEARCH'
  | 'SHOWING_PRODUCTS'
  | 'AWAITING_ORDER_QTY'
  | 'REVIEWING_ORDER'
  | 'AWAITING_PAYMENT_METHOD'
  | 'ORDER_CONFIRMED'
  | 'AWAITING_IMAGE_INVOICE'
  | 'AWAITING_ORDER_LOOKUP'
  | 'SHOWING_ORDERS'
  | 'AWAITING_CREDIT_INFO'
  | 'AWAITING_REPAY_ORDER'
  | 'AWAITING_REPAY_AMOUNT'
  | 'REGISTRATION_START'
  | 'AWAITING_SHOP_NAME'
  | 'AWAITING_SHOP_ADDRESS'
  | 'AWAITING_SHOP_DISTRICT'
  | 'AWAITING_SHOP_TYPE'
  | 'AWAITING_SEARCH_QUERY'
  | 'SHOWING_PRODUCT_DETAIL';

export type PaymentOption = 'DIGITAL' | 'CREDIT' | 'COD';

export interface ConversationSession {
  zaloUserId: string;
  userId?: string;
  shopId?: string;
  state: ConversationState;
  stateEnteredAt: number; // timestamp
  lastMessageAt: number;
  language: 'vi' | 'en';

  // Search context
  searchQuery?: string;
  searchResults?: ZaloProductResult[];

  // Order context
  orderItems: ZaloOrderItem[];
  orderTotal: number;
  paymentMethod?: PaymentOption;
  paymentDiscount?: number;

  // Error recovery
  errorCount: number;
  lastErrorAt?: number;

  // Order lookup context
  recentOrders?: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    itemCount: number;
    paymentMethod: string;
    createdAt: Date;
  }>;

  // Repay context
  creditOrders?: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    creditUsed: number;
    dueDate: string;
  }>;
  selectedRepayOrderId?: string;

  // Registration context
  registrationData?: {
    shopName: string;
    address: string;
    district: string;
    shopType: string;
  };

  // Category browse & product detail context
  selectedProductIndex?: number;
  browsingCategoryId?: string;
}

export interface ZaloProductResult {
  id: string;
  sku: string;
  name: string;
  nameEn?: string;
  basePrice: number;
  groupBuyPrice?: number | null;
  unit: string;
  stockQuantity: number;
  category: string;
  isPrivateLabel: boolean;
}

export interface ZaloOrderItem {
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

// Session store (in-memory — replace with Redis in production)
const sessionStore = new Map<string, ConversationSession>();

// Session TTL: 30 minutes of inactivity
const SESSION_TTL_MS = 30 * 60 * 1000;

// Cleanup expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessionStore.entries()) {
    if (now - session.lastMessageAt > SESSION_TTL_MS) {
      sessionStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// SESSION MANAGEMENT
// ============================================

export function getOrCreateSession(zaloUserId: string, language: 'vi' | 'en' = 'vi'): ConversationSession {
  const existing = sessionStore.get(zaloUserId);
  if (existing && Date.now() - existing.lastMessageAt <= SESSION_TTL_MS) {
    existing.lastMessageAt = Date.now();
    return existing;
  }

  const newSession: ConversationSession = {
    zaloUserId,
    state: 'IDLE',
    stateEnteredAt: Date.now(),
    lastMessageAt: Date.now(),
    language,
    orderItems: [],
    orderTotal: 0,
    errorCount: 0,
  };

  sessionStore.set(zaloUserId, newSession);
  return newSession;
}

export function updateSession(zaloUserId: string, updates: Partial<ConversationSession>): ConversationSession {
  const session = sessionStore.get(zaloUserId);
  if (!session) {
    throw new Error('Session not found');
  }
  Object.assign(session, updates, { lastMessageAt: Date.now() });
  return session;
}

export function resetSession(zaloUserId: string): ConversationSession {
  const session = getOrCreateSession(zaloUserId);
  session.state = 'IDLE';
  session.stateEnteredAt = Date.now();
  session.searchQuery = undefined;
  session.searchResults = undefined;
  session.orderItems = [];
  session.orderTotal = 0;
  session.paymentMethod = undefined;
  session.paymentDiscount = undefined;
  session.errorCount = 0;
  session.recentOrders = undefined;
  session.creditOrders = undefined;
  session.selectedRepayOrderId = undefined;
  session.registrationData = undefined;
  session.selectedProductIndex = undefined;
  session.browsingCategoryId = undefined;
  return session;
}

export function destroySession(zaloUserId: string): void {
  sessionStore.delete(zaloUserId);
}

// ============================================
// ZALO MESSAGE TYPES
// ============================================

export interface ZaloWebhookEvent {
  event_name: string;
  data: {
    user_id: string;
    message: {
      msg_id: string;
      text?: string;
      attachments?: Array<{
        type: string;
        thumbnail_url?: string;
        full_size_url?: string;
        content_source?: string;
      }>;
    };
    timestamp: number;
  };
}

export interface ZaloSendRequest {
  recipient: { user_id: string };
  message: {
    text?: string;
    attachment?: {
      type: 'template' | 'file';
      payload: {
        template_type?: 'list' | 'media';
        elements?: Array<{
          headline: string;
          sub_headline?: string;
          default_action?: {
            type: 'oa.open.link';
            url: string;
          };
          image_url?: string;
        }>;
        content_type?: string;
        url?: string;
        name?: string;
      };
    };
  };
}

export interface ZaloVerificationPayload {
  oa_id: string;
  timestamp: number;
}
