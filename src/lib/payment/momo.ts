// ALADIN MoMo Payment Gateway
// Sprint 4F — MoMo create, verify callback, query status

import { MOMO_CONFIG } from './config';
import type { CreatePaymentRequest, CreatePaymentResult, PaymentCallback, PaymentQuery } from './gateway';
import { createHmacSha256, fetchWithTimeout } from './gateway';
import { PAYMENT_CONFIG } from './config';

// ============================================
// MOMO: CREATE PAYMENT
// ============================================

export async function createMoMoPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
  try {
    const orderId = `${request.orderId}_${Date.now()}`;
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const rawData = {
      partnerCode: MOMO_CONFIG.PARTNER_CODE,
      accessKey: MOMO_CONFIG.ACCESS_KEY,
      requestId,
      amount: String(request.amount),
      orderId,
      orderInfo: request.description,
      redirectUrl: `${MOMO_CONFIG.CALLBACK_URL}?orderId=${request.orderId}`,
      ipnUrl: MOMO_CONFIG.IPN_URL,
      extraData: Buffer.from(JSON.stringify({
        aladinOrderId: request.orderId,
        orderNumber: request.orderNumber,
        shopName: request.shopName,
        userId: request.userId,
      })).toString('base64'),
      requestType: 'captureWallet',
      signature: '', // filled below
      lang: 'vi',
    };

    // Build HMAC signature: HMAC(accessKey + secretKey, accessKey=$accessKey&amount=$amount&extraData=$extraData&ipnUrl=$ipnUrl&orderId=$orderId&orderInfo=$orderInfo&partnerCode=$partnerCode&redirectUrl=$redirectUrl&requestId=$requestId&requestType=$requestType)
    const rawSignature = [
      `accessKey=${MOMO_CONFIG.ACCESS_KEY}`,
      `amount=${rawData.amount}`,
      `extraData=${rawData.extraData}`,
      `ipnUrl=${rawData.ipnUrl}`,
      `orderId=${rawData.orderId}`,
      `orderInfo=${encodeURIComponent(rawData.orderInfo)}`,
      `partnerCode=${MOMO_CONFIG.PARTNER_CODE}`,
      `redirectUrl=${encodeURIComponent(rawData.redirectUrl)}`,
      `requestId=${rawData.requestId}`,
      `requestType=${rawData.requestType}`,
    ].join('&');

    rawData.signature = createHmacSha256(MOMO_CONFIG.SECRET_KEY, rawSignature);

    const response = await fetchWithTimeout(
      MOMO_CONFIG.CREATE_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData),
      },
      PAYMENT_CONFIG.API_TIMEOUT_MS
    );

    const result = await response.json() as Record<string, unknown>;

    if (result.resultCode === 0) {
      return {
        success: true,
        paymentUrl: result.payUrl as string,
        qrCodeUrl: result.qrCodeUrl as string | undefined,
        transactionId: result.transId as string,
        gatewayTxId: result.transId as string,
      };
    }

    return {
      success: false,
      error: `MoMo error: ${result.resultCode} - ${result.message}`,
    };
  } catch (error) {
    console.error('[MOMO] Create payment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'MoMo payment creation failed',
    };
  }
}

// ============================================
// MOMO: VERIFY CALLBACK
// ============================================

export function verifyMoMoCallback(data: Record<string, string>): PaymentCallback {
  const {
    partnerCode,
    orderId,
    requestId,
    amount,
    transId,
    resultCode,
    message,
    extraData,
    signature: receivedSignature,
  } = data;

  // Reconstruct signature string
  const rawSignature = [
    `accessKey=${MOMO_CONFIG.ACCESS_KEY}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${encodeURIComponent(message)}`,
    `orderId=${orderId}`,
    `orderInfo=`,
    `orderType=`,
    `partnerCode=${partnerCode}`,
    `payType=`,
    `requestId=${requestId}`,
    `responseTime=`,
    `resultCode=${resultCode}`,
    `transId=${transId || ''}`,
  ].join('&');

  const expectedSignature = createHmacSha256(MOMO_CONFIG.SECRET_KEY, rawSignature);

  if (receivedSignature !== expectedSignature) {
    console.error('[MOMO] Callback signature verification failed');
    return {
      orderId: '',
      transactionId: transId || '',
      amount: parseInt(amount || '0', 10),
      status: 'FAILED',
      gateway: 'MOMO',
      rawData: data,
    };
  }

  // Parse extraData to extract ALADIN order info
  let aladinOrderId = '';
  try {
    const decoded = JSON.parse(Buffer.from(extraData || '', 'base64').toString('utf8'));
    aladinOrderId = decoded.aladinOrderId || '';
  } catch {
    // ignore parse failure
  }

  // MoMo resultCode: 0 = success, others = failed
  const paymentStatus: PaymentCallback['status'] = resultCode === '0' ? 'SUCCESS' : 'FAILED';

  return {
    orderId: aladinOrderId,
    transactionId: transId || '',
    amount: parseInt(amount || '0', 10),
    status: paymentStatus,
    gateway: 'MOMO',
    rawData: data,
  };
}

// ============================================
// MOMO: QUERY STATUS
// ============================================

export async function queryMoMoStatus(orderId: string): Promise<PaymentQuery | null> {
  try {
    const requestId = `req_${Date.now()}_query`;
    const rawData = {
      partnerCode: MOMO_CONFIG.PARTNER_CODE,
      requestId,
      orderId,
      signature: '',
      lang: 'vi',
    };

    // Signature: HMAC(secretKey, accessKey=$accessKey&orderId=$orderId&partnerCode=$partnerCode&requestId=$requestId)
    const rawSignature = [
      `accessKey=${MOMO_CONFIG.ACCESS_KEY}`,
      `orderId=${rawData.orderId}`,
      `partnerCode=${MOMO_CONFIG.PARTNER_CODE}`,
      `requestId=${rawData.requestId}`,
    ].join('&');

    rawData.signature = createHmacSha256(MOMO_CONFIG.SECRET_KEY, rawSignature);

    const response = await fetchWithTimeout(
      MOMO_CONFIG.QUERY_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData),
      },
      PAYMENT_CONFIG.API_TIMEOUT_MS
    );

    const result = await response.json() as Record<string, unknown>;

    if (result.resultCode !== 0) {
      console.error('[MOMO] Query error:', result.resultCode, result.message);
      return null;
    }

    let aladinOrderId = '';
    try {
      const decoded = JSON.parse(Buffer.from((result.extraData as string) || '', 'base64').toString('utf8'));
      aladinOrderId = decoded.aladinOrderId || '';
    } catch {
      // ignore
    }

    // MoMo resultCode for query: 0 = success
    const resultCode = result.resultCode as number;
    let status: PaymentQuery['status'] = 'PENDING';
    if (resultCode === 0) status = 'SUCCESS';
    else if (resultCode === 1000) status = 'FAILED';
    else if (resultCode === 1006) status = 'EXPIRED';

    return {
      orderId: aladinOrderId,
      transactionId: (result.transId as string) || '',
      amount: parseInt((result.amount as string) || '0', 10),
      status,
      gateway: 'MOMO',
    };
  } catch (error) {
    console.error('[MOMO] Query status error:', error);
    return null;
  }
}
