// ALADIN Zalo Bot — Conversation Engine (State Machine)
// Handles the full ordering flow via Zalo text messages
// States: IDLE → PRODUCT_SEARCH → ORDER_QTY → REVIEW → PAYMENT → CONFIRMED
// Enhanced with Orders, Credit, and Repayment commands

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
import {
  generateIdempotencyKey,
  sanitizeInput,
  isValidVNDAmount,
  CREDIT_CONFIG,
  TRANSACTION_TYPES,
  PAYMENT_METHOD,
} from '../security';
import {
  getShopCreditInfo,
  getDaysUntilDue,
  calculateAvailableCredit,
} from '../credit-engine';

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
    case 'AWAITING_ORDER_LOOKUP':
    case 'SHOWING_ORDERS':
      return handleOrderLookupState(session, text, zaloUserId);
    case 'AWAITING_CREDIT_INFO':
      return handleCreditInfoState(session, text, zaloUserId);
    case 'AWAITING_REPAY_ORDER':
      return handleRepayOrderState(session, text, zaloUserId);
    case 'AWAITING_REPAY_AMOUNT':
      return handleRepayAmountState(session, text, zaloUserId);
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
          '• "tín dụng" — Xem tài khoản tín dụng\n' +
          '• "trả nợ" — Thanh toán nợ\n' +
          '• "hủy" — Xóa giỏ hàng\n' +
          '• "vi" / "en" — Đổi ngôn ngữ\n\n' +
          '💡 Mẹo: Gõ "gạo" để tìm tất cả sản phẩm gạo!'
        : '🧞 ALADIN — AI Smart Ordering\n\n' +
          '• Type a product name to search\n' +
          '• "menu" — Browse product categories\n' +
          '• "popular" — View trending products\n' +
          '• "orders" — View recent orders\n' +
          '• "credit" — View credit account\n' +
          '• "repay" — Make a repayment\n' +
          '• "cancel" — Clear your cart\n' +
          '• "vi" / "en" — Change language\n\n' +
          '💡 Tip: Type "rice" to find all rice products!',
      ['menu', vi ? 'phổ biến' : 'popular', vi ? 'đơn hàng' : 'orders'],
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

  // Orders command
  if (text === 'orders' || text === 'đơn hàng') {
    return handleOrdersCommand(session, zaloUserId);
  }

  // Credit command
  if (text === 'credit' || text === 'tín dụng') {
    return handleCreditCommand(session, zaloUserId);
  }

  // Repay command
  if (text === 'repay' || text === 'trả nợ') {
    return handleRepayCommand(session, zaloUserId);
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

    return handleShowPaymentOptions(session, zaloUserId);
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
// HELPER: Show Payment Options (with credit checks)
// ============================================

async function handleShowPaymentOptions(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  updateSession(zaloUserId, { state: 'AWAITING_PAYMENT_METHOD' });

  const payNowDiscount = Math.round(session.orderTotal * CREDIT_CONFIG.PAY_NOW_DISCOUNT);
  const creditTotal = formatVND(session.orderTotal);
  const discountedTotal = formatVND(session.orderTotal - payNowDiscount);
  const codTotal = formatVND(session.orderTotal + 15000);

  // Check shop credit status
  let creditWarning = '';
  let creditDisabled = false;
  let creditAvailableInfo = '';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);
    const shopWithCredit = await db.shop.findUnique({
      where: { id: shop.id },
      select: { creditLimit: true, creditBalance: true, creditStatus: true },
    });

    if (shopWithCredit) {
      const available = calculateAvailableCredit(shopWithCredit);
      creditAvailableInfo = (vi ? 'Còn lại: ' : 'Available: ') + formatVND(available);

      if (shopWithCredit.creditStatus === 'LOCKED') {
        creditWarning = (vi
          ? '⚠️ Tín dụng đã bị khóa. Vui lòng trả nợ để mở khóa.'
          : '⚠️ Credit is locked. Please repay to unlock.');
        creditDisabled = true;
      } else if (shopWithCredit.creditStatus === 'OVERDUE') {
        creditWarning = (vi
          ? '🔴 Tín dụng đã quá hạn! Vui lòng trả nợ ngay.'
          : '🔴 Credit is overdue! Please repay immediately.');
        creditDisabled = true;
      } else if (available < session.orderTotal) {
        creditWarning = (vi
          ? `⚠️ Hạn mức tín dụng không đủ. ${vi ? 'Còn lại' : 'Available'}: ${formatVND(available)}`
          : `⚠️ Insufficient credit. Available: ${formatVND(available)}`);
        creditDisabled = true;
      }
    }
  } catch {
    // If shop lookup fails, just show standard options
  }

  let paymentText =
    (vi ? '💰 Chọn phương thức thanh toán:\n\n' : '💰 Choose payment method:\n\n') +
    `1. ${vi ? 'Trả ngay (MoMo/ZaloPay)' : 'Pay Now (MoMo/ZaloPay)'}\n` +
    `   ${vi ? `Giảm ${CREDIT_CONFIG.PAY_NOW_DISCOUNT * 100}% → ` : `Save ${CREDIT_CONFIG.PAY_NOW_DISCOUNT * 100}% → `}${discountedTotal}\n\n`;

  if (creditDisabled) {
    paymentText += `2. ${vi ? 'Nợ 7 ngày (Tín dụng Aladin) — 🔒 KHÔNG HOẠT ĐỘNG' : '7-Day Credit (Aladin Credit) — 🔒 DISABLED'}\n`;
    if (creditWarning) paymentText += `   ${creditWarning}\n`;
    paymentText += '\n';
  } else {
    paymentText += `2. ${vi ? 'Nợ 7 ngày (Tín dụng Aladin)' : '7-Day Credit (Aladin Credit)'}\n`;
    paymentText += `   ${vi ? 'Thanh toán trong 7 ngày' : 'Pay within 7 days'} → ${creditTotal}`;
    if (creditAvailableInfo) paymentText += ` (${creditAvailableInfo})`;
    paymentText += '\n\n';
  }

  paymentText +=
    `3. COD\n` +
    `   ${vi ? 'Trả tiền khi nhận hàng (+15.000d phí)' : 'Pay on delivery (+15,000d fee)'} → ${codTotal}`;

  const quickReplies = ['1', '3', (vi ? 'quay lại' : 'back')];
  if (!creditDisabled) quickReplies.splice(1, 0, '2');

  return createResponse(paymentText, quickReplies, 'AWAITING_PAYMENT_METHOD');
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

  // Create the order in the database (atomic transaction)
  try {
    const orderItems = session.orderItems;
    const subtotalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const discountAmount = session.orderTotal - finalTotal;
    const deliveryFee = paymentMethod === 'COD' ? 15000 : 0;
    const grandTotal = finalTotal + deliveryFee;

    // Find or create shop
    let shop = await findOrCreateShopByZaloUser(zaloUserId);

    // Re-fetch shop with credit info for credit validation
    const shopWithCredit = await db.shop.findUnique({
      where: { id: shop.id },
      include: { user: { select: { phone: true, name: true } } },
    });

    if (!shopWithCredit) {
      throw new Error('Shop not found after creation');
    }
    shop = shopWithCredit as typeof shop & { user: { phone: string; name: string } };

    // Credit validation
    if (paymentMethod === 'CREDIT') {
      if (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE') {
        return createResponse(
          vi
            ? `❌ Tín dụng đã ${shop.creditStatus === 'OVERDUE' ? 'quá hạn' : 'bị khóa'}. Không thể đặt hàng nợ.\nVui lòng "trả nợ" hoặc chọn phương thức khác.`
            : `❌ Credit is ${shop.creditStatus.toLowerCase()}. Cannot place credit order.\nPlease "repay" or choose another method.`,
          ['1', '3', (vi ? 'quay lại' : 'back')],
          'AWAITING_PAYMENT_METHOD'
        );
      }

      const available = shop.creditLimit - shop.creditBalance;
      if (available < grandTotal) {
        return createResponse(
          vi
            ? `❌ Hạn mức tín dụng không đủ.\nCòn lại: ${formatVND(available)}\nCần: ${formatVND(grandTotal)}\n\nChọn phương thức khác hoặc "trả nợ".`
            : `❌ Insufficient credit.\nAvailable: ${formatVND(available)}\nRequired: ${formatVND(grandTotal)}\n\nChoose another method or "repay".`,
          ['1', '3', (vi ? 'trả nợ' : 'repay')],
          'AWAITING_PAYMENT_METHOD'
        );
      }
    }

    // Generate order number: ALD-YYYYMMDD-XXX
    const today = new Date();
    const dateStr = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const prefix = `ALD-${dateStr}-`;

    const lastOrder = await db.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    let seq = 1;
    if (lastOrder) {
      const lastSeq = parseInt(lastOrder.orderNumber.slice(prefix.length));
      seq = lastSeq + 1;
    }
    const orderNumber = `${prefix}${String(seq).padStart(3, '0')}`;

    // Build shop snapshot
    const shopSnapshot = JSON.stringify({
      id: shop.id,
      name: shop.name,
      nameEn: shop.nameEn || null,
      phone: shop.user?.phone || zaloUserId,
      address: shop.address || null,
      district: shop.district || null,
      province: shop.province,
      shopType: shop.shopType,
    });

    // Generate idempotency key
    const idempotencyKey = generateIdempotencyKey(zaloUserId);

    // Atomic order creation
    const order = await db.$transaction(async (tx) => {
      // Verify stock again within transaction
      for (const item of orderItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stockQuantity < item.quantity) {
          throw new Error(
            vi
              ? `Sản phẩm "${item.productName}" không đủ hàng`
              : `Product "${item.productName}" out of stock`
          );
        }
      }

      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber,
          shopId: shop.id,
          shopSnapshot,
          status: 'PENDING',
          paymentMethod,
          paymentStatus: 'PENDING',
          subtotalAmount,
          discountAmount,
          deliveryFee,
          totalAmount: grandTotal,
          creditUsed: paymentMethod === 'CREDIT' ? grandTotal : 0,
          idempotencyKey,
          customerNotes: vi ? 'Đặt qua Zalo AI Bot' : 'Ordered via Zalo AI Bot',
        },
      });

      // Create order items
      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            productName: item.productName,
            productSku: item.sku,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
          },
        });
      }

      // Deduct stock
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // If CREDIT payment: create CREDIT_USED transaction and update shop balance
      if (paymentMethod === 'CREDIT' && grandTotal > 0) {
        const newBalance = shop.creditBalance + grandTotal;
        await tx.transaction.create({
          data: {
            shopId: shop.id,
            orderId: newOrder.id,
            type: TRANSACTION_TYPES.CREDIT_USED,
            amount: grandTotal,
            runningBalance: newBalance,
            paymentMethod: PAYMENT_METHOD.CREDIT,
            description: `Order ${orderNumber} — credit used`,
          },
        });

        await tx.shop.update({
          where: { id: shop.id },
          data: {
            creditBalance: newBalance,
            // Auto-lock if at limit
            ...(newBalance >= shop.creditLimit ? { creditStatus: 'LOCKED' } : {}),
          },
        });
      }

      // Update shop stats
      await tx.shop.update({
        where: { id: shop.id },
        data: {
          totalOrders: { increment: 1 },
          totalGmv: { increment: grandTotal },
        },
      });

      // Recalculate avgOrderValue
      const updatedShop = await tx.shop.findUnique({ where: { id: shop.id } });
      if (updatedShop && updatedShop.totalOrders > 0) {
        await tx.shop.update({
          where: { id: shop.id },
          data: {
            avgOrderValue: Math.round(updatedShop.totalGmv / updatedShop.totalOrders),
          },
        });
      }

      return newOrder;
    });

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
      `${orderItems.length} ${vi ? 'sản phẩm' : 'items'} | ${formatVND(grandTotal)}\n` +
      (vi ? '💳 Thanh toán: ' : '💳 Payment: ') + paymentLabels[paymentMethod] +
      (discountAmount > 0 ? ` ${vi ? '(Đã giảm' : '(Saved'} ${formatVND(discountAmount)})` : '') +
      (deliveryFee > 0 ? ` ${vi ? '(+ phí ship' : '(+ delivery fee'} ${formatVND(deliveryFee)})` : '') + '\n\n' +
      (vi ? '⏱ Đơn hàng đang được xử lý. Bạn sẽ nhận thông báo khi giao hàng!' : '⏱ Your order is being processed. You\'ll be notified on delivery!'),
      [vi ? 'đơn hàng' : 'orders', 'menu'],
      'ORDER_CONFIRMED'
    );
  } catch (error) {
    console.error('[ZALO ORDER CREATE ERROR]', error);
    const errorMsg = error instanceof Error ? error.message : '';
    resetSession(zaloUserId);
    return createResponse(
      vi
        ? `❌ Có lỗi xảy ra khi tạo đơn hàng. Vui lòng thử lại.${errorMsg ? '\n' + errorMsg : ''}\nGõ "help" để xem hướng dẫn.`
        : `❌ An error occurred while creating your order. Please try again.${errorMsg ? '\n' + errorMsg : ''}\nType "help" for instructions.`,
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

  // Orders command
  if (text === 'orders' || text === 'đơn hàng') {
    return handleOrdersCommand(session, zaloUserId);
  }

  // Credit command
  if (text === 'credit' || text === 'tín dụng') {
    return handleCreditCommand(session, zaloUserId);
  }

  // Repay command
  if (text === 'repay' || text === 'trả nợ') {
    return handleRepayCommand(session, zaloUserId);
  }

  // Any message resets to idle
  resetSession(zaloUserId);
  return handleIdleState(session, text, zaloUserId);
}

// ============================================
// COMMANDS: Orders (đơn hàng / orders)
// ============================================

async function handleOrdersCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);
    const orders = await db.order.findMany({
      where: { shopId: shop.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        items: { select: { id: true } },
      },
    });

    if (orders.length === 0) {
      return createResponse(
        vi
          ? '📋 Bạn chưa có đơn hàng nào.\nGõ tên sản phẩm để đặt hàng!'
          : '📋 You have no orders yet.\nType a product name to order!',
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }

    // Store orders in session for detail lookup
    updateSession(zaloUserId, {
      state: 'SHOWING_ORDERS',
      recentOrders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        itemCount: o.items.length,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt,
      })),
    });

    const statusIcons: Record<string, string> = {
      PENDING: '⏳',
      CONFIRMED: '✅',
      PROCESSING: '⚙️',
      PACKED: '📦',
      OUT_FOR_DELIVERY: '🚚',
      DELIVERED: '✅',
      CANCELLED: '❌',
      REFUNDED: '🔄',
    };

    const paymentLabels: Record<string, string> = {
      DIGITAL: vi ? 'Trả ngay' : 'Pay Now',
      CREDIT: vi ? 'Nợ 7 ngày' : '7-Day Credit',
      COD: 'COD',
    };

    const orderList = orders
      .map((o, i) => {
        const icon = statusIcons[o.status] || '📋';
        const statusLabel = vi ? getStatusLabelVi(o.status) : o.status;
        const payLabel = paymentLabels[o.paymentMethod] || o.paymentMethod;
        return (
          `${i + 1}. ${o.orderNumber} | ${icon} ${statusLabel}\n` +
          `   ${o.items.length} ${vi ? 'SP' : 'items'} | ${formatVND(o.totalAmount)} | ${payLabel}`
        );
      })
      .join('\n\n');

    return createResponse(
      (vi ? '📋 Đơn hàng gần đây:\n\n' : '📋 Recent Orders:\n\n') +
      orderList + '\n\n' +
      (vi ? 'Nhấn số để xem chi tiết:' : 'Press a number to view details:'),
      orders.map((_, i) => `${i + 1}`),
      'SHOWING_ORDERS'
    );
  } catch (error) {
    console.error('[ZALO ORDERS LOOKUP ERROR]', error);
    return createResponse(
      vi ? '❌ Có lỗi khi tải đơn hàng. Thử lại sau.' : '❌ Error loading orders. Try again later.',
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: ORDER LOOKUP (SHOWING_ORDERS)
// ============================================

async function handleOrderLookupState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'hủy' || text === 'cancel') {
    resetSession(zaloUserId);
    return createResponse(
      vi ? '🔙 Đã quay lại.' : '🔙 Back to main menu.',
      ['menu', 'help'],
      'IDLE'
    );
  }

  // Check if user selected a number
  if (session.recentOrders && /^\d+$/.test(text)) {
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < session.recentOrders.length) {
      const orderRef = session.recentOrders[idx];
      return showOrderDetail(orderRef.id, session);
    }
  }

  // Re-show order list
  if (session.recentOrders && session.recentOrders.length > 0) {
    const statusIcons: Record<string, string> = {
      PENDING: '⏳', CONFIRMED: '✅', PROCESSING: '⚙️',
      PACKED: '📦', OUT_FOR_DELIVERY: '🚚', DELIVERED: '✅',
      CANCELLED: '❌', REFUNDED: '🔄',
    };
    const paymentLabels: Record<string, string> = {
      DIGITAL: vi ? 'Trả ngay' : 'Pay Now',
      CREDIT: vi ? 'Nợ 7 ngày' : '7-Day Credit',
      COD: 'COD',
    };

    const orderList = session.recentOrders
      .map((o, i) => {
        const icon = statusIcons[o.status] || '📋';
        const statusLabel = vi ? getStatusLabelVi(o.status) : o.status;
        const payLabel = paymentLabels[o.paymentMethod] || o.paymentMethod;
        return (
          `${i + 1}. ${o.orderNumber} | ${icon} ${statusLabel}\n` +
          `   ${o.itemCount} ${vi ? 'SP' : 'items'} | ${formatVND(o.totalAmount)} | ${payLabel}`
        );
      })
      .join('\n\n');

    return createResponse(
      (vi ? '📋 Đơn hàng gần đây:\n\n' : '📋 Recent Orders:\n\n') +
      orderList + '\n\n' +
      (vi ? 'Nhấn số để xem chi tiết, hoặc "quay lại":' : 'Press a number to view details, or "back":'),
      [...session.recentOrders.map((_, i) => `${i + 1}`), vi ? 'quay lại' : 'back'],
      'SHOWING_ORDERS'
    );
  }

  // No orders context, reset
  resetSession(zaloUserId);
  return handleIdleState(session, text, zaloUserId);
}

