// ALADIN ZaloPay Payment Gateway
// Sprint 4F — ZaloPay create, verify callback, query status

import { ZALOPAY_CONFIG } from './config';
import type { CreatePaymentRequest, CreatePaymentResult, PaymentCallback, PaymentQuery } from './gateway';
import { createHmacSha256, fetchWithTimeout } from './gateway';
import { PAYMENT_CONFIG } from './config';

// ============================================
// ZALOPAY: CREATE PAYMENT
// ============================================

export async function createZaloPayPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
  try {
    const embedData = JSON.stringify({
      orderId: request.orderId,
      orderNumber: request.orderNumber,
      shopName: request.shopName,
      userId: request.userId,
    });

    const appTransId = generateAppTransId();

    const orderData = {
      app_id: ZALOPAY_CONFIG.APP_ID,
      app_trans_id: appTransId,
      app_user: request.userId,
      app_time: Date.now(),
      item: JSON.stringify([]),
      embed_data: embedData,
      amount: request.amount,
      description: request.description,
      bank_code: '',
      callback_url: ZALOPAY_CONFIG.CALLBACK_URL,
    };

    // Build HMAC signature: hmac(key1, app_id|app_trans_id|app_user|amount|apptime|embed_data|item)
    const dataStr = [
      orderData.app_id,
      orderData.app_trans_id,
      orderData.app_user,
      orderData.amount,
      orderData.app_time,
      orderData.embed_data,
      orderData.item,
    ].join('|');

    orderData.mac = createHmacSha256(ZALOPAY_CONFIG.KEY1, dataStr);

    const response = await fetchWithTimeout(
      ZALOPAY_CONFIG.CREATE_ORDER_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      },
      PAYMENT_CONFIG.API_TIMEOUT_MS
    );

    const result = await response.json() as Record<string, unknown>;

    if (result.return_code === 1) {
      return {
        success: true,
        paymentUrl: result.order_url as string,
        transactionId: appTransId,
        gatewayTxId: result.zp_trans_token as string | undefined,
      };
    }

    return {
      success: false,
      error: `ZaloPay error: ${result.return_code} - ${result.return_message}`,
    };
  } catch (error) {
    console.error('[ZALOPAY] Create payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ZaloPay payment creation failed',
    };
  }
}

// ============================================
// ZALOPAY: VERIFY CALLBACK
// ============================================

export function verifyZaloPayCallback(data: Record<string, string>): PaymentCallback {
  const {
    app_id,
    app_trans_id,
    zp_trans_id,
    amount,
    mac: receivedMac,
    embed_data,
    status,
  } = data;

  // Reconstruct the signature data
  const dataStr = `${app_id}|${app_trans_id}|${zp_trans_id || ''}|${amount || 0}|${embed_data || ''}`;

  // Calculate expected MAC using key2
  const expectedMac = createHmacSha256(ZALOPAY_CONFIG.KEY2, dataStr);

  if (receivedMac !== expectedMac) {
    console.error('[ZALOPAY] Callback MAC verification failed');
    return {
      orderId: '',
      transactionId: app_trans_id,
      amount: parseInt(amount || '0', 10),
      status: 'FAILED',
      gateway: 'ZALOPAY',
      rawData: data,
    };
  }

  // Parse embed_data to extract ALADIN order info
  let orderId = '';
  let orderNumber = '';
  try {
    const embed = JSON.parse(embed_data || '{}');
    orderId = embed.orderId || '';
    orderNumber = embed.orderNumber || '';
  } catch {
    // embed_data parse failure — still proceed with callback
  }

  // ZaloPay status codes: 1 = success, others = pending/failed
  const zaloStatus = parseInt(status || '0', 10);
  const paymentStatus: PaymentCallback['status'] = zaloStatus === 1 ? 'SUCCESS' : 'FAILED';

  return {
    orderId,
    transactionId: zp_trans_id || app_trans_id,
    amount: parseInt(amount || '0', 10),
    status: paymentStatus,
    gateway: 'ZALOPAY',
    rawData: data,
  };
}

// ============================================
// ZALOPAY: QUERY STATUS
// ============================================

export async function queryZaloPayStatus(appTransId: string): Promise<PaymentQuery | null> {
  try {
    const params = {
      app_id: ZALOPAY_CONFIG.APP_ID,
      app_trans_id: appTransId,
    };

    // MAC: hmac(key1, app_id|app_trans_id)
    const dataStr = `${params.app_id}|${params.app_trans_id}`;
    params.mac = createHmacSha256(ZALOPAY_CONFIG.KEY1, dataStr);

    const response = await fetchWithTimeout(
      ZALOPAY_CONFIG.QUERY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      },
      PAYMENT_CONFIG.API_TIMEOUT_MS
    );

    const result = await response.json() as Record<string, unknown>;

    if (result.return_code !== 1) {
      console.error('[ZALOPAY] Query error:', result.return_code, result.return_message);
      return null;
    }

    // Parse embed_data to extract ALADIN order ID
    let orderId = '';
    try {
      const embed = JSON.parse((result.embed_data as string) || '{}');
      orderId = embed.orderId || '';
    } catch {
      // ignore
    }

    // ZaloPay status: 1 = paid, 2 = processing, 3 = cancelled
    const zaloStatus = result.status as string;
    let status: PaymentQuery['status'] = 'PENDING';
    if (zaloStatus === '1') status = 'SUCCESS';
    else if (zaloStatus === '3') status = 'FAILED';
    else if (zaloStatus === '-49') status = 'EXPIRED';

    return {
      orderId,
      transactionId: (result.zp_trans_id as string) || appTransId,
      amount: parseInt((result.amount as string) || '0', 10),
      status,
      gateway: 'ZALOPAY',
    };
  } catch (error) {
    console.error('[ZALOPAY] Query status error:', error);
    return null;
  }
}

// ============================================
// ZALOPAY: GENERATE APP_TRANS_ID
// Format: YYMMDD_HHmmss + 6 random digits
// ============================================

function generateAppTransId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const MM = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const HH = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
  return `${yy}${MM}${dd}_${HH}${mm}${ss}${rand}`;
}
