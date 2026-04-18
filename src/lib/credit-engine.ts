// ALADIN Credit Engine — 7-Day Micro-Credit System
// Core financial engine for B2B commerce platform
// All credit operations use db.$transaction for atomicity

import { db } from './db';
import { CREDIT_CONFIG, TRANSACTION_TYPES } from './security';
import type { TransactionSummary, TransactionType, CreditStatus } from '@/types';

// ============================================
// CREDIT OPERATIONS (All atomic via db.$transaction)
// ============================================

/**
 * Record credit usage when a shop places an order on credit.
 * Creates a CREDIT_USED transaction and updates shop balance.
 */
export async function useCredit(shopId: string, orderId: string, amount: number) {
  if (!amount || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  return db.$transaction(async (tx) => {
    // Fetch shop with lock
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');
    if (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE') {
      throw new Error(`Shop credit is ${shop.creditStatus}. Cannot use credit.`);
    }

    const available = shop.creditLimit - shop.creditBalance;
    if (amount > available) {
      throw new Error(
        `Insufficient credit. Available: ${formatVND(available)}, Requested: ${formatVND(amount)}`
      );
    }

    const newBalance = shop.creditBalance + amount;

    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        shopId,
        orderId,
        type: TRANSACTION_TYPES.CREDIT_USED,
        amount, // positive = increases credit balance (debit to shop)
        runningBalance: newBalance,
        description: `Credit used for order`,
      },
    });

    // Update shop credit balance
    await tx.shop.update({
      where: { id: shopId },
      data: { creditBalance: newBalance },
    });

    return transaction;
  });
}

/**
 * Record repayment against a shop's credit balance.
 * Supports partial and full repayments.
 * If credit reaches 0, reactivates shop from LOCKED/OVERDUE.
 */
export async function repayCredit(
  shopId: string,
  orderId: string,
  amount: number,
  paymentMethod: string,
  collectedBy?: string
) {
  if (!amount || amount <= 0) {
    throw new Error('Repayment amount must be a positive number');
  }

  return db.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    if (shop.creditBalance <= 0) {
      throw new Error('No outstanding credit balance to repay');
    }

    // Clamp repayment to actual balance
    const actualRepay = Math.min(amount, shop.creditBalance);
    const newBalance = shop.creditBalance - actualRepay;
    const isFullRepayment = newBalance === 0;

    // Create transaction record (negative amount = reduces balance)
    const transaction = await tx.transaction.create({
      data: {
        shopId,
        orderId,
        type: TRANSACTION_TYPES.REPAYMENT,
        amount: -actualRepay, // negative = repayment
        runningBalance: newBalance,
        paymentMethod,
        collectedBy,
        description: isFullRepayment
          ? `Full repayment (${formatVND(actualRepay)})`
          : `Partial repayment (${formatVND(actualRepay)} of ${formatVND(shop.creditBalance)})`,
      },
    });

    // Update shop
    const updateData: Record<string, unknown> = { creditBalance: newBalance };

    // If fully repaid and was locked/overdue, reactivate
    if (isFullRepayment && (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE')) {
      updateData.creditStatus = 'ACTIVE';
    }

    await tx.shop.update({
      where: { id: shopId },
      data: updateData,
    });

    return { transaction, newBalance, isFullRepayment };
  });
}

/**
 * Adjust a shop's credit limit (admin action).
 * Validates against CREDIT_CONFIG bounds (500K - 10M VND).
 * Creates an audit transaction record.
 */
export async function adjustCreditLimit(
  shopId: string,
  newLimit: number,
  adminUserId: string
) {
  if (!Number.isInteger(newLimit) || newLimit < CREDIT_CONFIG.MIN_LIMIT || newLimit > CREDIT_CONFIG.MAX_LIMIT) {
    throw new Error(
      `Credit limit must be between ${formatVND(CREDIT_CONFIG.MIN_LIMIT)} and ${formatVND(CREDIT_CONFIG.MAX_LIMIT)}`
    );
  }

  return db.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    const oldLimit = shop.creditLimit;
    const isIncrease = newLimit > oldLimit;
    const difference = Math.abs(newLimit - oldLimit);

    // Create audit transaction
    const transaction = await tx.transaction.create({
      data: {
        shopId,
        type: isIncrease
          ? TRANSACTION_TYPES.CREDIT_LIMIT_INCREASE
          : TRANSACTION_TYPES.CREDIT_LIMIT_DECREASE,
        amount: 0, // limit change doesn't affect running balance
        runningBalance: shop.creditBalance, // balance unchanged
        description: `Credit limit ${isIncrease ? 'increased' : 'decreased'} from ${formatVND(oldLimit)} to ${formatVND(newLimit)} by admin`,
        metadata: JSON.stringify({
          oldLimit,
          newLimit,
          difference,
          adminUserId,
        }),
      },
    });

    // Update shop credit limit
    await tx.shop.update({
      where: { id: shopId },
      data: { creditLimit: newLimit },
    });

    return { transaction, oldLimit, newLimit, shop };
  });
}

