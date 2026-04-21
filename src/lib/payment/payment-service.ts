// ALADIN Payment Service
// Sprint 4F — Business logic layer for payment operations

import { db } from '../db';
import { PAYMENT_CONFIG, type PaymentGatewayType } from './config';
import type { CreatePaymentResult, PaymentCallback, PaymentQuery } from './gateway';
import type { CreatePaymentRequest } from './gateway';
import { createZaloPayPayment, queryZaloPayStatus } from './zalopay';
import { createMoMoPayment, queryMoMoStatus } from './momo';
import { createMockPayment, queryMockStatus } from './mock-gateway';
import { TRANSACTION_TYPES, PAYMENT_METHOD } from '../security';

// ============================================
// CREATE PAYMENT FOR ORDER
// ============================================

export async function createPaymentForOrder(
  orderId: string,
  requestedGateway: PaymentGatewayType
): Promise<CreatePaymentResult> {
  // 1. Fetch and validate order
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      shop: {
        include: { user: { select: { zaloId: true, id: true } } },
      },
    },
  });

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.status !== 'PENDING') {
    return { success: false, error: `Order status is ${order.status}, cannot create payment` };
  }

  if (order.paymentMethod !== 'DIGITAL') {
    return { success: false, error: `Order payment method is ${order.paymentMethod}, not DIGITAL` };
  }

  if (order.paymentStatus === 'PAID') {
    return { success: false, error: 'Order already paid' };
  }

  // Check for existing active payment (idempotency)
  const existingPayment = await db.payment.findFirst({
    where: {
      orderId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
  });

  if (existingPayment) {
    // Return existing payment URL if still valid
    if (existingPayment.paymentUrl) {
      return {
        success: true,
        paymentUrl: existingPayment.paymentUrl,
        transactionId: existingPayment.gatewayTxId || existingPayment.id,
        gatewayTxId: existingPayment.gatewayTxId || undefined,
      };
    }
  }

  // 2. Resolve effective gateway
  const gateway = PAYMENT_CONFIG.resolveGateway(requestedGateway);

  // 3. Build payment request
  const paymentRequest: CreatePaymentRequest = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: order.totalAmount,
    description: `ALADIN ${order.orderNumber}`,
    shopName: order.shop.name,
    userId: order.shop.user.id,
  };

  // 4. Dispatch to gateway
  let result: CreatePaymentResult;
  let rawRequestStr = '';

  switch (gateway) {
    case 'ZALOPAY':
      result = await createZaloPayPayment(paymentRequest);
      rawRequestStr = JSON.stringify(paymentRequest);
      break;
    case 'MOMO':
      result = await createMoMoPayment(paymentRequest);
      rawRequestStr = JSON.stringify(paymentRequest);
      break;
    case 'MOCK':
    default:
      result = await createMockPayment(paymentRequest);
      rawRequestStr = JSON.stringify(paymentRequest);
      break;
  }

  if (!result.success) {
    return result;
  }

  // 5. Create Payment record in DB
  const expiresAt = new Date(Date.now() + PAYMENT_CONFIG.EXPIRY_MINUTES * 60 * 1000);

  await db.payment.create({
    data: {
      orderId: order.id,
      gateway,
      gatewayTxId: result.gatewayTxId || result.transactionId || null,
      amount: paymentRequest.amount,
      status: 'PENDING',
      paymentUrl: result.paymentUrl || null,
      qrCodeUrl: result.qrCodeUrl || null,
      rawRequest: rawRequestStr,
      expiresAt,
    },
  });

  console.log(`[PAYMENT] Created ${gateway} payment for order ${order.orderNumber} (${paymentRequest.amount}d)`);

  return result;
}

// ============================================
// HANDLE PAYMENT CALLBACK
// ============================================

export async function handlePaymentCallback(callback: PaymentCallback): Promise<void> {
  if (!callback.orderId) {
    console.error('[PAYMENT] Callback missing orderId');
    return;
  }

  // 1. Find payment by gatewayTxId
  const payment = await db.payment.findUnique({
    where: { gatewayTxId: callback.transactionId },
    include: { order: true },
  });

  if (!payment) {
    console.error(`[PAYMENT] Payment not found for gatewayTxId: ${callback.transactionId}`);
    // Try finding by orderId instead
    const paymentByOrder = await db.payment.findFirst({
      where: { orderId: callback.orderId, gateway: callback.gateway },
      include: { order: true },
    });
    if (!paymentByOrder) {
      console.error(`[PAYMENT] No payment found for order ${callback.orderId} via ${callback.gateway}`);
      return;
    }
    await processPaymentCallback(paymentByOrder.id, callback);
    return;
  }

  await processPaymentCallback(payment.id, callback);
}

