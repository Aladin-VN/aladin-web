// ALADIN Zalo Bot — Conversation Engine (State Machine)
// Handles the full ordering flow via Zalo text messages
// States: IDLE → PRODUCT_SEARCH → ORDER_QTY → REVIEW → PAYMENT → CONFIRMED

import type { ConversationSession, ZaloProductResult, PaymentOption } from './config';
import {
  getOrCreateSession,
  updateSession,
  resetSession,
} from './config';
import {
  searchProducts,
  getPopularProducts,
  getCategoryList,
  getProductsByCategory,
  formatProductLine,
  formatVND,
  formatVNDShort,
} from './product-search';
import { db } from '../db';
import { generateIdempotencyKey, sanitizeInput, isValidVNDAmount, CREDIT_CONFIG } from '../security';

// ============================================
// MESSAGE HANDLER — Main routing
// ============================================

export interface BotResponse {
  replyText: string;
  quickReplies?: string[];
  state: string;
}

export async function handleZaloMessage(
  zaloUserId: string,
  messageText: string,
  language: 'vi' | 'en' = 'vi'
): Promise<BotResponse> {
  const session = getOrCreateSession(zaloUserId, language);
  const text = messageText.trim();

  // Auto-detect language from message
  if (text.toLowerCase().includes('switch to english') || text === 'en') {
    updateSession(zaloUserId, { language: 'en' });
    return createResponse(
      'Language switched to English. How can I help you today?\n\nSend a product name to search, or type "menu" to see categories.',
      ['menu', 'popular', 'help'],
      session.state
    );
  }
  if (text.includes('chuyển sang tiếng việt') || text === 'vi') {
    updateSession(zaloUserId, { language: 'vi' });
    return createResponse(
      'Đã chuyển sang tiếng Việt. Aladin có thể giúp gì cho bạn?\n\nGõ tên sản phẩm để tìm kiếm, hoặc nhấn "menu" để xem danh mục.',
      ['menu', 'phổ biến', 'giúp đỡ'],
      session.state
    );
  }

  // Route to state handler
  switch (session.state) {
    case 'IDLE':
      return handleIdleState(session, text, zaloUserId);
    case 'AWAITING_PRODUCT_SEARCH':
    case 'SHOWING_PRODUCTS':
      return handleSearchState(session, text, zaloUserId);
    case 'AWAITING_ORDER_QTY':
      return handleOrderQtyState(session, text, zaloUserId);
    case 'REVIEWING_ORDER':
      return handleReviewState(session, text, zaloUserId);
    case 'AWAITING_PAYMENT_METHOD':
      return handlePaymentState(session, text, zaloUserId);
    case 'ORDER_CONFIRMED':
      return handleConfirmedState(session, text, zaloUserId);
    default:
      resetSession(zaloUserId);
      return handleIdleState(session, text, zaloUserId);
  }
}

// ============================================
// STATE: IDLE — Entry point
// ============================================