/**
 * Record a digital or COD payment for an order.
 * Updates order.paidAmount and marks as PAID when fully settled.
 */
export async function recordOrderPayment(
  shopId: string,
  orderId: string,
  amount: number,
  paymentMethod: string
) {
  if (!amount || amount <= 0) {
    throw new Error('Payment amount must be a positive number');
  }

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.shopId !== shopId) throw new Error('Order does not belong to this shop');

    const remaining = order.totalAmount - order.paidAmount;
    const actualPayment = Math.min(amount, remaining);
    const newPaidAmount = order.paidAmount + actualPayment;
    const isPaidInFull = newPaidAmount >= order.totalAmount;

    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        shopId,
        orderId,
        type: TRANSACTION_TYPES.ORDER_PAYMENT,
        amount: -actualPayment, // negative = money received
        runningBalance: 0, // order payments don't affect credit balance
        paymentMethod,
        description: isPaidInFull
          ? `Order paid in full (${formatVND(newPaidAmount)})`
          : `Order partial payment (${formatVND(actualPayment)})`,
      },
    });

    // Update order
    const updateData: Record<string, unknown> = { paidAmount: newPaidAmount };
    if (isPaidInFull) {
      updateData.paymentStatus = 'PAID';
    }

    await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return { transaction, newPaidAmount, isPaidInFull };
  });
}

/**
 * Refund credit for a cancelled order.
 * Reduces shop credit balance by the refunded amount.
 */
export async function refundCredit(shopId: string, orderId: string, amount: number) {
  if (!amount || amount <= 0) {
    throw new Error('Refund amount must be a positive number');
  }

  return db.$transaction(async (tx) => {
    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    if (amount > shop.creditBalance) {
      throw new Error(
        `Refund amount (${formatVND(amount)}) exceeds outstanding balance (${formatVND(shop.creditBalance)})`
      );
    }

    const newBalance = shop.creditBalance - amount;

    const transaction = await tx.transaction.create({
      data: {
        shopId,
        orderId,
        type: TRANSACTION_TYPES.REFUND,
        amount: -amount, // negative = reduces balance
        runningBalance: newBalance,
        description: `Credit refund for cancelled order (${formatVND(amount)})`,
      },
    });

    const updateData: Record<string, unknown> = { creditBalance: newBalance };
    // If fully cleared and was locked/overdue, reactivate
    if (newBalance === 0 && (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE')) {
      updateData.creditStatus = 'ACTIVE';
    }

    await tx.shop.update({
      where: { id: shopId },
      data: updateData,
    });

    return { transaction, newBalance };
  });
}

/**
 * Process refund for cancelled orders — composite operation.
 * Handles both credit refund and any digital payment refund.
 */
export async function processRefund(shopId: string, orderId: string, amount: number) {
  if (!amount || amount <= 0) {
    throw new Error('Refund amount must be a positive number');
  }

  return db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');
    if (order.shopId !== shopId) throw new Error('Order does not belong to this shop');

    const shop = await tx.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new Error('Shop not found');

    // Determine refund breakdown: credit first, then paid amount
    let creditRefund = 0;
    let paymentRefund = 0;

    // Refund from credit used
    const creditToRefund = Math.min(amount, order.creditUsed, shop.creditBalance);
    if (creditToRefund > 0) {
      creditRefund = creditToRefund;
    }

    // Remaining from paid amount
    const remaining = amount - creditRefund;
    if (remaining > 0 && order.paidAmount > 0) {
      paymentRefund = Math.min(remaining, order.paidAmount);
    }

    if (creditRefund === 0 && paymentRefund === 0) {
      throw new Error('Nothing to refund for this order');
    }

    // Create refund transaction for credit portion
    let transaction;
    if (creditRefund > 0) {
      const newBalance = shop.creditBalance - creditRefund;
      transaction = await tx.transaction.create({
        data: {
          shopId,
          orderId,
          type: TRANSACTION_TYPES.REFUND,
          amount: -creditRefund,
          runningBalance: newBalance,
          description: `Order refund: ${formatVND(amount)} (credit: ${formatVND(creditRefund)}, payment: ${formatVND(paymentRefund)})`,
          metadata: JSON.stringify({ creditRefund, paymentRefund }),
        },
      });

      const updateData: Record<string, unknown> = { creditBalance: newBalance };
      if (newBalance === 0 && (shop.creditStatus === 'LOCKED' || shop.creditStatus === 'OVERDUE')) {
        updateData.creditStatus = 'ACTIVE';
      }
      await tx.shop.update({
        where: { id: shopId },
        data: updateData,
      });
    } else {
      // Payment-only refund
      transaction = await tx.transaction.create({
        data: {
          shopId,
          orderId,
          type: TRANSACTION_TYPES.REFUND,
          amount: -paymentRefund,
          runningBalance: shop.creditBalance,
          description: `Order refund: ${formatVND(amount)} (payment refund)`,
          metadata: JSON.stringify({ creditRefund, paymentRefund }),
        },
      });
    }

    // Update order paid amount and payment status
    if (paymentRefund > 0) {
      const newPaidAmount = order.paidAmount - paymentRefund;
      const paymentStatus = newPaidAmount <= 0 ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await tx.order.update({
        where: { id: orderId },
        data: {
          paidAmount: Math.max(0, newPaidAmount),
          paymentStatus,
          creditUsed: Math.max(0, order.creditUsed - creditRefund),
        },
      });
    } else if (creditRefund > 0) {
      await tx.order.update({
        where: { id: orderId },
        data: {
          creditUsed: Math.max(0, order.creditUsed - creditRefund),
        },
      });
    }

    return { transaction, creditRefund, paymentRefund };
  });
}