async function processPaymentCallback(paymentId: string, callback: PaymentCallback): Promise<void> {
  // 2. Idempotency: skip if already processed
  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) return;

  if (payment.status === 'SUCCESS' && callback.status === 'SUCCESS') {
    console.log(`[PAYMENT] Already processed SUCCESS for payment ${paymentId}, skipping`);
    return;
  }

  // 3. Update payment status
  const newStatus = callback.status === 'SUCCESS' ? 'SUCCESS' : callback.status === 'FAILED' ? 'FAILED' : 'PENDING';

  const updateData: Record<string, unknown> = {
    status: newStatus,
    rawCallback: JSON.stringify(callback.rawData),
    updatedAt: new Date(),
  };

  if (callback.status === 'SUCCESS') {
    updateData.paidAt = new Date();
  }

  await db.payment.update({
    where: { id: paymentId },
    data: updateData,
  });

  // 4. If SUCCESS: update order paymentStatus and create transaction
  if (callback.status === 'SUCCESS') {
    const order = payment.order;
    if (order.paymentStatus !== 'PAID') {
      await db.$transaction(async (tx) => {
        // Update order
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            paidAmount: callback.amount,
            status: 'CONFIRMED',
            confirmedAt: new Date(),
          },
        });

        // Create PAYMENT_RECEIVED transaction
        await tx.transaction.create({
          data: {
            shopId: order.shopId,
            orderId: order.id,
            type: TRANSACTION_TYPES.ORDER_PAYMENT,
            amount: callback.amount,
            runningBalance: 0, // Digital payment doesn't affect credit balance
            paymentMethod: PAYMENT_METHOD.DIGITAL,
            paymentRef: callback.transactionId,
            description: `Digital payment received for ${order.orderNumber} via ${callback.gateway}`,
          },
        });
      });

      console.log(`[PAYMENT] Order ${order.orderNumber} marked as PAID via ${callback.gateway}`);

      // 5. Send notification to shop owner (async, non-blocking)
      try {
        const { sendNotification } = await import('../zalo/notification-engine');
        const shopWithUser = await db.shop.findUnique({
          where: { id: order.shopId },
          include: { user: { select: { zaloId: true } } },
        });
        if (shopWithUser?.user?.zaloId) {
          sendNotification(shopWithUser.user.zaloId, 'ORDER_CONFIRMED' as never, {
            orderNumber: order.orderNumber,
            status: 'CONFIRMED',
            itemCount: 0,
            totalAmount: callback.amount,
            paymentMethod: 'DIGITAL',
            shopName: shopWithUser.name,
          });
        }
      } catch (notifError) {
        console.error('[PAYMENT] Failed to send payment notification:', notifError);
      }
    }
  }
}

// ============================================
// GET PAYMENT STATUS
// ============================================

export async function getPaymentStatus(orderId: string): Promise<PaymentQuery | null> {
  const payment = await db.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (!payment) return null;

  // If payment is still PENDING and not expired, query the gateway
  if (payment.status === 'PENDING' && payment.expiresAt && payment.expiresAt > new Date()) {
    let queryResult: PaymentQuery | null = null;

    switch (payment.gateway) {
      case 'ZALOPAY':
        if (payment.gatewayTxId) {
          queryResult = await queryZaloPayStatus(payment.gatewayTxId);
        }
        break;
      case 'MOMO':
        if (payment.gatewayTxId) {
          queryResult = await queryMoMoStatus(payment.gatewayTxId);
        }
        break;
      case 'MOCK':
        queryResult = await queryMockStatus(orderId);
        break;
    }

    // Update local record if gateway has different status
    if (queryResult && queryResult.status !== 'PENDING') {
      const newStatus = queryResult.status === 'SUCCESS' ? 'SUCCESS'
        : queryResult.status === 'FAILED' ? 'FAILED' : 'EXPIRED';

      await db.payment.update({
        where: { id: payment.id },
        data: {
          status: newStatus,
          ...(queryResult.status === 'SUCCESS' ? { paidAt: new Date() } : {}),
        },
      });

      // If gateway says SUCCESS, process it
      if (queryResult.status === 'SUCCESS') {
        await handlePaymentCallback({
          orderId,
          transactionId: queryResult.transactionId,
          amount: queryResult.amount,
          status: 'SUCCESS',
          gateway: queryResult.gateway,
          rawData: {},
        });
      }

      return queryResult;
    }
  }

  // Check if expired
  if (payment.status === 'PENDING' && payment.expiresAt && payment.expiresAt <= new Date()) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'EXPIRED' },
    });
  }

  // Return local status
  const statusMap: Record<string, PaymentQuery['status']> = {
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    EXPIRED: 'EXPIRED',
    PENDING: 'PENDING',
  };

  return {
    orderId,
    transactionId: payment.gatewayTxId || payment.id,
    amount: payment.amount,
    status: statusMap[payment.status] || 'PENDING',
    gateway: payment.gateway as PaymentQuery['gateway'],
  };
}

// ============================================
// GET PAYMENT BY ID (for API status endpoint)
// ============================================

export async function getPaymentById(paymentId: string) {
  return db.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
        },
      },
    },
  });
}

// ============================================
// GET PAYMENT FOR ORDER
// ============================================

export async function getPaymentForOrder(orderId: string) {
  return db.payment.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    include: {
      order: {
        select: {
          orderNumber: true,
          totalAmount: true,
          paymentStatus: true,
          status: true,
        },
      },
    },
  });
}
