// ALADIN Zalo Bot — Conversation Engine (State Machine)
// Handles the full ordering flow via Zalo text messages
// States: IDLE → PRODUCT_SEARCH → ORDER_QTY → REVIEW → PAYMENT → CONFIRMED
// Enhanced with Orders, Credit, and Repayment commands

import type { ConversationSession, ZaloProductResult, ZaloOrderItem, PaymentOption } from './config';
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
import { createTranslator } from './i18n';

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
    const tEn = createTranslator('en');
    return createResponse(
      tEn('zaloBot.langSwitchedEn'),
      ['menu', 'popular', 'help'],
      session.state
    );
  }
  if (text.includes('chuyển sang tiếng việt') || text === 'vi') {
    updateSession(zaloUserId, { language: 'vi' });
    const tVi = createTranslator('vi');
    return createResponse(
      tVi('zaloBot.langSwitched'),
      ['menu', 'phổ biến', 'giúp đỡ'],
      session.state
    );
  }

  // Registration gate: check if user is registered when in IDLE state
  if (session.state === 'IDLE') {
    const isLanguageCmd = text.toLowerCase().includes('switch to english') || text === 'en'
      || text.includes('chuyển sang tiếng việt') || text === 'vi';
    const isHelpCmd = text === 'help' || text === 'giúp đỡ' || text === 'hỗ trợ';
    const isRegisterCmd = text === 'register' || text === 'đăng ký';

    if (!isLanguageCmd && !isHelpCmd && !isRegisterCmd) {
      // Check if user has a shop
      const regStatus = await isUserRegistered(zaloUserId);
      if (!regStatus.registered) {
        // Not registered — start registration flow
        return handleRegistrationStart(session, zaloUserId);
      }
      // If registered, populate session
      if (regStatus.shopId && !session.shopId) {
        updateSession(zaloUserId, { shopId: regStatus.shopId, userId: regStatus.userId });
      }
    }
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
    case 'AWAITING_ORDER_CONFIRM':
      return handleOrderConfirmState(session, text, zaloUserId);
    case 'AWAITING_PAYMENT_GATEWAY':
      return handlePaymentGatewayState(session, text, zaloUserId);
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
    case 'AWAITING_SEARCH_QUERY':
      return handleAwaitingSearchQuery(session, text, zaloUserId);
    case 'SHOWING_PRODUCT_DETAIL':
      return handleProductDetailState(session, text, zaloUserId);
    case 'REGISTRATION_START':
    case 'AWAITING_SHOP_NAME':
    case 'AWAITING_SHOP_ADDRESS':
    case 'AWAITING_SHOP_DISTRICT':
    case 'AWAITING_SHOP_TYPE':
      return handleRegistrationState(session, text, zaloUserId);
    default:
      resetSession(zaloUserId);
      return handleIdleState(session, text, zaloUserId);
  }
}

// ============================================
// STATE: IDLE — Entry point
// ============================================