async function handleIdleState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Help command
  if (text === 'help' || text === 'giúp đỡ' || text === 'hỗ trợ') {
    return createResponse(
      vi
        ? '🧞 ALADIN — AI Đặt hàng Thông minh\n\n' +
          '• Gõ tên sản phẩm để tìm kiếm\n' +
          '• "menu" — Xem danh mục sản phẩm\n' +
          '• "phổ biến" — Xem sản phẩm bán chạy\n' +
          '• "đơn hàng" — Xem đơn gần đây\n' +
          '• "hủy" — Xóa giỏ hàng\n' +
          '• "vi" / "en" — Đổi ngôn ngữ\n\n' +
          '💡 Mẹo: Gõ "gạo" để tìm tất cả sản phẩm gạo!'
        : '🧞 ALADIN — AI Smart Ordering\n\n' +
          '• Type a product name to search\n' +
          '• "menu" — Browse product categories\n' +
          '• "popular" — View trending products\n' +
          '• "orders" — View recent orders\n' +
          '• "cancel" — Clear your cart\n' +
          '• "vi" / "en" — Change language\n\n' +
          '💡 Tip: Type "rice" to find all rice products!',
      ['menu', vi ? 'phổ biến' : 'popular'],
      session.state
    );
  }

  // Menu command
  if (text === 'menu' || text === 'danh mục') {
    const categories = await getCategoryList();
    if (categories.length === 0) {
      return createResponse(vi ? 'Chưa có danh mục nào.' : 'No categories available yet.', [], session.state);
    }

    const catList = categories
      .map((c) => `${c.icon || '📦'} ${c.name} (${c.productCount} SP)`)
      .join('\n');

    updateSession(zaloUserId, { state: 'AWAITING_PRODUCT_SEARCH' });

    return createResponse(
      (vi ? '📋 Danh mục sản phẩm:\n\n' : '📋 Product Categories:\n\n') +
      catList + '\n\n' +
      (vi
        ? 'Gõ tên danh mục hoặc tên sản phẩm để tìm kiếm:'
        : 'Type a category name or product name to search:'),
      categories.map((c) => c.name),
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  // Popular/trending command
  if (text === 'popular' || text === 'phổ biến' || text === 'bán chạy') {
    const products = await getPopularProducts(5);
    if (products.length === 0) {
      return createResponse(vi ? 'Chưa có sản phẩm nào.' : 'No products available yet.', [], session.state);
    }

    const productLines = products.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
    updateSession(zaloUserId, { state: 'SHOWING_PRODUCTS', searchResults: products });

    return createResponse(
      (vi ? '🔥 Sản phẩm bán chạy:\n\n' : '🔥 Trending Products:\n\n') +
      productLines + '\n\n' +
      (vi ? 'Nhấn số thứ tự để chọn sản phẩm:' : 'Press the number to select a product:'),
      products.map((_, i) => `${i + 1}`),
      'SHOWING_PRODUCTS'
    );
  }

  // Cancel/clear cart
  if (text === 'cancel' || text === 'hủy' || text === 'xóa') {
    if (session.orderItems.length > 0) {
      resetSession(zaloUserId);
      return createResponse(
        vi ? '🗑️ Đã xóa giỏ hàng. Bạn muốn đặt gì tiếp?' : '🗑️ Cart cleared. What would you like to order?',
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }
    return createResponse(
      vi ? 'Giỏ hàng trống. Gõ tên sản phẩm để bắt đầu!' : 'Cart is empty. Type a product name to start!',
      ['menu', vi ? 'phổ biến' : 'popular'],
      session.state
    );
  }

  // Check if this looks like a product search (default behavior)
  if (text.length >= 2) {
    return handleSearchState(session, text, zaloUserId);
  }

  // Default greeting
  return createResponse(
    vi
      ? 'Xin chào! 👋 Tôi là AI Aladin.\nGõ tên sản phẩm để tìm kiếm, hoặc "menu" để xem danh mục.'
      : 'Hello! 👋 I\'m Aladin AI.\nType a product name to search, or "menu" to browse categories.',
    ['menu', 'help'],
    session.state
  );
}

// ============================================
// STATE: PRODUCT SEARCH
// ============================================

async function handleSearchState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Check if user selected a number from search results
  if (session.searchResults && /^\d+$/.test(text)) {
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < session.searchResults.length) {
      const product = session.searchResults[idx];
      if (product.stockQuantity === 0) {
        return createResponse(
          vi ? `❌ ${product.name} hiện hết hàng.\nChọn sản phẩm khác hoặc gõ "menu" để xem thêm.` : `❌ ${product.name} is out of stock.\nChoose another product or type "menu" for more.`,
          session.searchResults.map((_, i) => i === idx ? 'skip' : `${i + 1}`),
          'SHOWING_PRODUCTS'
        );
      }

      updateSession(zaloUserId, {
        state: 'AWAITING_ORDER_QTY',
        searchQuery: product.name,
      });

      return createResponse(
        (vi ? '📦 Đã chọn: ' : '📦 Selected: ') + product.name + '\n\n' +
        (vi ? 'Giá: ' : 'Price: ') + formatVND(product.basePrice) + '/' + product.unit +
        (product.groupBuyPrice ? `\n${vi ? 'Giá mua chung: ' : 'Group buy: '}${formatVND(product.groupBuyPrice)}` : '') +
        '\n' + (vi ? `Còn lại: ${product.stockQuantity} ${product.unit}` : `Available: ${product.stockQuantity} ${product.unit}`) + '\n\n' +
        (vi
          ? `Nhập số lượng (tối thiểu: 1, tối đa: ${product.stockQuantity}):`
          : `Enter quantity (min: 1, max: ${product.stockQuantity}):`),
        ['1', '2', '5', '10', (vi ? 'hủy' : 'cancel')],
        'AWAITING_ORDER_QTY'
      );
    }
  }

  // Perform product search
  const results = await searchProducts(text, 5);

  if (results.length === 0) {
    return createResponse(
      vi
        ? `🔍 Không tìm thấy "${text}"\n\nThử:\n• Gõ tên khác\n• "menu" để xem danh mục\n• "phổ biến" để xem bán chạy`
        : `🔍 No results for "${text}"\n\nTry:\n• Type a different name\n• "menu" for categories\n• "popular" for trending`,
      ['menu', vi ? 'phổ biến' : 'popular'],
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  const productLines = results.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');

  updateSession(zaloUserId, {
    state: 'SHOWING_PRODUCTS',
    searchQuery: text,
    searchResults: results,
  });

  return createResponse(
    (vi ? `🔍 Kết quả tìm kiếm "${text}":\n\n` : `🔍 Search results for "${text}":\n\n`) +
    productLines + '\n\n' +
    (vi
      ? 'Nhấn số để chọn, hoặc gõ tên khác để tìm tiếp:'
      : 'Press number to select, or type another name to search:'),
    [...results.map((_, i) => `${i + 1}`), vi ? 'menu' : 'back'],
    'SHOWING_PRODUCTS'
  );
}

// ============================================
// STATE: ORDER QUANTITY
// ============================================

async function handleOrderQtyState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Cancel
  if (text === 'cancel' || text === 'hủy' || text === 'back' || text === 'quay lại') {
    updateSession(zaloUserId, { state: 'AWAITING_PRODUCT_SEARCH' });
    return createResponse(
      vi ? '🔙 Quay lại tìm kiếm. Gõ tên sản phẩm hoặc "menu".' : '🔙 Back to search. Type a product name or "menu".',
      ['menu', vi ? 'phổ biến' : 'popular'],
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  // Parse quantity
  const qty = parseInt(text);
  if (isNaN(qty) || qty < 1) {
    session.errorCount++;
    return createResponse(
      vi
        ? '❌ Vui lòng nhập số lượng hợp lệ (số nguyên > 0).\nVí dụ: 5'
        : '❌ Please enter a valid quantity (whole number > 0).\nExample: 5',
      ['1', '2', '5', '10', (vi ? 'hủy' : 'cancel')],
      'AWAITING_ORDER_QTY'
    );
  }

  // Get the selected product
  if (!session.searchResults || session.searchResults.length === 0) {
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Use the first result as the selected product (or the one that matches the search query)
  const selectedProduct = session.searchResults[0];
  const maxQty = selectedProduct.stockQuantity;

  if (qty > maxQty) {
    return createResponse(
      vi
        ? `❌ Chỉ còn ${maxQty} ${selectedProduct.unit} trong kho.\nNhập lại số lượng:`
        : `❌ Only ${maxQty} ${selectedProduct.unit} available.\nEnter quantity again:`,
      [String(maxQty), String(Math.min(5, maxQty)), (vi ? 'hủy' : 'cancel')],
      'AWAITING_ORDER_QTY'
    );
  }

  // Add to order
  const unitPrice = selectedProduct.groupBuyPrice || selectedProduct.basePrice;
  const existingIdx = session.orderItems.findIndex((item) => item.productId === selectedProduct.id);

  if (existingIdx >= 0) {
    // Update existing item quantity
    session.orderItems[existingIdx].quantity += qty;
    session.orderItems[existingIdx].totalPrice = session.orderItems[existingIdx].quantity * unitPrice;
  } else {
    // Add new item
    session.orderItems.push({
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
      unitPrice,
      quantity: qty,
      totalPrice: qty * unitPrice,
    });
  }

  session.orderTotal = session.orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
  session.state = 'REVIEWING_ORDER';

  // Build order summary
  const orderSummary = session.orderItems
    .map((item, i) => `${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
    .join('\n');

  return createResponse(
    (vi ? '🛒 Giỏ hàng của bạn:\n\n' : '🛒 Your Cart:\n\n') +
    orderSummary + '\n\n' +
    (vi ? `Tổng: ${formatVND(session.orderTotal)}` : `Total: ${formatVND(session.orderTotal)}`) + '\n\n' +
    (vi ? '• "thêm" — Thêm sản phẩm khác\n• "đặt hàng" — Xác nhận đặt\n• "xóa" — Xóa giỏ hàng' : '• "add" — Add more items\n• "order" — Confirm order\n• "clear" — Clear cart'),
    [vi ? 'thêm' : 'add', vi ? 'đặt hàng' : 'order', vi ? 'xóa' : 'clear'],
    'REVIEWING_ORDER'
  );
}

// ============================================
// STATE: REVIEW ORDER
// ============================================

async function handleReviewState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Add more items
  if (text === 'add' || text === 'thêm' || text === 'them') {
    updateSession(zaloUserId, { state: 'AWAITING_PRODUCT_SEARCH' });
    return createResponse(
      vi ? '🔍 Gõ tên sản phẩm muốn thêm:' : '🔍 Type the product name to add:',
      ['menu', vi ? 'phổ biến' : 'popular'],
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  // Clear cart
  if (text === 'clear' || text === 'xóa' || text === 'hủy') {
    resetSession(zaloUserId);
    return createResponse(
      vi ? '🗑️ Đã xóa giỏ hàng.' : '🗑️ Cart cleared.',
      ['menu'],
      'IDLE'
    );
  }

  // Proceed to order / payment method selection
  if (text === 'order' || text === 'đặt hàng' || text === 'dat hang' || text === 'ok' || text === 'đồng ý') {
    if (session.orderItems.length === 0) {
      return createResponse(
        vi ? '🛒 Giỏ hàng trống. Gõ tên sản phẩm để đặt hàng!' : '🛒 Cart is empty. Type a product name to order!',
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }

    updateSession(zaloUserId, { state: 'AWAITING_PAYMENT_METHOD' });

    const payNowDiscount = Math.round(session.orderTotal * CREDIT_CONFIG.PAY_NOW_DISCOUNT);
    const creditTotal = formatVND(session.orderTotal);
    const discountedTotal = formatVND(session.orderTotal - payNowDiscount);

    return createResponse(
      (vi ? '💰 Chọn phương thức thanh toán:\n\n' : '💰 Choose payment method:\n\n') +
      `1. ${vi ? 'Trả ngay (MoMo/ZaloPay)' : 'Pay Now (MoMo/ZaloPay)'}\n   ${vi ? `Giảm ${CREDIT_CONFIG.PAY_NOW_DISCOUNT * 100}% → ` : `Save ${CREDIT_CONFIG.PAY_NOW_DISCOUNT * 100}% → `}${discountedTotal}\n\n` +
      `2. ${vi ? 'Nợ 7 ngày (Tín dụng Aladin)' : '7-Day Credit (Aladin Credit)'}\n   ${vi ? 'Thanh toán trong 7 ngày' : 'Pay within 7 days'} → ${creditTotal}\n\n` +
      `3. COD\n   ${vi ? 'Trả tiền khi nhận hàng' : 'Pay on delivery'} → ${creditTotal}`,
      ['1', '2', '3', (vi ? 'quay lại' : 'back')],
      'AWAITING_PAYMENT_METHOD'
    );
  }

  // Unknown command
  return createResponse(
    vi
      ? 'Gõ "thêm" để mua thêm, "đặt hàng" để xác nhận, hoặc "xóa" để hủy.'
      : 'Type "add" for more items, "order" to confirm, or "clear" to cancel.',
    [vi ? 'thêm' : 'add', vi ? 'đặt hàng' : 'order', vi ? 'xóa' : 'clear'],
    'REVIEWING_ORDER'
  );
}

// ============================================
// STATE: PAYMENT METHOD
// ============================================

async function handlePaymentState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Back
  if (text === 'back' || text === 'quay lại') {
    updateSession(zaloUserId, { state: 'REVIEWING_ORDER' });
    const orderSummary = session.orderItems
      .map((item, i) => `${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
      .join('\n');
    return createResponse(
      (vi ? '🛒 Giỏ hàng:\n\n' : '🛒 Your Cart:\n\n') +
      orderSummary + '\n\n' +
      (vi ? '"đặt hàng" để tiếp tục, "thêm" để mua thêm' : '"order" to proceed, "add" for more items'),
      [vi ? 'đặt hàng' : 'order', vi ? 'thêm' : 'add'],
      'REVIEWING_ORDER'
    );
  }

  // Parse payment method
  let paymentMethod: PaymentOption | null = null;
  let finalTotal = session.orderTotal;

  if (text === '1') {
    paymentMethod = 'DIGITAL';
    finalTotal = session.orderTotal - Math.round(session.orderTotal * CREDIT_CONFIG.PAY_NOW_DISCOUNT);
  } else if (text === '2') {
    paymentMethod = 'CREDIT';
  } else if (text === '3') {
    paymentMethod = 'COD';
  } else if (text === 'digital' || text === 'momo' || text === 'zalopay') {
    paymentMethod = 'DIGITAL';
    finalTotal = session.orderTotal - Math.round(session.orderTotal * CREDIT_CONFIG.PAY_NOW_DISCOUNT);
  } else if (text === 'credit' || text === 'nợ' || text === 'tín dụng') {
    paymentMethod = 'CREDIT';
  } else if (text === 'cod') {
    paymentMethod = 'COD';
  }

  if (!paymentMethod) {
    return createResponse(
      vi ? '❌ Vui lòng chọn 1 (Trả ngay), 2 (Nợ 7 ngày), hoặc 3 (COD):' : '❌ Please choose 1 (Pay Now), 2 (7-Day Credit), or 3 (COD):',
      ['1', '2', '3'],
      'AWAITING_PAYMENT_METHOD'
    );
  }

  // Create the order in the database
  try {
    const orderItems = session.orderItems;
    const subtotalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = session.orderTotal - finalTotal;
    const deliveryFee = paymentMethod === 'COD' ? 15000 : 0;

    const orderNumber = `ALD-${Date.now().toString(36).toUpperCase()}`;

    // Try to find or create shop for this Zalo user
    let shop = await findOrCreateShopByZaloUser(zaloUserId);

    const order = await db.order.create({
      data: {
        orderNumber,
        shopId: shop.id,
        shopSnapshot: JSON.stringify({ name: shop.name, phone: shop.user?.phone || zaloUserId }),
        status: 'PENDING',
        paymentMethod,
        paymentStatus: paymentMethod === 'DIGITAL' ? 'PENDING' : 'PENDING',
        subtotalAmount,
        discountAmount,
        deliveryFee,
        totalAmount: finalTotal + deliveryFee,
        creditUsed: paymentMethod === 'CREDIT' ? finalTotal + deliveryFee : 0,
        idempotencyKey: generateIdempotencyKey(zaloUserId),
        customerNotes: vi ? `Đặt qua Zalo AI Bot` : `Ordered via Zalo AI Bot`,
      },
    });

    // Create order items
    for (const item of orderItems) {
      await db.orderItem.create({
        data: {
          orderId: order.id,
          productId: item.productId,
          productName: item.productName,
          productSku: item.sku,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
        },
      });
    }

    // Reset session
    resetSession(zaloUserId);

    const paymentLabels: Record<string, string> = {
      DIGITAL: vi ? 'Trả ngay (MoMo/ZaloPay)' : 'Pay Now (MoMo/ZaloPay)',
      CREDIT: vi ? 'Nợ 7 ngày' : '7-Day Credit',
      COD: 'COD',
    };

    return createResponse(
      (vi ? '✅ Đặt hàng thành công!\n\n' : '✅ Order confirmed!\n\n') +
      (vi ? '📌 Mã đơn: ' : '📌 Order: ') + orderNumber + '\n' +
      `${orderItems.length} ${vi ? 'sản phẩm' : 'items'} | ${formatVND(finalTotal + deliveryFee)}\n` +
      (vi ? '💳 Thanh toán: ' : '💳 Payment: ') + paymentLabels[paymentMethod] +
      (discountAmount > 0 ? ` ${vi ? '(Đã giảm' : '(Saved'} ${formatVND(discountAmount)})` : '') + '\n\n' +
      (vi ? '⏱ Đơn hàng đang được xử lý. Bạn sẽ nhận thông báo khi giao hàng!' : '⏱ Your order is being processed. You\'ll be notified on delivery!'),
      [vi ? 'đơn hàng' : 'orders', 'menu'],
      'ORDER_CONFIRMED'
    );
  } catch (error) {
    console.error('[ZALO ORDER CREATE ERROR]', error);
    resetSession(zaloUserId);
    return createResponse(
      vi
        ? '❌ Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.\nGõ "help" để xem hướng dẫn.'
        : '❌ An error occurred while creating your order. Please try again.\nType "help" for instructions.',
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: ORDER CONFIRMED — Post-order
// ============================================

async function handleConfirmedState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Any message resets to idle
  resetSession(zaloUserId);
  return handleIdleState(session, text, zaloUserId);
}

// ============================================
// HELPER: Find or Create Shop by Zalo User
// ============================================

async function findOrCreateShopByZaloUser(zaloUserId: string) {
  // Try to find existing user with this Zalo ID
  let user = await db.user.findUnique({ where: { zaloId: zaloUserId } });

  if (user && user.shop) {
    return user.shop;
  }

  // If no user, create a pending one
  if (!user) {
    user = await db.user.create({
      data: {
        zaloId: zaloUserId,
        phone: `zalo_${zaloUserId.slice(-6)}`,
        name: `Zalo User ${zaloUserId.slice(-4)}`,
        role: 'SHOP_OWNER',
        status: 'ACTIVE',
      },
    });
  }

  // Check if shop exists
  const existingShop = await db.shop.findUnique({ where: { userId: user.id } });
  if (existingShop) return existingShop;

  // Create shop
  const shop = await db.shop.create({
    data: {
      userId: user.id,
      name: `Cửa hàng Zalo ${zaloUserId.slice(-4)}`,
      province: 'Binh Duong',
      creditLimit: CREDIT_CONFIG.DEFAULT_LIMIT,
      creditBalance: 0,
      creditStatus: 'ACTIVE',
      loyaltyTier: 'BRONZE',
    },
    include: { user: true },
  });

  return shop;
}

// ============================================
// HELPER: Create response object
// ============================================

function createResponse(replyText: string, quickReplies: string[] = [], state: string): BotResponse {
  return { replyText, quickReplies, state };
}