// ============================================
// HELPER: Show Order Detail
// ============================================

async function showOrderDetail(orderId: string, session: ConversationSession): Promise<BotResponse> {
  const vi = session.language === 'vi';

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      transactions: {
        where: { type: { in: [TRANSACTION_TYPES.CREDIT_USED, TRANSACTION_TYPES.REPAYMENT, TRANSACTION_TYPES.REFUND] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!order) {
    return createResponse(
      vi ? '❌ Không tìm thấy đơn hàng.' : '❌ Order not found.',
      [vi ? 'quay lại' : 'back'],
      'SHOWING_ORDERS'
    );
  }

  const statusIcons: Record<string, string> = {
    PENDING: '⏳', CONFIRMED: '✅', PROCESSING: '⚙️',
    PACKED: '📦', OUT_FOR_DELIVERY: '🚚', DELIVERED: '✅',
    CANCELLED: '❌', REFUNDED: '🔄',
  };
  const statusLabel = vi ? getStatusLabelVi(order.status) : order.status;
  const icon = statusIcons[order.status] || '📋';

  const paymentLabels: Record<string, string> = {
    DIGITAL: vi ? 'Trả ngay (MoMo/ZaloPay)' : 'Pay Now (MoMo/ZaloPay)',
    CREDIT: vi ? 'Nợ 7 ngày' : '7-Day Credit',
    COD: 'COD',
  };

  const itemsList = order.items
    .map((item, i) => `  ${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
    .join('\n');

  let detail =
    `📌 ${order.orderNumber} | ${icon} ${statusLabel}\n\n` +
    (vi ? '📦 Sản phẩm:\n' : '📦 Items:\n') +
    itemsList + '\n\n' +
    (vi ? '💰 Chi tiết:\n' : '💰 Details:\n') +
    `  ${vi ? 'Tạm tính' : 'Subtotal'}: ${formatVND(order.subtotalAmount)}\n`;

  if (order.discountAmount > 0) {
    detail += `  ${vi ? 'Giảm giá' : 'Discount'}: -${formatVND(order.discountAmount)}\n`;
  }
  if (order.deliveryFee > 0) {
    detail += `  ${vi ? 'Phí giao' : 'Delivery'}: ${formatVND(order.deliveryFee)}\n`;
  }

  detail += `  ${vi ? 'Tổng cộng' : 'Total'}: ${formatVND(order.totalAmount)}\n`;
  detail += `  ${vi ? 'Thanh toán' : 'Payment'}: ${paymentLabels[order.paymentMethod] || order.paymentMethod}\n`;

  if (order.creditUsed > 0) {
    const repaid = order.transactions
      .filter((t) => t.type === TRANSACTION_TYPES.REPAYMENT)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const remaining = order.creditUsed - repaid;
    detail += `  ${vi ? 'Nợ' : 'Credit'}: ${formatVND(order.creditUsed)}`;
    if (remaining > 0) {
      detail += ` (${vi ? 'còn nợ' : 'remaining'}: ${formatVND(remaining)})`;
    }
    detail += '\n';
  }

  detail += '\n' +
    (vi ? `📅 Ngày đặt: ${formatDate(order.createdAt)}` : `📅 Ordered: ${formatDate(order.createdAt)}`);

  return createResponse(
    detail,
    [vi ? 'quay lại' : 'back', 'menu'],
    'SHOWING_ORDERS'
  );
}

// ============================================
// COMMAND: Credit Info (tín dụng / credit)
// ============================================

async function handleCreditCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);
    const creditInfo = await getShopCreditInfo(shop.id);

    updateSession(zaloUserId, { state: 'AWAITING_CREDIT_INFO' });

    const statusIcons: Record<string, string> = {
      ACTIVE: '🟢',
      LOCKED: '🔴',
      OVERDUE: '🔴',
    };

    const statusLabelsVi: Record<string, string> = {
      ACTIVE: 'HOẠT ĐỘNG',
      LOCKED: 'BỊ KHÓA',
      OVERDUE: 'QUÁ HẠN',
    };

    const statusLabel = vi
      ? (statusLabelsVi[creditInfo.credit.status] || creditInfo.credit.status)
      : creditInfo.credit.status;

    let detail =
      '💳 ' + (vi ? 'Tài khoản tín dụng:\n' : 'Credit Account:\n') + '\n' +
      `  ${vi ? 'Hạn mức' : 'Limit'}: ${formatVND(creditInfo.credit.limit)}\n` +
      `  ${vi ? 'Đã sử dụng' : 'Used'}: ${formatVND(creditInfo.credit.used)}\n` +
      `  ${vi ? 'Còn lại' : 'Available'}: ${formatVND(creditInfo.credit.available)}\n` +
      `  ${vi ? 'Trạng thái' : 'Status'}: ${statusIcons[creditInfo.credit.status] || '⚪'} ${statusLabel}`;

    // Days until due
    const daysUntilDue = creditInfo.credit.daysUntilDue;
    if (daysUntilDue !== null && creditInfo.credit.used > 0) {
      if (creditInfo.credit.status === 'OVERDUE') {
        detail += '\n  🔴 ' + (vi ? 'Đã quá hạn!' : 'Overdue!');
      } else if (daysUntilDue <= 2) {
        detail += '\n  ⚠️ ' + (vi ? `Hạn trả: ${daysUntilDue === 0 ? (vi ? 'Hôm nay!' : 'Today!') : daysUntilDue + (vi ? ' ngày nữa' : ' days')}`
          : `Due: ${daysUntilDue === 0 ? 'Today!' : daysUntilDue + ' days'}`);
      } else {
        detail += '\n  ' + (vi ? `📅 Hạn trả: ${daysUntilDue} ngày nữa`
          : `📅 Due in: ${daysUntilDue} days`);
      }
    }

    // Overdue warning
    if (creditInfo.credit.status === 'OVERDUE') {
      detail += '\n\n' + (vi
        ? '❗ Tín dụng đã quá hạn. Vui lòng trả nợ ngay để tránh bị khóa vĩnh viễn.\n💡 Gõ "trả nợ" để thanh toán.'
        : '❗ Credit is overdue. Please repay immediately to avoid permanent lock.\n💡 Type "repay" to make a payment.');
    } else if (creditInfo.credit.status === 'LOCKED') {
      detail += '\n\n' + (vi
        ? '❗ Tài khoản tín dụng đã bị khóa. Trả nợ để mở khóa tự động.\n💡 Gõ "trả nợ" để thanh toán.'
        : '❗ Credit account is locked. Repay to auto-unlock.\n💡 Type "repay" to make a payment.');
    } else if (creditInfo.credit.used === 0) {
      detail += '\n\n' + (vi
        ? '✨ Bạn chưa sử dụng tín dụng. Đặt hàng bằng "Nợ 7 ngày" để tận dụng!'
        : '✨ You haven\'t used credit yet. Place an order with "7-Day Credit" to get started!');
    } else {
      detail += '\n\n' + (vi
        ? '💡 Gõ "trả nợ" để thanh toán'
        : '💡 Type "repay" to make a payment');
    }

    return createResponse(
      detail,
      [vi ? 'trả nợ' : 'repay', vi ? 'đơn hàng' : 'orders', 'menu'],
      'AWAITING_CREDIT_INFO'
    );
  } catch (error) {
    console.error('[ZALO CREDIT INFO ERROR]', error);
    return createResponse(
      vi ? '❌ Có lỗi khi tải thông tin tín dụng.' : '❌ Error loading credit info.',
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: AWAITING_CREDIT_INFO
// ============================================

async function handleCreditInfoState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Repay command
  if (text === 'repay' || text === 'trả nợ') {
    return handleRepayCommand(session, zaloUserId);
  }

  // Orders command
  if (text === 'orders' || text === 'đơn hàng') {
    return handleOrdersCommand(session, zaloUserId);
  }

  // Back to idle
  resetSession(zaloUserId);
  return handleIdleState(session, text, zaloUserId);
}

// ============================================
// COMMAND: Repay (trả nợ / repay)
// ============================================

async function handleRepayCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);

    // Check credit balance
    if (shop.creditBalance <= 0) {
      return createResponse(
        vi
          ? '✅ Bạn không có khoản nợ nào.\nTài khoản tín dụng sạch!\n\nGõ tên sản phẩm để đặt hàng.'
          : '✅ You have no outstanding debt.\nCredit account is clear!\n\nType a product name to order.',
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }

    // Find credit orders (orders with creditUsed > 0)
    const creditTransactions = await db.transaction.findMany({
      where: {
        shopId: shop.id,
        type: TRANSACTION_TYPES.CREDIT_USED,
        amount: { gt: 0 },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            creditUsed: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Get repayment transactions per order
    const repayments = await db.transaction.findMany({
      where: {
        shopId: shop.id,
        type: TRANSACTION_TYPES.REPAYMENT,
        orderId: { not: null },
      },
      select: { orderId: true, amount: true },
    });

    const repayByOrder = new Map<string, number>();
    for (const r of repayments) {
      if (r.orderId) {
        repayByOrder.set(r.orderId, (repayByOrder.get(r.orderId) || 0) + Math.abs(r.amount));
      }
    }

    // Build list of orders with remaining credit
    const creditOrders: Array<{
      id: string;
      orderNumber: string;
      totalAmount: number;
      creditUsed: number;
      remaining: number;
      dueDate: string;
    }> = [];

    for (const ct of creditTransactions) {
      if (!ct.order) continue;
      const repaid = repayByOrder.get(ct.order.id) || 0;
      const remaining = Math.max(0, ct.amount - repaid);
      if (remaining <= 0) continue;

      const dueDate = new Date(
        ct.createdAt.getTime() + CREDIT_CONFIG.CREDIT_DAYS * 24 * 60 * 60 * 1000
      );

      creditOrders.push({
        id: ct.order.id,
        orderNumber: ct.order.orderNumber,
        totalAmount: ct.order.totalAmount,
        creditUsed: remaining,
        remaining,
        dueDate: formatDate(dueDate),
      });
    }

    if (creditOrders.length === 0) {
      return createResponse(
        vi
          ? '✅ Bạn không có khoản nợ nào.\nTài khoản tín dụng sạch!'
          : '✅ You have no outstanding debt.\nCredit account is clear!',
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }

    updateSession(zaloUserId, {
      state: 'AWAITING_REPAY_ORDER',
      creditOrders: creditOrders.map((co) => ({
        id: co.id,
        orderNumber: co.orderNumber,
        totalAmount: co.totalAmount,
        creditUsed: co.creditUsed,
        dueDate: co.dueDate,
      })),
    });

    const totalDebt = creditOrders.reduce((sum, co) => sum + co.remaining, 0);

    const orderList = creditOrders
      .map((co, i) => (
        `${i + 1}. ${co.orderNumber} | ${formatVND(co.creditUsed)}\n` +
        `   ${vi ? 'Hẹn trả' : 'Due'}: ${co.dueDate}`
      ))
      .join('\n\n');

    return createResponse(
      (vi ? '💰 Khoản nợ cần trả:\n\n' : '💰 Outstanding Debt:\n\n') +
      orderList + '\n\n' +
      (vi ? `Tổng nợ: ${formatVND(totalDebt)}\n\n` : `Total: ${formatVND(totalDebt)}\n\n`) +
      (vi ? 'Nhấn số đơn để trả:' : 'Press order number to repay:'),
      creditOrders.map((_, i) => `${i + 1}`),
      'AWAITING_REPAY_ORDER'
    );
  } catch (error) {
    console.error('[ZALO REPAY LOOKUP ERROR]', error);
    return createResponse(
      vi ? '❌ Có lỗi khi tải thông tin nợ.' : '❌ Error loading debt info.',
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: AWAITING_REPAY_ORDER
// ============================================

async function handleRepayOrderState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'hủy' || text === 'cancel') {
    resetSession(zaloUserId);
    return createResponse(
      vi ? '🔙 Đã quay lại.' : '🔙 Back to main menu.',
      ['menu', 'help'],
      'IDLE'
    );
  }

  // Check if user selected a number
  if (session.creditOrders && /^\d+$/.test(text)) {
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < session.creditOrders.length) {
      const selectedOrder = session.creditOrders[idx];
      updateSession(zaloUserId, {
        state: 'AWAITING_REPAY_AMOUNT',
        selectedRepayOrderId: selectedOrder.id,
      });

      return createResponse(
        (vi ? '💳 Trả nợ đơn ' : '💳 Repay order ') + selectedOrder.orderNumber + '\n\n' +
        (vi ? 'Số tiền nợ: ' : 'Debt amount: ') + formatVND(selectedOrder.creditUsed) + '\n\n' +
        (vi ? 'Nhập số tiền muốn trả (hoặc "tất cả" để trả hết):' : 'Enter amount to repay (or "all" to pay in full):'),
        ['tất cả', (vi ? 'quay lại' : 'back')],
        'AWAITING_REPAY_AMOUNT'
      );
    }
  }

  // Re-show list
  if (session.creditOrders && session.creditOrders.length > 0) {
    const orderList = session.creditOrders
      .map((co, i) => (
        `${i + 1}. ${co.orderNumber} | ${formatVND(co.creditUsed)}\n` +
        `   ${vi ? 'Hẹn trả' : 'Due'}: ${co.dueDate}`
      ))
      .join('\n\n');

    const totalDebt = session.creditOrders.reduce((sum, co) => sum + co.creditUsed, 0);

    return createResponse(
      (vi ? '💰 Khoản nợ cần trả:\n\n' : '💰 Outstanding Debt:\n\n') +
      orderList + '\n\n' +
      (vi ? `Tổng nợ: ${formatVND(totalDebt)}\n\n` : `Total: ${formatVND(totalDebt)}\n\n`) +
      (vi ? 'Nhấn số đơn để trả, hoặc "quay lại":' : 'Press order number to repay, or "back":'),
      [...session.creditOrders.map((_, i) => `${i + 1}`), vi ? 'quay lại' : 'back'],
      'AWAITING_REPAY_ORDER'
    );
  }

  resetSession(zaloUserId);
  return handleIdleState(session, text, zaloUserId);
}

// ============================================
// STATE: AWAITING_REPAY_AMOUNT
// ============================================

async function handleRepayAmountState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'hủy' || text === 'cancel') {
    // Go back to repay order list
    updateSession(zaloUserId, { state: 'AWAITING_REPAY_ORDER' });
    if (session.creditOrders && session.creditOrders.length > 0) {
      const orderList = session.creditOrders
        .map((co, i) => (
          `${i + 1}. ${co.orderNumber} | ${formatVND(co.creditUsed)}\n` +
          `   ${vi ? 'Hẹn trả' : 'Due'}: ${co.dueDate}`
        ))
        .join('\n\n');

      return createResponse(
        (vi ? '💰 Khoản nợ cần trả:\n\n' : '💰 Outstanding Debt:\n\n') +
        orderList + '\n\n' +
        (vi ? 'Nhấn số đơn để trả:' : 'Press order number to repay:'),
        session.creditOrders.map((_, i) => `${i + 1}`),
        'AWAITING_REPAY_ORDER'
      );
    }
    resetSession(zaloUserId);
    return createResponse(
      vi ? '🔙 Đã quay lại.' : '🔙 Back to main menu.',
      ['menu'],
      'IDLE'
    );
  }

  if (!session.selectedRepayOrderId) {
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Parse amount
  let repayAmount = 0;
  const selectedOrder = session.creditOrders?.find((co) => co.id === session.selectedRepayOrderId);

  if (text === 'tất cả' || text === 'all' || text === 'toàn bộ') {
    repayAmount = selectedOrder?.creditUsed || 0;
  } else {
    // Try to parse number (remove dots and spaces for Vietnamese format)
    const cleanText = text.replace(/[.\s,d]/g, '').trim();
    const parsed = parseInt(cleanText);
    if (isNaN(parsed) || parsed <= 0) {
      return createResponse(
        vi
          ? '❌ Vui lòng nhập số tiền hợp lệ.\nVí dụ: 100000 hoặc "tất cả"'
          : '❌ Please enter a valid amount.\nExample: 100000 or "all"',
        ['tất cả', 'all', (vi ? 'quay lại' : 'back')],
        'AWAITING_REPAY_AMOUNT'
      );
    }
    repayAmount = parsed;
  }

  if (!selectedOrder || repayAmount <= 0) {
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Process repayment
  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);
    const result = await db.$transaction(async (tx) => {
      const currentShop = await tx.shop.findUnique({ where: { id: shop.id } });
      if (!currentShop || currentShop.creditBalance <= 0) {
        throw new Error('No outstanding balance');
      }

      // Clamp repayment to actual balance
      const actualRepay = Math.min(repayAmount, currentShop.creditBalance);
      const newBalance = currentShop.creditBalance - actualRepay;
      const isFullRepayment = newBalance === 0;

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          shopId: shop.id,
          orderId: session.selectedRepayOrderId,
          type: TRANSACTION_TYPES.REPAYMENT,
          amount: -actualRepay, // negative = repayment
          runningBalance: newBalance,
          paymentMethod: 'CASH',
          description: isFullRepayment
            ? `Zalo repayment — full (${formatVND(actualRepay)})`
            : `Zalo repayment — partial (${formatVND(actualRepay)})`,
        },
      });

      // Update shop
      const updateData: Record<string, unknown> = { creditBalance: newBalance };

      // If fully repaid and was locked/overdue, reactivate
      if (isFullRepayment && (currentShop.creditStatus === 'LOCKED' || currentShop.creditStatus === 'OVERDUE')) {
        updateData.creditStatus = 'ACTIVE';
      }

      await tx.shop.update({
        where: { id: shop.id },
        data: updateData,
      });

      return { transaction, newBalance, actualRepay, isFullRepayment };
    });

    resetSession(zaloUserId);

    let successMsg =
      (vi ? '✅ Đã ghi nhận thanh toán!\n\n' : '✅ Payment recorded!\n\n') +
      (vi ? 'Đã trả: ' : 'Paid: ') + formatVND(result.actualRepay) + '\n' +
      (vi ? 'Số dư nợ còn: ' : 'Remaining debt: ') + formatVND(result.newBalance);

    if (result.isFullRepayment) {
      successMsg += '\n\n' + (vi
        ? '🎉 Đã trả hết nợ! Tài khoản tín dụng đã được kích hoạt lại.'
        : '🎉 Debt fully cleared! Credit account has been reactivated.');
    }

    return createResponse(
      successMsg,
      [vi ? 'đơn hàng' : 'orders', 'menu'],
      'IDLE'
    );
  } catch (error) {
    console.error('[ZALO REPAY ERROR]', error);
    resetSession(zaloUserId);
    return createResponse(
      vi
        ? '❌ Có lỗi khi ghi nhận thanh toán. Vui lòng thử lại.'
        : '❌ Error recording payment. Please try again.',
      ['help', 'menu'],
      'IDLE'
    );
  }
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
// HELPER FUNCTIONS
// ============================================

function createResponse(replyText: string, quickReplies: string[] = [], state: string): BotResponse {
  return { replyText, quickReplies, state };
}

function getStatusLabelVi(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'CHỜ XÁC NHẬN',
    CONFIRMED: 'ĐÃ XÁC NHẬN',
    PROCESSING: 'ĐANG XỬ LÝ',
    PACKED: 'ĐÃ ĐÓNG GÓI',
    OUT_FOR_DELIVERY: 'ĐANG GIAO',
    DELIVERED: 'ĐÃ GIAO',
    CANCELLED: 'ĐÃ HỦY',
    REFUNDED: 'ĐÃ HOÀN TIỀN',
  };
  return labels[status] || status;
}

function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