async function handleIdleState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Help command
  if (text === 'help' || text === 'giúp đỡ' || text === 'hỗ trợ') {
    const helpBody = '\n\n' +
      '• ' + t('zaloBot.helpMenu') + '\n' +
      '• ' + t('zaloBot.helpCategories') + '\n' +
      '• ' + t('zaloBot.helpPopular') + '\n' +
      '• ' + t('zaloBot.helpOrders') + '\n' +
      '• ' + t('zaloBot.helpCredit') + '\n' +
      '• ' + t('zaloBot.helpRepay') + '\n' +
      '• ' + t('zaloBot.helpCancel') + '\n' +
      '• ' + t('zaloBot.helpLanguage') + '\n' +
      '• ' + t('zaloBot.regHelpRegister') + '\n' +
      '• ' + t('zaloBot.searchCmd') + '\n' +
      '• ' + t('zaloBot.detailCmd') + '\n' +
      '• ' + t('zaloBot.suggestCmd') + '\n' +
      '• ' + t('zaloBot.paymentCommand') + '\n\n' +
      '💡 ' + t('zaloBot.helpTip');
    return createResponse(
      '🧞 ' + t('zaloBot.helpTitle') + helpBody,
      ['menu', vi ? 'phổ biến' : 'popular', vi ? 'đơn hàng' : 'orders'],
      session.state
    );
  }

  // Register command
  if (text === 'register' || text === 'đăng ký') {
    return handleRegistrationStart(session, zaloUserId);
  }

  // Profile command (show shop info)
  if (text === 'profile' || text === 'thông tin') {
    return handleProfileCommand(session, zaloUserId);
  }

  // Search command (explicit)
  if (text === 'search' || text === 'tìm kiếm') {
    updateSession(zaloUserId, { state: 'AWAITING_SEARCH_QUERY' });
    return createResponse(
      t('zaloBot.searchPrompt') + '\n\n' + t('zaloBot.searchHint'),
      ['menu', vi ? 'phổ biến' : 'popular', vi ? 'quay lại' : 'back'],
      'AWAITING_SEARCH_QUERY'
    );
  }

  // Menu command
  if (text === 'menu' || text === 'danh mục' || text === 'categories') {
    const categories = await getCategoryList();
    if (categories.length === 0) {
      return createResponse(t('zaloBot.noCategories'), [], session.state);
    }

    const catList = categories
      .map((c) => `${c.icon || '📦'} ${c.name} (${c.productCount} SP)`)
      .join('\n');

    updateSession(zaloUserId, { state: 'AWAITING_PRODUCT_SEARCH' });

    return createResponse(
      t('zaloBot.categoriesTitle') +
      catList + '\n\n' +
      t('zaloBot.categoriesHint'),
      categories.map((c) => c.name),
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  // Popular/trending command
  if (text === 'popular' || text === 'phổ biến' || text === 'bán chạy') {
    const products = await getPopularProducts(5);
    if (products.length === 0) {
      return createResponse(t('zaloBot.noProducts'), [], session.state);
    }

    const productLines = products.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
    updateSession(zaloUserId, { state: 'SHOWING_PRODUCTS', searchResults: products });

    return createResponse(
      t('zaloBot.popularTitle') +
      productLines + '\n\n' +
      t('zaloBot.popularHint'),
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

  // Suggest command (AI recommendations)
  if (text === 'suggest' || text === 'gợi ý') {
    return handleSuggestCommand(session, zaloUserId);
  }

  // Payment command (Sprint 4F)
  if (text === 'thanh toán' || text === 'payment' || text === 'trả tiền') {
    return handlePaymentCommand(session, zaloUserId);
  }

  // Cancel/clear cart
  if (text === 'cancel' || text === 'hủy' || text === 'xóa') {
    if (session.orderItems.length > 0) {
      resetSession(zaloUserId);
      return createResponse(
        t('zaloBot.cartClearedContinue'),
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }
    return createResponse(
      t('zaloBot.cartEmptyStart'),
      ['menu', vi ? 'phổ biến' : 'popular'],
      session.state
    );
  }

  // Recommendation add-to-cart: check if user selected a number from recommendations
  if (session.recommendationProducts && session.recommendationProducts.length > 0 && /^\d+$/.test(text)) {
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < session.recommendationProducts.length) {
      const product = session.recommendationProducts[idx];

      // Add to cart with quantity 1 (user can adjust later in review)
      const newItem: ZaloOrderItem = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.basePrice,
        quantity: 1,
        totalPrice: product.basePrice,
      };

      // Check if product already in cart — increment quantity
      const existingIdx = session.orderItems.findIndex((item) => item.productId === product.id);
      if (existingIdx >= 0) {
        session.orderItems[existingIdx].quantity += 1;
        session.orderItems[existingIdx].totalPrice = session.orderItems[existingIdx].quantity * session.orderItems[existingIdx].unitPrice;
      } else {
        session.orderItems.push(newItem);
      }

      const newTotal = session.orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      updateSession(zaloUserId, {
        orderItems: session.orderItems,
        orderTotal: newTotal,
        recommendationProducts: undefined, // Clear recommendations after selection
      });

      const cartSummary = session.orderItems
        .map((item, i) => `${i + 1}. ${item.productName} x${item.quantity} = ${formatVND(item.totalPrice)}`)
        .join('\n');

      return createResponse(
        t('zaloBot.suggestAddToCart', { name: product.name }) +
        t('zaloBot.suggestViewCart', { total: formatVND(newTotal) }) +
        '\n' + cartSummary,
        [vi ? 'đặt hàng' : 'order', vi ? 'thêm' : 'add', vi ? 'xóa' : 'clear'],
        'REVIEWING_ORDER'
      );
    }
  }

  // Check if this looks like a product search (default behavior)
  if (text.length >= 2) {
    return handleSearchState(session, text, zaloUserId);
  }

  // Default greeting
  return createResponse(
    t('zaloBot.greeting'),
    ['menu', 'help'],
    session.state
  );
}

// ============================================
// STATE: PRODUCT SEARCH
// ============================================

async function handleSearchState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Product detail request: "chi tiết N", "detail N", "xem N"
  const detailMatch = text.match(/^(?:chi tiết|detail|xem)\s+(\d+)$/i);
  if (detailMatch && session.searchResults) {
    const idx = parseInt(detailMatch[1]) - 1;
    if (idx >= 0 && idx < session.searchResults.length) {
      updateSession(zaloUserId, { state: 'SHOWING_PRODUCT_DETAIL', selectedProductIndex: idx });
      return showProductDetail(session.searchResults[idx], session);
    }
  }

  // Check if user selected a number from search results
  if (session.searchResults && /^\d+$/.test(text)) {
    const idx = parseInt(text) - 1;
    if (idx >= 0 && idx < session.searchResults.length) {
      const product = session.searchResults[idx];
      if (product.stockQuantity === 0) {
        return createResponse(
          t('zaloBot.outOfStockMsg', { name: product.name }),
          session.searchResults.map((_, i) => i === idx ? 'skip' : `${i + 1}`),
          'SHOWING_PRODUCTS'
        );
      }

      updateSession(zaloUserId, {
        state: 'AWAITING_ORDER_QTY',
        searchQuery: product.name,
        selectedProductIndex: idx,
      });

      return createResponse(
        t('zaloBot.productSelected', { name: product.name }) + '\n\n' +
        t('zaloBot.priceLabel', { price: formatVND(product.basePrice) }) + '/' + product.unit +
        (product.groupBuyPrice ? '\n' + t('zaloBot.groupBuyPriceLabel', { price: formatVND(product.groupBuyPrice) }) : '') +
        '\n' + t('zaloBot.availableLabel', { qty: product.stockQuantity, unit: product.unit }) + '\n\n' +
        t('zaloBot.enterQtyHint', { max: product.stockQuantity }),
        ['1', '2', '5', '10', (vi ? 'hủy' : 'cancel')],
        'AWAITING_ORDER_QTY'
      );
    }
  }

  // Category detection: check if text matches a category name
  if (session.state === 'AWAITING_PRODUCT_SEARCH' || session.state === 'SHOWING_PRODUCTS') {
    const categories = await getCategoryList();
    const matchedCat = categories.find(
      (c) => c.name.toLowerCase() === text.toLowerCase()
    );
    if (matchedCat) {
      const products = await getProductsByCategory(matchedCat.id, 5);
      if (products.length === 0) {
        return createResponse(
          t('zaloBot.catNoProducts'),
          categories.map((c) => c.name),
          'AWAITING_PRODUCT_SEARCH'
        );
      }
      const productLines = products.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
      updateSession(zaloUserId, {
        state: 'SHOWING_PRODUCTS',
        browsingCategoryId: matchedCat.id,
        searchQuery: matchedCat.name,
        searchResults: products,
      });
      return createResponse(
        t('zaloBot.catBrowseTitle', { name: matchedCat.name }) +
        productLines + '\n\n' +
        t('zaloBot.catBrowseHint'),
        [...products.map((_, i) => `${i + 1}`), vi ? 'menu' : 'back'],
        'SHOWING_PRODUCTS'
      );
    }
  }

  // Perform product search
  const results = await searchProducts(text, 5);

  if (results.length === 0) {
    return createResponse(
      t('zaloBot.searchEmptyMsg', { query: text }),
      ['menu', vi ? 'phổ biến' : 'popular'],
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  const productLines = results.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');

  updateSession(zaloUserId, {
    state: 'SHOWING_PRODUCTS',
    searchQuery: text,
    searchResults: results,
    browsingCategoryId: undefined,
  });

  return createResponse(
    t('zaloBot.searchResultsTitle', { query: text }) +
    productLines + '\n\n' +
    t('zaloBot.searchSelectHint') +
    t('zaloBot.searchDetailHint'),
    [...results.map((_, i) => `${i + 1}`), vi ? 'menu' : 'back'],
    'SHOWING_PRODUCTS'
  );
}

// ============================================
// STATE: ORDER QUANTITY
// ============================================

async function handleOrderQtyState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Cancel
  if (text === 'cancel' || text === 'hủy' || text === 'back' || text === 'quay lại') {
    updateSession(zaloUserId, { state: 'AWAITING_PRODUCT_SEARCH' });
    return createResponse(
      t('zaloBot.backToSearch'),
      ['menu', vi ? 'phổ biến' : 'popular'],
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  // Parse quantity
  const qty = parseInt(text);
  if (isNaN(qty) || qty < 1) {
    session.errorCount++;
    return createResponse(
      t('zaloBot.qtyInvalidMsg'),
      ['1', '2', '5', '10', (vi ? 'hủy' : 'cancel')],
      'AWAITING_ORDER_QTY'
    );
  }

  // Get the selected product
  if (!session.searchResults || session.searchResults.length === 0) {
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Use the selected product from the correct index
  const selectedProduct = session.searchResults[session.selectedProductIndex ?? 0];
  const maxQty = selectedProduct.stockQuantity;

  if (qty > maxQty) {
    return createResponse(
      t('zaloBot.stockRemainingMsg', { qty: maxQty, unit: selectedProduct.unit }),
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
    t('zaloBot.cartTitle') +
    orderSummary + '\n\n' +
    t('zaloBot.cartTotal', { total: formatVND(session.orderTotal) }) + '\n\n' +
    t('zaloBot.cartOptionsHint'),
    [vi ? 'thêm' : 'add', vi ? 'đặt hàng' : 'order', vi ? 'xóa' : 'clear'],
    'REVIEWING_ORDER'
  );
}

// ============================================
// STATE: REVIEW ORDER
// ============================================

async function handleReviewState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Add more items
  if (text === 'add' || text === 'thêm' || text === 'them') {
    updateSession(zaloUserId, { state: 'AWAITING_PRODUCT_SEARCH' });
    return createResponse(
      t('zaloBot.cartAddSearchHint'),
      ['menu', vi ? 'phổ biến' : 'popular'],
      'AWAITING_PRODUCT_SEARCH'
    );
  }

  // Clear cart
  if (text === 'clear' || text === 'xóa' || text === 'hủy') {
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.cartCleared'),
      ['menu'],
      'IDLE'
    );
  }

  // Proceed to order / payment method selection
  if (text === 'order' || text === 'đặt hàng' || text === 'dat hang' || text === 'ok' || text === 'đồng ý') {
    if (session.orderItems.length === 0) {
      return createResponse(
        t('zaloBot.cartEmpty'),
        ['menu', vi ? 'phổ biến' : 'popular'],
        'IDLE'
      );
    }

    return handleShowPaymentOptions(session, zaloUserId);
  }

  // Unknown command
  return createResponse(
    t('zaloBot.cartUnknown'),
    [vi ? 'thêm' : 'add', vi ? 'đặt hàng' : 'order', vi ? 'xóa' : 'clear'],
    'REVIEWING_ORDER'
  );
}

// ============================================
// HELPER: Show Payment Options (with credit checks)
// ============================================

async function handleShowPaymentOptions(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
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
      creditAvailableInfo = t('zaloBot.creditAvailableInfo', { amount: formatVND(available) });

      if (shopWithCredit.creditStatus === 'LOCKED') {
        creditWarning = t('zaloBot.creditLockedWarning');
        creditDisabled = true;
      } else if (shopWithCredit.creditStatus === 'OVERDUE') {
        creditWarning = t('zaloBot.creditOverdueWarning');
        creditDisabled = true;
      } else if (available < session.orderTotal) {
        creditWarning = t('zaloBot.creditInsufficientWarning', { available: formatVND(available) });
        creditDisabled = true;
      }
    }
  } catch {
    // If shop lookup fails, just show standard options
  }

  let paymentText =
    t('zaloBot.paymentTitle') +
    `1. ${t('zaloBot.payNowLabel')}\n` +
    `   ${t('zaloBot.payNowDiscountHint', { percent: CREDIT_CONFIG.PAY_NOW_DISCOUNT * 100 })}${discountedTotal}\n\n`;

  if (creditDisabled) {
    paymentText += `2. ${t('zaloBot.creditDisabled')}\n`;
    if (creditWarning) paymentText += `   ${creditWarning}\n`;
    paymentText += '\n';
  } else {
    paymentText += `2. ${t('zaloBot.creditLabel')}\n`;
    paymentText += `   ${t('zaloBot.creditPayWithin')} → ${creditTotal}`;
    if (creditAvailableInfo) paymentText += ` (${creditAvailableInfo})`;
    paymentText += '\n\n';
  }

  paymentText +=
    `3. COD\n` +
    `   ${t('zaloBot.codFeeHint')} → ${codTotal}`;

  const quickReplies = ['1', '3', (vi ? 'quay lại' : 'back')];
  if (!creditDisabled) quickReplies.splice(1, 0, '2');

  return createResponse(paymentText, quickReplies, 'AWAITING_PAYMENT_METHOD');
}

// ============================================
// STATE: PAYMENT METHOD
// ============================================

async function handlePaymentState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back
  if (text === 'back' || text === 'quay lại') {
    updateSession(zaloUserId, { state: 'REVIEWING_ORDER' });
    const orderSummary = session.orderItems
      .map((item, i) => `${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
      .join('\n');
    return createResponse(
      t('zaloBot.cartBackTitle') +
      orderSummary + '\n\n' +
      t('zaloBot.cartBackHint'),
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
      t('zaloBot.paymentSelectHint'),
      ['1', '2', '3'],
      'AWAITING_PAYMENT_METHOD'
    );
  }

  const subtotalAmount = session.orderTotal;
  const discountAmount = session.orderTotal - finalTotal;
  const deliveryFee = paymentMethod === 'COD' ? 15000 : 0;
  const grandTotal = finalTotal + deliveryFee;

  // Credit validation before showing confirmation
  if (paymentMethod === 'CREDIT') {
    try {
      const shop = await findOrCreateShopByZaloUser(zaloUserId);
      if (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE') {
        const status = shop.creditStatus === 'OVERDUE' ? t('zaloBot.creditOverdueLabel') : t('zaloBot.creditLockedLabel');
        return createResponse(
          t('zaloBot.creditLockedError', { status }),
          ['1', '3', (vi ? 'quay lại' : 'back')],
          'AWAITING_PAYMENT_METHOD'
        );
      }
      const available = shop.creditLimit - shop.creditBalance;
      if (available < grandTotal) {
        return createResponse(
          t('zaloBot.creditInsufficientDetail', { available: formatVND(available), required: formatVND(grandTotal) }),
          ['1', '3', (vi ? 'trả nợ' : 'repay')],
          'AWAITING_PAYMENT_METHOD'
        );
      }
    } catch {
      // Continue to confirmation if credit check fails
    }
  }

  // Store pending payment info and show confirmation screen
  const paymentLabels: Record<string, string> = {
    DIGITAL: t('zaloBot.payNowLabel'),
    CREDIT: t('zaloBot.creditLabel'),
    COD: 'COD',
  };

  updateSession(zaloUserId, {
    state: 'AWAITING_ORDER_CONFIRM',
    pendingPayment: {
      method: paymentMethod,
      discountAmount,
      deliveryFee,
      grandTotal,
    },
  });

  // Build confirmation summary
  const itemsList = session.orderItems
    .map((item, i) => `  ${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
    .join('\n');

  let confirmText =
    t('zaloBot.confirmTitle') +
    t('zaloBot.confirmItems') + '\n' +
    itemsList + '\n\n' +
    t('zaloBot.confirmPayment') + paymentLabels[paymentMethod] + '\n' +
    `  ${t('zaloBot.confirmSubtotal')}: ${formatVND(subtotalAmount)}\n`;

  if (discountAmount > 0) {
    confirmText += `  ${t('zaloBot.confirmDiscount')}: -${formatVND(discountAmount)}\n`;
  }
  if (deliveryFee > 0) {
    confirmText += `  ${t('zaloBot.confirmDelivery')}: ${formatVND(deliveryFee)}\n`;
  }

  confirmText += `  ${t('zaloBot.confirmTotal')}: ${formatVND(grandTotal)}`;
  confirmText += t('zaloBot.confirmHint');

  return createResponse(
    confirmText,
    [vi ? 'đồng ý' : 'ok', vi ? 'quay lại' : 'back', vi ? 'hủy' : 'cancel'],
    'AWAITING_ORDER_CONFIRM'
  );
}

// ============================================
// STATE: ORDER CONFIRMATION (Sprint 4C)
// ============================================

async function handleOrderConfirmState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back to payment options
  if (text === 'back' || text === 'quay lại') {
    updateSession(zaloUserId, { state: 'AWAITING_PAYMENT_METHOD', pendingPayment: undefined });
    return handleShowPaymentOptions(session, zaloUserId);
  }

  // Cancel — back to cart review
  if (text === 'cancel' || text === 'hủy') {
    updateSession(zaloUserId, { state: 'REVIEWING_ORDER', pendingPayment: undefined });
    const orderSummary = session.orderItems
      .map((item, i) => `${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
      .join('\n');
    return createResponse(
      t('zaloBot.cartBackTitle') +
      orderSummary + '\n\n' +
      t('zaloBot.cartOptionsHint'),
      [vi ? 'đặt hàng' : 'order', vi ? 'thêm' : 'add', vi ? 'xóa' : 'clear'],
      'REVIEWING_ORDER'
    );
  }

  // Confirm order
  if (text === 'ok' || text === 'đồng ý' || text === 'yes' || text === 'xác nhận') {
    if (!session.pendingPayment) {
      // Missing payment context, go back to payment selection
      updateSession(zaloUserId, { state: 'AWAITING_PAYMENT_METHOD' });
      return handleShowPaymentOptions(session, zaloUserId);
    }
    return executeOrderCreation(session, zaloUserId);
  }

  // Unknown input — show hint
  return createResponse(
    t('zaloBot.confirmBackHint'),
    [vi ? 'đồng ý' : 'ok', vi ? 'quay lại' : 'back', vi ? 'hủy' : 'cancel'],
    'AWAITING_ORDER_CONFIRM'
  );
}

// ============================================
// HELPER: Execute order creation (extracted from handlePaymentState)
// ============================================

async function executeOrderCreation(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';
  const paymentMethod = session.pendingPayment!.method;
  const discountAmount = session.pendingPayment!.discountAmount;
  const deliveryFee = session.pendingPayment!.deliveryFee;
  const grandTotal = session.pendingPayment!.grandTotal;
  const orderItems = session.orderItems;
  const subtotalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);

  try {
    // Find or create shop
    let shop = await findOrCreateShopByZaloUser(zaloUserId);

    // Re-fetch shop with credit info
    const shopWithCredit = await db.shop.findUnique({
      where: { id: shop.id },
      include: { user: { select: { phone: true, name: true } } },
    });

    if (!shopWithCredit) {
      throw new Error('Shop not found after creation');
    }
    shop = shopWithCredit as typeof shop & { user: { phone: string; name: string } };

    // Credit re-validation (in case balance changed between confirmation and now)
    if (paymentMethod === 'CREDIT') {
      if (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE') {
        const status = shop.creditStatus === 'OVERDUE' ? t('zaloBot.creditOverdueLabel') : t('zaloBot.creditLockedLabel');
        updateSession(zaloUserId, { state: 'AWAITING_PAYMENT_METHOD', pendingPayment: undefined });
        return createResponse(
          t('zaloBot.creditLockedError', { status }),
          ['1', '3', (vi ? 'quay lại' : 'back')],
          'AWAITING_PAYMENT_METHOD'
        );
      }
      const available = shop.creditLimit - shop.creditBalance;
      if (available < grandTotal) {
        updateSession(zaloUserId, { state: 'AWAITING_PAYMENT_METHOD', pendingPayment: undefined });
        return createResponse(
          t('zaloBot.creditInsufficientDetail', { available: formatVND(available), required: formatVND(grandTotal) }),
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

    // Collect product IDs for recommendations
    const orderedProductIds = orderItems.map((item) => item.productId);

    // Atomic order creation
    await db.$transaction(async (tx) => {
      // Verify stock again within transaction
      for (const item of orderItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.stockQuantity < item.quantity) {
          throw new Error(
            t('zaloBot.stockErrorMsg', { name: item.productName })
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
          customerNotes: t('zaloBot.orderNote'),
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
    });

    // Generate AI recommendations based on ordered products
    const recommendations = await generateRecommendations(orderedProductIds, zaloUserId);

    const paymentLabels: Record<string, string> = {
      DIGITAL: t('zaloBot.payNowLabel'),
      CREDIT: t('zaloBot.creditLabel'),
      COD: 'COD',
    };

    // For DIGITAL payment: redirect to gateway selection
    if (paymentMethod === 'DIGITAL') {
      // Reset session, store order context, go to gateway selection
      resetSession(zaloUserId);
      updateSession(zaloUserId, {
        state: 'AWAITING_PAYMENT_GATEWAY',
        lastCreatedOrderId: (await db.order.findUnique({ where: { orderNumber } }))!.id,
        lastOrderedProductIds: orderedProductIds,
        recommendationProducts: recommendations,
      });

      const gatewayMsg =
        t('zaloBot.orderSuccess') +
        t('zaloBot.orderNumberLabel') + orderNumber + '\n' +
        `${orderItems.length} ${t('zaloBot.orderItemsLabel')} | ${formatVND(grandTotal)}\n` +
        t('zaloBot.orderPaymentLabel') + paymentLabels[paymentMethod] +
        (discountAmount > 0 ? t('zaloBot.orderSaved', { amount: formatVND(discountAmount) }) : '') +
        '\n\n' +
        t('zaloBot.paymentGatewayTitle') +
        t('zaloBot.paymentGatewayZaloPay') + '\n' +
        t('zaloBot.paymentGatewayMoMo') + '\n\n' +
        t('zaloBot.paymentGatewayHint');

      return createResponse(
        gatewayMsg,
        ['1', '2', (vi ? 'hủy' : 'cancel')],
        'AWAITING_PAYMENT_GATEWAY'
      );
    }

    // For CREDIT and COD: show success immediately
    // Reset session but preserve recommendation context
    resetSession(zaloUserId);
    updateSession(zaloUserId, {
      lastOrderedProductIds: orderedProductIds,
      recommendationProducts: recommendations,
    });

    // Build success message + recommendations
    let successMsg =
      t('zaloBot.orderSuccess') +
      t('zaloBot.orderNumberLabel') + orderNumber + '\n' +
      `${orderItems.length} ${t('zaloBot.orderItemsLabel')} | ${formatVND(grandTotal)}\n` +
      t('zaloBot.orderPaymentLabel') + paymentLabels[paymentMethod] +
      (discountAmount > 0 ? t('zaloBot.orderSaved', { amount: formatVND(discountAmount) }) : '') +
      (deliveryFee > 0 ? t('zaloBot.orderDeliveryFee', { fee: formatVND(deliveryFee) }) : '') + '\n\n' +
      t('zaloBot.orderProcessing');

    // Append recommendations if available
    if (recommendations.length > 0) {
      const recLines = recommendations.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
      successMsg += t('zaloBot.suggestAfterOrderTitle') + recLines + '\n\n' + t('zaloBot.suggestAfterOrderHint');
      return createResponse(
        successMsg,
        [...recommendations.map((_, i) => `${i + 1}`), 'menu'],
        'IDLE'
      );
    }

    return createResponse(
      successMsg,
      [vi ? 'đơn hàng' : 'orders', 'menu'],
      'IDLE'
    );
  } catch (error) {
    console.error('[ZALO ORDER CREATE ERROR]', error);
    const errorMsg = error instanceof Error ? error.message : '';
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.orderErrorMsg') + (errorMsg ? '\n' + errorMsg : '') + t('zaloBot.orderErrorHint'),
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: AWAITING PAYMENT GATEWAY (Sprint 4F)
// After DIGITAL order creation, choose ZaloPay/MoMo
// ============================================

async function handlePaymentGatewayState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Cancel
  if (text === 'cancel' || text === 'hủy') {
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.cartCleared'),
      ['menu'],
      'IDLE'
    );
  }

  // Parse gateway selection
  let gateway: 'ZALOPAY' | 'MOMO' | null = null;
  if (text === '1') gateway = 'ZALOPAY';
  else if (text === '2') gateway = 'MOMO';

  if (!gateway) {
    return createResponse(
      t('zaloBot.paymentGatewayTitle') +
      t('zaloBot.paymentGatewayZaloPay') + '\n' +
      t('zaloBot.paymentGatewayMoMo') + '\n\n' +
      t('zaloBot.paymentGatewayHint'),
      ['1', '2', (vi ? 'hủy' : 'cancel')],
      'AWAITING_PAYMENT_GATEWAY'
    );
  }

  // Store selected gateway and create payment
  updateSession(zaloUserId, { pendingPaymentGateway: gateway });

  if (!session.lastCreatedOrderId) {
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.orderErrorMsg'),
      ['help', 'menu'],
      'IDLE'
    );
  }

  try {
    // Dynamically import payment service (server-only)
    const { createPaymentForOrder } = await import('../payment/payment-service');
    const result = await createPaymentForOrder(session.lastCreatedOrderId, gateway);

    if (!result.success || !result.paymentUrl) {
      // Payment creation failed — reset and show error
      const orderId = session.lastCreatedOrderId;
      resetSession(zaloUserId);
      return createResponse(
        t('zaloBot.paymentCreatedError') + '\n' + (result.error || ''),
        ['menu', vi ? 'thanh toán' : 'payment'],
        'IDLE'
      );
    }

    // Payment created successfully
    const recProducts = session.recommendationProducts;
    resetSession(zaloUserId);
    if (recProducts && recProducts.length > 0) {
      updateSession(zaloUserId, { recommendationProducts: recProducts });
    }

    let paymentMsg =
      t('zaloBot.paymentCreatedTitle') +
      t('zaloBot.paymentCreatedUrl', { url: result.paymentUrl }) +
      t('zaloBot.paymentCreatedExpiry') +
      t('zaloBot.paymentCreatedReminder') +
      t('zaloBot.paymentRetryHint');

    const quickReplies = [vi ? 'thanh toán' : 'payment', 'menu'];
    if (recProducts && recProducts.length > 0) {
      const recLines = recProducts.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
      paymentMsg += t('zaloBot.suggestAfterOrderTitle') + recLines + '\n\n' + t('zaloBot.suggestAfterOrderHint');
      quickReplies.push(...recProducts.map((_, i) => `${i + 1}`));
    }

    return createResponse(paymentMsg, quickReplies, 'IDLE');
  } catch (error) {
    console.error('[PAYMENT GATEWAY ERROR]', error);
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.paymentCreatedError'),
      ['menu', vi ? 'thanh toán' : 'payment'],
      'IDLE'
    );
  }
}

// ============================================
// COMMAND: Payment Status (Sprint 4F)
// "thanh toán" / "payment" / "trả tiền"
// ============================================

async function handlePaymentCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);

    // Find orders with DIGITAL payment method that are PENDING
    const pendingOrders = await db.order.findMany({
      where: {
        shopId: shop.id,
        paymentMethod: 'DIGITAL',
        paymentStatus: 'PENDING',
        status: { not: 'CANCELLED' },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        payments: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (pendingOrders.length === 0) {
      return createResponse(
        t('zaloBot.paymentNoPending'),
        ['menu', vi ? 'đơn hàng' : 'orders'],
        'IDLE'
      );
    }

    let msg = t('zaloBot.paymentPendingTitle');

    for (const order of pendingOrders) {
      msg += t('zaloBot.paymentPendingMsg', {
        orderNumber: order.orderNumber,
        amount: formatVND(order.totalAmount),
      });

      // If has pending payment, show the URL
      if (order.payments.length > 0 && order.payments[0].paymentUrl) {
        const payment = order.payments[0];
        const isExpired = payment.expiresAt && new Date() > payment.expiresAt;
        if (isExpired) {
          msg += t('zaloBot.paymentExpiredMsg') + '\n';
        } else {
          msg += t('zaloBot.paymentCreatedUrlFallback', { url: payment.paymentUrl }) + '\n';
        }
      }
      msg += '\n';
    }

    msg += t('zaloBot.paymentRetryHint');

    return createResponse(
      msg,
      ['menu', vi ? 'đơn hàng' : 'orders'],
      'IDLE'
    );
  } catch (error) {
    console.error('[PAYMENT COMMAND ERROR]', error);
    return createResponse(
      t('zaloBot.ordersError'),
      ['menu'],
      session.state
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
// COMMAND: Suggest / AI Recommendations (gợi ý)
// ============================================

async function handleSuggestCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);

    // Fetch the shop's recent order items to determine personalization
    const recentItems = await db.orderItem.findMany({
      where: {
        order: { shopId: shop.id, status: { not: 'CANCELLED' } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { productId: true },
    });

    if (recentItems.length === 0) {
      // No order history — show popular products as generic recommendations
      const popular = await getPopularProducts(3);
      if (popular.length === 0) {
        return createResponse(
          t('zaloBot.suggestEmpty'),
          ['menu', vi ? 'phổ biến' : 'popular'],
          'IDLE'
        );
      }
      const lines = popular.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
      updateSession(zaloUserId, { recommendationProducts: popular });
      return createResponse(
        t('zaloBot.suggestNoHistory') + '\n\n' +
        t('zaloBot.suggestTitle') +
        lines + '\n\n' +
        t('zaloBot.suggestAfterOrderHint'),
        [...popular.map((_, i) => `${i + 1}`), 'menu'],
        'IDLE'
      );
    }

    // Build list of frequently ordered product IDs
    const productFreq = new Map<string, number>();
    for (const item of recentItems) {
      productFreq.set(item.productId, (productFreq.get(item.productId) || 0) + 1);
    }
    // Sort by frequency descending, take top 5
    const topProductIds = [...productFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    const recommendations = await generateRecommendations(topProductIds, zaloUserId);

    if (recommendations.length === 0) {
      // Could not find recommendations — fallback to popular
      const popular = await getPopularProducts(3);
      if (popular.length === 0) {
        return createResponse(
          t('zaloBot.suggestEmpty'),
          ['menu', vi ? 'phổ biến' : 'popular'],
          'IDLE'
        );
      }
      const lines = popular.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
      updateSession(zaloUserId, { recommendationProducts: popular });
      return createResponse(
        t('zaloBot.suggestTitle') +
        lines + '\n\n' +
        t('zaloBot.suggestAfterOrderHint'),
        [...popular.map((_, i) => `${i + 1}`), 'menu'],
        'IDLE'
      );
    }

    const lines = recommendations.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
    updateSession(zaloUserId, { recommendationProducts: recommendations });

    return createResponse(
      t('zaloBot.suggestTitle') +
      lines + '\n\n' +
      t('zaloBot.suggestAfterOrderHint'),
      [...recommendations.map((_, i) => `${i + 1}`), 'menu'],
      'IDLE'
    );
  } catch (error) {
    console.error('[ZALO SUGGEST ERROR]', error);
    return createResponse(
      t('zaloBot.suggestEmpty'),
      ['menu', vi ? 'phổ biến' : 'popular'],
      'IDLE'
    );
  }
}

// ============================================
// AI RECOMMENDATIONS ENGINE
// ============================================

/**
 * Generate product recommendations based on ordered product IDs.
 * Strategy:
 *   1. Find categories of ordered products
 *   2. Get top-selling products in those categories (excluding already-ordered)
 *   3. Also consider "complementary" categories (e.g., if bought noodles, suggest sauce)
 *   4. Return up to 3 products
 */
async function generateRecommendations(
  orderedProductIds: string[],
  zaloUserId: string,
  limit: number = 3
): Promise<ZaloProductResult[]> {
  if (!orderedProductIds || orderedProductIds.length === 0) return [];

  try {
    // Step 1: Get categories of ordered products
    const orderedProducts = await db.product.findMany({
      where: { id: { in: orderedProductIds } },
      select: { id: true, categoryId: true },
    });

    const categoryIds = [...new Set(orderedProducts.map((p) => p.categoryId))];
    if (categoryIds.length === 0) return [];

    // Step 2: Get the shop's existing order history to exclude already-purchased products
    const shop = await findOrCreateShopByZaloUser(zaloUserId);
    const pastItems = await db.orderItem.findMany({
      where: { order: { shopId: shop.id, status: { not: 'CANCELLED' } } },
      select: { productId: true },
      distinct: ['productId'],
    });
    const excludeIds = new Set(pastItems.map((item) => item.productId));

    // Step 3: Find top products from the same categories (sorted by order popularity)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const popularInCategories = await db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: { createdAt: { gte: thirtyDaysAgo }, status: { not: 'CANCELLED' } },
        product: { categoryId: { in: categoryIds }, isActive: true, deletedAt: null },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit + 5, // Fetch extra to have room for filtering
    });

    // Step 4: Fetch full product data and filter
    const candidateIds = popularInCategories
      .map((p) => p.productId)
      .filter((id) => !excludeIds.has(id));

    if (candidateIds.length === 0) return [];

    const products = await db.product.findMany({
      where: {
        id: { in: candidateIds },
        isActive: true,
        deletedAt: null,
        stockQuantity: { gt: 0 },
      },
      include: { category: { select: { name: true } } },
      take: limit,
    });

    const results: ZaloProductResult[] = products.map((p) => ({
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

    // Step 5: If same-category recommendations are insufficient, add from popular
    if (results.length < limit) {
      const popular = await getPopularProducts(limit);
      for (const p of popular) {
        if (results.length >= limit) break;
        if (excludeIds.has(p.id)) continue;
        if (results.some((r) => r.id === p.id)) continue;
        results.push(p);
      }
    }

    return results.slice(0, limit);
  } catch (error) {
    console.error('[ZALO RECOMMENDATIONS ENGINE ERROR]', error);
    return [];
  }
}

// ============================================
// COMMANDS: Orders (đơn hàng / orders)
// ============================================

async function handleOrdersCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
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
        t('zaloBot.ordersEmpty'),
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
      DIGITAL: t('zaloBot.payNowShort'),
      CREDIT: t('zaloBot.creditLabelShort'),
      COD: 'COD',
    };

    const orderList = orders
      .map((o, i) => {
        const icon = statusIcons[o.status] || '📋';
        const statusLabel = vi ? getStatusLabelVi(o.status) : t('zaloBot.' + statusToKey(o.status));
        const payLabel = paymentLabels[o.paymentMethod] || o.paymentMethod;
        return (
          `${i + 1}. ${o.orderNumber} | ${icon} ${statusLabel}\n` +
          `   ${o.items.length} ${t('zaloBot.ordersItemsUnit')} | ${formatVND(o.totalAmount)} | ${payLabel}`
        );
      })
      .join('\n\n');

    return createResponse(
      t('zaloBot.ordersTitle') +
      orderList + '\n\n' +
      t('zaloBot.ordersPressNumber'),
      orders.map((_, i) => `${i + 1}`),
      'SHOWING_ORDERS'
    );
  } catch (error) {
    console.error('[ZALO ORDERS LOOKUP ERROR]', error);
    return createResponse(
      t('zaloBot.ordersError'),
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: ORDER LOOKUP (SHOWING_ORDERS)
// ============================================

async function handleOrderLookupState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'hủy' || text === 'cancel') {
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.backToMenu'),
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
      DIGITAL: t('zaloBot.payNowShort'),
      CREDIT: t('zaloBot.creditLabelShort'),
      COD: 'COD',
    };

    const orderList = session.recentOrders
      .map((o, i) => {
        const icon = statusIcons[o.status] || '📋';
        const statusLabel = vi ? getStatusLabelVi(o.status) : t('zaloBot.' + statusToKey(o.status));
        const payLabel = paymentLabels[o.paymentMethod] || o.paymentMethod;
        return (
          `${i + 1}. ${o.orderNumber} | ${icon} ${statusLabel}\n` +
          `   ${o.itemCount} ${t('zaloBot.ordersItemsUnit')} | ${formatVND(o.totalAmount)} | ${payLabel}`
        );
      })
      .join('\n\n');

    return createResponse(
      t('zaloBot.ordersTitle') +
      orderList + '\n\n' +
      t('zaloBot.ordersBackHint'),
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
  const t = createTranslator(session.language);
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
      t('zaloBot.orderNotFound'),
      [vi ? 'quay lại' : 'back'],
      'SHOWING_ORDERS'
    );
  }

  const statusIcons: Record<string, string> = {
    PENDING: '⏳', CONFIRMED: '✅', PROCESSING: '⚙️',
    PACKED: '📦', OUT_FOR_DELIVERY: '🚚', DELIVERED: '✅',
    CANCELLED: '❌', REFUNDED: '🔄',
  };
  const statusLabel = vi ? getStatusLabelVi(order.status) : t('zaloBot.' + statusToKey(order.status));
  const icon = statusIcons[order.status] || '📋';

  const paymentLabels: Record<string, string> = {
    DIGITAL: t('zaloBot.payNowLabel'),
    CREDIT: t('zaloBot.creditLabel'),
    COD: 'COD',
  };

  const itemsList = order.items
    .map((item, i) => `  ${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
    .join('\n');

  let detail =
    `📌 ${order.orderNumber} | ${icon} ${statusLabel}\n\n` +
    t('zaloBot.orderDetailItems') +
    itemsList + '\n\n' +
    t('zaloBot.orderDetailPrices') +
    `  ${t('zaloBot.orderDetailSubtotal')}: ${formatVND(order.subtotalAmount)}\n`;

  if (order.discountAmount > 0) {
    detail += `  ${t('zaloBot.orderDetailDiscount')}: -${formatVND(order.discountAmount)}\n`;
  }
  if (order.deliveryFee > 0) {
    detail += `  ${t('zaloBot.orderDetailDelivery')}: ${formatVND(order.deliveryFee)}\n`;
  }

  detail += `  ${t('zaloBot.orderDetailTotal')}: ${formatVND(order.totalAmount)}\n`;
  detail += `  ${t('zaloBot.orderDetailPayment')}: ${paymentLabels[order.paymentMethod] || order.paymentMethod}\n`;

  if (order.creditUsed > 0) {
    const repaid = order.transactions
      .filter((tr) => tr.type === TRANSACTION_TYPES.REPAYMENT)
      .reduce((sum, tr) => sum + Math.abs(tr.amount), 0);
    const remaining = order.creditUsed - repaid;
    detail += `  ${t('zaloBot.orderDetailCredit')}: ${formatVND(order.creditUsed)}`;
    if (remaining > 0) {
      detail += ` (${t('zaloBot.orderDetailCreditRemaining')}: ${formatVND(remaining)})`;
    }
    detail += '\n';
  }

  detail += '\n' +
    t('zaloBot.orderDetailDate', { date: formatDate(order.createdAt) });

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
  const t = createTranslator(session.language);
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

    const statusLabelKey = 'creditStatus' + creditInfo.credit.status.charAt(0) + creditInfo.credit.status.slice(1).toLowerCase();

    let detail =
      t('zaloBot.creditTitle') + '\n' +
      `  ${t('zaloBot.creditLimit')}: ${formatVND(creditInfo.credit.limit)}\n` +
      `  ${t('zaloBot.creditUsed')}: ${formatVND(creditInfo.credit.used)}\n` +
      `  ${t('zaloBot.creditAvailable')}: ${formatVND(creditInfo.credit.available)}\n` +
      `  ${t('zaloBot.creditStatus')}: ${statusIcons[creditInfo.credit.status] || '⚪'} ${statusLabel}`;

    // Days until due
    const daysUntilDue = creditInfo.credit.daysUntilDue;
    if (daysUntilDue !== null && creditInfo.credit.used > 0) {
      if (creditInfo.credit.status === 'OVERDUE') {
        detail += '\n  ' + t('zaloBot.creditOverdueBadge');
      } else if (daysUntilDue <= 2) {
        const label = daysUntilDue === 0 ? t('zaloBot.creditDueToday') : daysUntilDue + ' ' + t('zaloBot.creditDaysLeft');
        detail += '\n  ' + t('zaloBot.creditDueSoon', { label });
      } else {
        detail += '\n  ' + t('zaloBot.creditDueDays', { days: daysUntilDue });
      }
    }

    // Overdue warning
    if (creditInfo.credit.status === 'OVERDUE') {
      detail += '\n\n' + t('zaloBot.creditOverdueAlert');
    } else if (creditInfo.credit.status === 'LOCKED') {
      detail += '\n\n' + t('zaloBot.creditLockedAlert');
    } else if (creditInfo.credit.used === 0) {
      detail += '\n\n' + t('zaloBot.creditNoUsage');
    } else {
      detail += '\n\n' + t('zaloBot.creditRepayHint');
    }

    return createResponse(
      detail,
      [vi ? 'trả nợ' : 'repay', vi ? 'đơn hàng' : 'orders', 'menu'],
      'AWAITING_CREDIT_INFO'
    );
  } catch (error) {
    console.error('[ZALO CREDIT INFO ERROR]', error);
    return createResponse(
      t('zaloBot.creditError'),
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
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  try {
    const shop = await findOrCreateShopByZaloUser(zaloUserId);

    // Check credit balance
    if (shop.creditBalance <= 0) {
      return createResponse(
        t('zaloBot.repayNoDebt'),
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
        t('zaloBot.repayNoDebtShort'),
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
        `   ${t('zaloBot.repayDueDate')}: ${co.dueDate}`
      ))
      .join('\n\n');

    return createResponse(
      t('zaloBot.repayTitle') +
      orderList + '\n\n' +
      t('zaloBot.repayTotal', { total: formatVND(totalDebt) }) + '\n\n' +
      t('zaloBot.repaySelectOrder'),
      creditOrders.map((_, i) => `${i + 1}`),
      'AWAITING_REPAY_ORDER'
    );
  } catch (error) {
    console.error('[ZALO REPAY LOOKUP ERROR]', error);
    return createResponse(
      t('zaloBot.repayListError'),
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// STATE: AWAITING_REPAY_ORDER
// ============================================

async function handleRepayOrderState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'hủy' || text === 'cancel') {
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.backToMenu'),
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
        t('zaloBot.repayForOrder', { order: selectedOrder.orderNumber }) + '\n\n' +
        t('zaloBot.repayDebtAmount', { amount: formatVND(selectedOrder.creditUsed) }) + '\n\n' +
        t('zaloBot.repayEnterAmount'),
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
        `   ${t('zaloBot.repayDueDate')}: ${co.dueDate}`
      ))
      .join('\n\n');

    const totalDebt = session.creditOrders.reduce((sum, co) => sum + co.creditUsed, 0);

    return createResponse(
      t('zaloBot.repayTitle') +
      orderList + '\n\n' +
      t('zaloBot.repayTotal', { total: formatVND(totalDebt) }) + '\n\n' +
      t('zaloBot.repayBackHint'),
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
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'hủy' || text === 'cancel') {
    // Go back to repay order list
    updateSession(zaloUserId, { state: 'AWAITING_REPAY_ORDER' });
    if (session.creditOrders && session.creditOrders.length > 0) {
      const orderList = session.creditOrders
        .map((co, i) => (
          `${i + 1}. ${co.orderNumber} | ${formatVND(co.creditUsed)}\n` +
          `   ${t('zaloBot.repayDueDate')}: ${co.dueDate}`
        ))
        .join('\n\n');

      return createResponse(
        t('zaloBot.repayTitle') +
        orderList + '\n\n' +
        t('zaloBot.repaySelectOrder'),
        session.creditOrders.map((_, i) => `${i + 1}`),
        'AWAITING_REPAY_ORDER'
      );
    }
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.backToMenu'),
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
        t('zaloBot.repayAmountInvalid'),
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
      t('zaloBot.repaySuccess') +
      t('zaloBot.repayPaid', { amount: formatVND(result.actualRepay) }) + '\n' +
      t('zaloBot.repayRemaining', { amount: formatVND(result.newBalance) });

    if (result.isFullRepayment) {
      successMsg += t('zaloBot.repayFullClear');
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
      t('zaloBot.repayError'),
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// REGISTRATION: Check if user is registered
// ============================================

async function isUserRegistered(zaloUserId: string): Promise<{ registered: boolean; shopId?: string; userId?: string }> {
  const user = await db.user.findUnique({
    where: { zaloId: zaloUserId },
    select: { id: true, shop: { select: { id: true } } },
  });
  if (user && user.shop) {
    return { registered: true, shopId: user.shop.id, userId: user.id };
  }
  return { registered: false };
}

// ============================================
// REGISTRATION: Find only (no auto-create)
// ============================================

async function findShopByZaloUser(zaloUserId: string) {
  const user = await db.user.findUnique({
    where: { zaloId: zaloUserId },
    include: { shop: true },
  });
  return user?.shop || null;
}

// ============================================
// REGISTRATION: Start
// ============================================

async function handleRegistrationStart(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  updateSession(zaloUserId, {
    state: 'REGISTRATION_START',
    registrationData: { shopName: '', address: '', district: '', shopType: '' },
  });

  return createResponse(
    t('zaloBot.regWelcome') + t('zaloBot.regStart'),
    [vi ? 'đồng ý' : 'ok', vi ? 'hủy' : 'cancel'],
    'REGISTRATION_START'
  );
}

// ============================================
// REGISTRATION: State Handler
// ============================================

async function handleRegistrationState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Cancel at any step
  if (text === 'cancel' || text === 'hủy') {
    updateSession(zaloUserId, { state: 'IDLE', registrationData: undefined });
    return createResponse(t('zaloBot.regCancel'), ['help'], 'IDLE');
  }

  switch (session.state) {
    case 'REGISTRATION_START': {
      // Confirm start
      if (text === 'ok' || text === 'đồng ý') {
        updateSession(zaloUserId, { state: 'AWAITING_SHOP_NAME' });
        return createResponse(
          t('zaloBot.regAskName'),
          [vi ? 'hủy' : 'cancel'],
          'AWAITING_SHOP_NAME'
        );
      }
      // If they type something else, treat as confirmation
      updateSession(zaloUserId, { state: 'AWAITING_SHOP_NAME' });
      return createResponse(
        t('zaloBot.regAskName'),
        [vi ? 'hủy' : 'cancel'],
        'AWAITING_SHOP_NAME'
      );
    }

    case 'AWAITING_SHOP_NAME': {
      const name = sanitizeInput(text);
      if (name.length < 2) {
        return createResponse(
          t('zaloBot.regAskNameInvalid'),
          [vi ? 'hủy' : 'cancel'],
          'AWAITING_SHOP_NAME'
        );
      }
      updateSession(zaloUserId, {
        state: 'AWAITING_SHOP_ADDRESS',
        registrationData: { ...session.registrationData!, shopName: name },
      });
      return createResponse(
        t('zaloBot.regAskAddress'),
        [vi ? 'hủy' : 'cancel'],
        'AWAITING_SHOP_ADDRESS'
      );
    }

    case 'AWAITING_SHOP_ADDRESS': {
      const address = sanitizeInput(text);
      if (address.length < 5) {
        return createResponse(
          t('zaloBot.regAskAddressInvalid'),
          [vi ? 'hủy' : 'cancel'],
          'AWAITING_SHOP_ADDRESS'
        );
      }
      updateSession(zaloUserId, {
        state: 'AWAITING_SHOP_DISTRICT',
        registrationData: { ...session.registrationData!, address },
      });
      return createResponse(
        t('zaloBot.regAskDistrict'),
        [vi ? 'hủy' : 'cancel'],
        'AWAITING_SHOP_DISTRICT'
      );
    }

    case 'AWAITING_SHOP_DISTRICT': {
      const district = sanitizeInput(text);
      if (district.length < 2) {
        return createResponse(
          t('zaloBot.regAskDistrictInvalid'),
          [vi ? 'hủy' : 'cancel'],
          'AWAITING_SHOP_DISTRICT'
        );
      }
      updateSession(zaloUserId, {
        state: 'AWAITING_SHOP_TYPE',
        registrationData: { ...session.registrationData!, district },
      });
      return createResponse(
        t('zaloBot.regAskType'),
        ['1', '2', '3', vi ? 'hủy' : 'cancel'],
        'AWAITING_SHOP_TYPE'
      );
    }

    case 'AWAITING_SHOP_TYPE': {
      let shopType = '';
      let shopTypeLabel = '';
      const typeMap: Record<string, { type: string; viLabel: string; enLabel: string }> = {
        '1': { type: 'TAPHOA', viLabel: 'Tạp hóa', enLabel: 'Grocery store (Tạp hóa)' },
        '2': { type: 'CONVENIENCE', viLabel: 'Cửa hàng tiện lợi', enLabel: 'Convenience store' },
        '3': { type: 'FACTORY', viLabel: 'Cửa hàng công nghiệp', enLabel: 'Factory store' },
      };

      // Also accept Vietnamese text
      if (text.includes('tạp hóa') || text.includes('tap hoa')) {
        shopType = 'TAPHOA';
        shopTypeLabel = vi ? 'Tạp hóa' : 'Grocery store (Tạp hóa)';
      } else if (text.includes('tiện lợi') || text.includes('tien loi')) {
        shopType = 'CONVENIENCE';
        shopTypeLabel = vi ? 'Cửa hàng tiện lợi' : 'Convenience store';
      } else if (text.includes('công nghiệp') || text.includes('cong nghiep')) {
        shopType = 'FACTORY';
        shopTypeLabel = vi ? 'Cửa hàng công nghiệp' : 'Factory store';
      } else {
        const mapped = typeMap[text];
        if (!mapped) {
          return createResponse(
            t('zaloBot.regAskTypeInvalid'),
            ['1', '2', '3', vi ? 'hủy' : 'cancel'],
            'AWAITING_SHOP_TYPE'
          );
        }
        shopType = mapped.type;
        shopTypeLabel = vi ? mapped.viLabel : mapped.enLabel;
      }

      // Complete registration
      return handleRegistrationComplete(session, zaloUserId, shopType, shopTypeLabel);
    }

    default:
      resetSession(zaloUserId);
      return handleRegistrationStart(session, zaloUserId);
  }
}

// ============================================
// REGISTRATION: Complete (create User + Shop)
// ============================================

async function handleRegistrationComplete(
  session: ConversationSession,
  zaloUserId: string,
  shopType: string,
  shopTypeLabel: string
): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';
  const regData = session.registrationData!;

  try {
    // Check if user already exists (e.g. from a previous failed registration)
    let user = await db.user.findUnique({ where: { zaloId: zaloUserId } });

    if (!user) {
      user = await db.user.create({
        data: {
          zaloId: zaloUserId,
          phone: `zalo_${zaloUserId.slice(-6)}`,
          name: regData.shopName,
          role: 'SHOP_OWNER',
          status: 'ACTIVE',
        },
      });
    } else {
      // Update existing user's name to match shop name
      await db.user.update({
        where: { id: user.id },
        data: { name: regData.shopName },
      });
    }

    // Check if shop already exists for this user
    const existingShop = await db.shop.findUnique({ where: { userId: user.id } });

    let shop;
    if (existingShop) {
      // Update existing shop with new registration data
      shop = await db.shop.update({
        where: { id: existingShop.id },
        data: {
          name: regData.shopName,
          address: regData.address,
          district: regData.district,
          shopType,
        },
      });
    } else {
      // Create new shop
      shop = await db.shop.create({
        data: {
          userId: user.id,
          name: regData.shopName,
          address: regData.address,
          district: regData.district,
          province: 'Binh Duong',
          shopType,
          creditLimit: CREDIT_CONFIG.DEFAULT_LIMIT,
          creditBalance: 0,
          creditStatus: 'ACTIVE',
          loyaltyTier: 'BRONZE',
        },
      });
    }

    // Update session with shop info
    updateSession(zaloUserId, {
      state: 'IDLE',
      userId: user.id,
      shopId: shop.id,
      registrationData: undefined,
    });

    const creditLimitFormatted = formatVND(CREDIT_CONFIG.DEFAULT_LIMIT);

    return createResponse(
      t('zaloBot.regSuccess', {
        shopName: regData.shopName,
        address: regData.address,
        district: regData.district,
        shopType: shopTypeLabel,
        creditLimit: creditLimitFormatted,
      }) + t('zaloBot.regWelcomeMenu'),
      ['menu', vi ? 'phổ biến' : 'popular', 'help'],
      'IDLE'
    );
  } catch (error) {
    console.error('[ZALO REGISTRATION ERROR]', error);
    resetSession(zaloUserId);
    return createResponse(
      t('zaloBot.repayError'), // Generic error — reuse existing key
      ['help', 'menu'],
      'IDLE'
    );
  }
}

// ============================================
// COMMAND: Profile (thông tin / profile)
// ============================================

async function handleProfileCommand(session: ConversationSession, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  try {
    const shop = await findShopByZaloUser(zaloUserId);
    if (!shop) {
      return handleRegistrationStart(session, zaloUserId);
    }

    const shopTypeLabels: Record<string, string> = {
      TAPHOA: vi ? 'Tạp hóa' : 'Grocery store',
      CONVENIENCE: vi ? 'Cửa hàng tiện lợi' : 'Convenience store',
      FACTORY: vi ? 'Cửa hàng công nghiệp' : 'Factory store',
    };

    const typeLabel = shopTypeLabels[shop.shopType] || shop.shopType;

    return createResponse(
      t('zaloBot.regProfileTitle') +
      t('zaloBot.regProfileLine', {
        shopName: shop.name,
        address: shop.address || '-',
        district: shop.district || '-',
        shopType: typeLabel,
        creditLimit: formatVND(shop.creditLimit),
      }),
      ['menu', 'help', vi ? 'đơn hàng' : 'orders'],
      session.state
    );
  } catch (error) {
    console.error('[ZALO PROFILE ERROR]', error);
    return createResponse(
      t('zaloBot.ordersError'),
      ['help', 'menu'],
      session.state
    );
  }
}

// ============================================
// STATE: AWAITING_SEARCH_QUERY (explicit search)
// ============================================

async function handleAwaitingSearchQuery(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back / cancel
  if (text === 'back' || text === 'quay lại' || text === 'cancel' || text === 'hủy') {
    updateSession(zaloUserId, { state: 'IDLE' });
    return createResponse(
      t('zaloBot.backToMenu'),
      ['menu', 'help'],
      'IDLE'
    );
  }

  // Menu → go to categories
  if (text === 'menu' || text === 'danh mục' || text === 'categories') {
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Popular
  if (text === 'popular' || text === 'phổ biến') {
    return handleIdleState(session, text, zaloUserId);
  }

  // Require at least 2 chars
  if (text.length < 2) {
    return createResponse(
      t('zaloBot.qtyInvalidMsg'), // Reuse as generic "too short" message
      [vi ? 'quay lại' : 'back'],
      'AWAITING_SEARCH_QUERY'
    );
  }

  // Delegate to search
  return handleSearchState(session, text, zaloUserId);
}

// ============================================
// STATE: SHOWING_PRODUCT_DETAIL
// ============================================

async function handleProductDetailState(session: ConversationSession, text: string, zaloUserId: string): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Back to product list
  if (text === 'back' || text === 'quay lại') {
    if (session.searchResults && session.searchResults.length > 0) {
      const query = session.searchQuery || '';
      const productLines = session.searchResults.map((p, i) => formatProductLine(p, i + 1)).join('\n\n');
      updateSession(zaloUserId, { state: 'SHOWING_PRODUCTS', selectedProductIndex: undefined });
      return createResponse(
        t('zaloBot.searchResultsTitle', { query }) + productLines + '\n\n' +
        t('zaloBot.searchSelectHint') + t('zaloBot.searchDetailHint'),
        [...session.searchResults.map((_, i) => `${i + 1}`), vi ? 'menu' : 'back'],
        'SHOWING_PRODUCTS'
      );
    }
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Menu → back to categories
  if (text === 'menu' || text === 'danh mục') {
    resetSession(zaloUserId);
    return handleIdleState(session, text, zaloUserId);
  }

  // Number → select this product for ordering (quantity shortcut)
  if (/^\d+$/.test(text)) {
    const qty = parseInt(text);
    if (session.searchResults && session.selectedProductIndex !== undefined) {
      const product = session.searchResults[session.selectedProductIndex];
      if (product.stockQuantity === 0) {
        return createResponse(
          t('zaloBot.outOfStockMsg', { name: product.name }),
          [vi ? 'quay lại' : 'back'],
          'SHOWING_PRODUCT_DETAIL'
        );
      }

      // Validate quantity
      const minQty = 1;
      const maxQty = product.stockQuantity;
      if (qty < minQty || qty > maxQty) {
        return createResponse(
          t('zaloBot.stockRemainingMsg', { qty: maxQty, unit: product.unit }),
          [String(maxQty), vi ? 'quay lại' : 'back'],
          'SHOWING_PRODUCT_DETAIL'
        );
      }

      // Add to cart
      const unitPrice = product.groupBuyPrice || product.basePrice;
      const existingIdx = session.orderItems.findIndex((item) => item.productId === product.id);
      if (existingIdx >= 0) {
        session.orderItems[existingIdx].quantity += qty;
        session.orderItems[existingIdx].totalPrice = session.orderItems[existingIdx].quantity * unitPrice;
      } else {
        session.orderItems.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitPrice,
          quantity: qty,
          totalPrice: qty * unitPrice,
        });
      }

      session.orderTotal = session.orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const orderSummary = session.orderItems
        .map((item, i) => `${i + 1}. ${item.productName} × ${item.quantity} = ${formatVND(item.totalPrice)}`)
        .join('\n');

      updateSession(zaloUserId, { state: 'REVIEWING_ORDER', selectedProductIndex: undefined });
      return createResponse(
        t('zaloBot.cartTitle') + orderSummary + '\n\n' +
        t('zaloBot.cartTotal', { total: formatVND(session.orderTotal) }) + '\n\n' +
        t('zaloBot.cartOptionsHint'),
        [vi ? 'thêm' : 'add', vi ? 'đặt hàng' : 'order', vi ? 'xóa' : 'clear'],
        'REVIEWING_ORDER'
      );
    }
  }

  // Default: show hint with back option
  return createResponse(
    t('zaloBot.productDetailBackHint'),
    [vi ? 'quay lại' : 'back', 'menu'],
    'SHOWING_PRODUCT_DETAIL'
  );
}

// ============================================
// HELPER: Show Product Detail
// ============================================

async function showProductDetail(product: ZaloProductResult, session: ConversationSession): Promise<BotResponse> {
  const t = createTranslator(session.language);
  const vi = session.language === 'vi';

  // Fetch full product from DB for min/max order and brand
  const fullProduct = await db.product.findUnique({
    where: { id: product.id },
    include: { category: { select: { name: true } } },
  });

  if (!fullProduct) {
    // Fallback to basic info from ZaloProductResult
    let detail = t('zaloBot.productDetailTitle') +
      `  ${t('zaloBot.productDetailName')}: ${product.name}\n` +
      `  ${t('zaloBot.productDetailSku')}: ${product.sku}\n` +
      `  ${t('zaloBot.productDetailPrice')}: ${formatVND(product.basePrice)}/${product.unit}\n` +
      (product.groupBuyPrice ? `  ${t('zaloBot.productDetailGroupBuy')}: ${formatVND(product.groupBuyPrice)}/${product.unit}\n` : '') +
      `  ${t('zaloBot.productDetailStock')}: ${product.stockQuantity} ${product.unit}\n`;

    if (product.isPrivateLabel) detail += '  [ALADIN]\n';

    return createResponse(
      detail + t('zaloBot.productDetailSelectHint'),
      ['1', '2', '5', '10', vi ? 'quay lại' : 'back'],
      'SHOWING_PRODUCT_DETAIL'
    );
  }

  const stockIcon = fullProduct.stockQuantity > 50 ? '✅' : fullProduct.stockQuantity > 0 ? '⚠️' : '❌';
  const stockLabel = fullProduct.stockQuantity > 50 ? '' : fullProduct.stockQuantity > 0 ? t('zaloBot.productDetailStockLow') : t('zaloBot.productDetailStockOut');
  const plTag = fullProduct.isPrivateLabel ? ' [ALADIN]' : '';

  let detail = t('zaloBot.productDetailTitle') +
    `  ${fullProduct.name}${plTag}\n` +
    (fullProduct.nameEn ? `  (${fullProduct.nameEn})\n` : '') +
    `\n` +
    `  ${t('zaloBot.productDetailSku')}: ${fullProduct.sku}\n`;

  if (fullProduct.brand) {
    detail += `  ${t('zaloBot.productDetailBrand')}: ${fullProduct.brand}\n`;
  }
  if (fullProduct.category) {
    detail += `  ${t('zaloBot.productDetailCategory')}: ${fullProduct.category.name}\n`;
  }

  detail += `\n` +
    `  ${t('zaloBot.productDetailPrice')}: ${formatVND(fullProduct.basePrice)}/${fullProduct.unit}\n`;

  if (fullProduct.groupBuyPrice) {
    detail += `  ${t('zaloBot.productDetailGroupBuy')}: ${formatVND(fullProduct.groupBuyPrice)}/${fullProduct.unit}\n`;
  }

  detail += `  ${t('zaloBot.productDetailStock')}: ${stockIcon} ${fullProduct.stockQuantity} ${fullProduct.unit}${stockLabel}\n` +
    `  ${t('zaloBot.productDetailMinOrder')}: ${fullProduct.minOrderQty} ${fullProduct.unit}\n` +
    `  ${t('zaloBot.productDetailMaxOrder')}: ${fullProduct.maxOrderQty ? fullProduct.maxOrderQty + ' ' + fullProduct.unit : t('zaloBot.productDetailNoMax')}\n`;

  if (fullProduct.stockQuantity > 0) {
    detail += t('zaloBot.productDetailSelectHint');
  }

  const quickReplies = ['1', '2', '5', '10', vi ? 'quay lại' : 'back'];

  return createResponse(detail, quickReplies, 'SHOWING_PRODUCT_DETAIL');
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

function statusToKey(status: string): string {
  return 'status' + status.charAt(0) + status.slice(1).toLowerCase();
}

function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