// ============================================
// AUTOMATION RULES
// ============================================

/**
 * Check and lock shops with unpaid credit older than 7 days.
 * Called by admin endpoint or scheduled job.
 * Returns count of shops that were locked.
 */
export async function checkAndLockOverdueShops(): Promise<{
  lockedCount: number;
  alreadyOverdue: number;
  details: Array<{ shopId: string; shopName: string; overdueDays: number }>;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - CREDIT_CONFIG.CREDIT_DAYS * 24 * 60 * 60 * 1000);

  // Find all ACTIVE shops with outstanding credit
  const shopsWithCredit = await db.shop.findMany({
    where: {
      creditBalance: { gt: 0 },
      creditStatus: 'ACTIVE',
    },
  });

  let lockedCount = 0;
  let alreadyOverdue = 0;
  const details: Array<{ shopId: string; shopName: string; overdueDays: number }> = [];

  for (const shop of shopsWithCredit) {
    // Find the oldest CREDIT_USED transaction for this shop
    const oldestCreditUsed = await db.transaction.findFirst({
      where: {
        shopId: shop.id,
        type: TRANSACTION_TYPES.CREDIT_USED,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!oldestCreditUsed) continue;

    if (oldestCreditUsed.createdAt < sevenDaysAgo) {
      // This shop is overdue — lock it
      const overdueDays = Math.floor(
        (now.getTime() - oldestCreditUsed.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      await db.$transaction(async (tx) => {
        // Create lock transaction record
        await tx.transaction.create({
          data: {
            shopId: shop.id,
            type: TRANSACTION_TYPES.CREDIT_USED, // using CREDIT_USED as the lock marker
            amount: 0,
            runningBalance: shop.creditBalance,
            description: `Shop locked — credit overdue by ${overdueDays} days (auto-lock)`,
            metadata: JSON.stringify({ action: 'AUTO_LOCK', overdueDays }),
          },
        });

        // Lock the shop
        await tx.shop.update({
          where: { id: shop.id },
          data: { creditStatus: 'OVERDUE' },
        });
      });

      lockedCount++;
      details.push({ shopId: shop.id, shopName: shop.name, overdueDays });
    }
  }

  // Also count already overdue shops
  const existingOverdue = await db.shop.count({
    where: { creditStatus: 'OVERDUE' },
  });
  alreadyOverdue = existingOverdue;

  return { lockedCount, alreadyOverdue, details };
}

/**
 * Get comprehensive credit information for a shop.
 * Includes balance, status, days until due, transaction history.
 */
export async function getShopCreditInfo(shopId: string) {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true,
      name: true,
      creditLimit: true,
      creditBalance: true,
      creditStatus: true,
      loyaltyTier: true,
    },
  });

  if (!shop) throw new Error('Shop not found');

  const available = calculateAvailableCredit(shop);
  const daysUntilDue = await getDaysUntilDue(shopId);

  // Get latest 20 transactions
  const transactions = await db.transaction.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      order: { select: { orderNumber: true } },
    },
  });

  // Total repaid this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const monthlyRepayments = await db.transaction.aggregate({
    where: {
      shopId,
      type: TRANSACTION_TYPES.REPAYMENT,
      createdAt: { gte: monthStart, lt: monthEnd },
    },
    _sum: { amount: true },
  });

  const totalRepaidThisMonth = Math.abs(monthlyRepayments._sum.amount || 0);

  // Total credit used this month
  const monthlyCreditUsed = await db.transaction.aggregate({
    where: {
      shopId,
      type: TRANSACTION_TYPES.CREDIT_USED,
      createdAt: { gte: monthStart, lt: monthEnd },
      amount: { gt: 0 }, // only actual credit usage, not lock markers
    },
    _sum: { amount: true },
  });

  const totalCreditUsedThisMonth = monthlyCreditUsed._sum.amount || 0;

  return {
    shop: {
      id: shop.id,
      name: shop.name,
      loyaltyTier: shop.loyaltyTier,
    },
    credit: {
      limit: shop.creditLimit,
      used: shop.creditBalance,
      available,
      status: shop.creditStatus as CreditStatus,
      utilizationPercent: shop.creditLimit > 0
        ? Math.round((shop.creditBalance / shop.creditLimit) * 100)
        : 0,
      daysUntilDue,
    },
    monthly: {
      totalRepaid: totalRepaidThisMonth,
      totalCreditUsed: totalCreditUsedThisMonth,
    },
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type as TransactionType,
      amount: t.amount,
      runningBalance: t.runningBalance,
      paymentMethod: t.paymentMethod,
      description: t.description,
      orderNumber: t.order?.orderNumber || null,
      createdAt: t.createdAt,
    })),
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate available credit for a shop.
 */
export function calculateAvailableCredit(shop: { creditLimit: number; creditBalance: number }): number {
  return Math.max(0, shop.creditLimit - shop.creditBalance);
}

/**
 * Check if a shop's credit is healthy.
 * Returns status, warnings, and recommendations.
 */
export function isCreditHealthy(shop: {
  creditLimit: number;
  creditBalance: number;
  creditStatus: string;
}): {
  isHealthy: boolean;
  status: string;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  const available = shop.creditLimit - shop.creditBalance;
  const utilization = shop.creditLimit > 0 ? shop.creditBalance / shop.creditLimit : 0;

  if (shop.creditStatus === 'OVERDUE') {
    return {
      isHealthy: false,
      status: 'OVERDUE',
      warnings: ['Shop credit is overdue. Immediate collection required.'],
      recommendations: ['Contact shop owner immediately.', 'Suspend new orders until payment is received.', 'Consider sending a field collector.'],
    };
  }

  if (shop.creditStatus === 'LOCKED') {
    return {
      isHealthy: false,
      status: 'LOCKED',
      warnings: ['Shop credit is locked. No new credit transactions allowed.'],
      recommendations: ['Wait for repayment to clear.', 'If repaid, credit will auto-reactivate.'],
    };
  }

  if (utilization > 0.9) {
    warnings.push('Credit utilization exceeds 90%. Risk of hitting limit.');
    recommendations.push('Consider collecting partial payment.');
  } else if (utilization > 0.7) {
    warnings.push('Credit utilization is high (>70%). Monitor closely.');
  }

  if (available < CREDIT_CONFIG.MIN_LIMIT * 0.5) {
    warnings.push(`Available credit (${formatVND(available)}) is very low.`);
    recommendations.push('Consider increasing credit limit for high-volume shops.');
  }

  return {
    isHealthy: warnings.length === 0,
    status: shop.creditStatus,
    warnings,
    recommendations,
  };
}

/**
 * Get days remaining before a shop's credit becomes overdue.
 * Based on the oldest unpaid CREDIT_USED transaction.
 */
export async function getDaysUntilDue(shopId: string): Promise<number | null> {
  // Find the oldest CREDIT_USED transaction with positive amount
  const oldestCreditUsed = await db.transaction.findFirst({
    where: {
      shopId,
      type: TRANSACTION_TYPES.CREDIT_USED,
      amount: { gt: 0 },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!oldestCreditUsed) return null; // No credit used

  const now = new Date();
  const dueDate = new Date(
    oldestCreditUsed.createdAt.getTime() + CREDIT_CONFIG.CREDIT_DAYS * 24 * 60 * 60 * 1000
  );
  const daysRemaining = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

  return Math.max(0, daysRemaining);
}

/**
 * Format running balance for display with VND sign.
 * Shows + for positive (credit used) and - for negative (repayment/refund).
 */
export function formatRunningBalance(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${formatVND(amount)}`;
}

// ============================================
// INTERNAL HELPER (uses formatVND from security)
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}
