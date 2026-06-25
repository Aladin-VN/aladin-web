// ALADIN — Distributor Customer Credit Repayment API
// POST /api/distributor/customers/credit-payment — Record a credit repayment

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse, sanitizeInput, LOYALTY_TIERS } from '@/lib/security';
import { db } from '@/lib/db';

const VALID_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER'] as const;

/** Loyalty reward: 1 point per 100,000 VND paid */
const POINTS_PER_100K = 1;
const VND_PER_POINT = 100_000;

/** Determine tier from totalSpend */
function tierFromSpend(totalSpend: number): string {
  if (totalSpend >= LOYALTY_TIERS.PLATINUM.minGmv) return 'PLATINUM';
  if (totalSpend >= LOYALTY_TIERS.GOLD.minGmv) return 'GOLD';
  if (totalSpend >= LOYALTY_TIERS.SILVER.minGmv) return 'SILVER';
  return 'BRONZE';
}

// ============================================================
// POST — Record credit repayment
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền nhà phân phối.'), { status: 403 });
    }

    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    const body = await request.json();
    const { customerId, amount, paymentMethod, notes } = body as {
      customerId?: string;
      amount?: number;
      paymentMethod?: string;
      notes?: string;
    };

    // --- Validate required fields ---
    if (!customerId || typeof customerId !== 'string' || customerId.trim().length === 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'ID khách hàng là bắt buộc.'), { status: 400 });
    }

    if (amount === undefined || amount === null || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Số tiền thanh toán phải lớn hơn 0.'), { status: 400 });
    }

    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod as typeof VALID_PAYMENT_METHODS[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Phương thức thanh toán không hợp lệ. Chọn: ${VALID_PAYMENT_METHODS.join(', ')}.`),
        { status: 400 },
      );
    }

    const paymentAmount = Math.round(Number(amount));

    // --- Validate customer exists, belongs to distributor, has outstanding credit ---
    const customer = await db.distributorCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        distributorId: true,
        name: true,
        creditBalance: true,
        creditStatus: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        totalSpend: true,
      },
    });

    if (!customer) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy khách hàng.'), { status: 404 });
    }
    if (customer.distributorId !== distId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Không có quyền thao tác với khách hàng này.'), { status: 403 });
    }
    if (customer.creditBalance <= 0) {
      return NextResponse.json(errorResponse('NO_CREDIT', 'Khách hàng không có công nợ.'), { status: 400 });
    }
    if (paymentAmount > customer.creditBalance) {
      return NextResponse.json(
        errorResponse('EXCEEDS_DEBT', `Số tiền thanh toán vượt quá công nợ. Công nợ hiện tại: ${new Intl.NumberFormat('vi-VN').format(customer.creditBalance)} ₫.`),
        { status: 400 },
      );
    }

    // --- Calculate new credit balance and loyalty reward ---
    const newCreditBalance = customer.creditBalance - paymentAmount;
    const loyaltyPointsEarned = Math.floor(paymentAmount / VND_PER_POINT) * POINTS_PER_100K;
    const newLoyaltyPoints = customer.loyaltyPoints + loyaltyPointsEarned;

    // --- Sanitize optional notes ---
    const sanitizedNotes = notes ? sanitizeInput(notes) : null;

    // --- Build description for loyalty transaction ---
    const methodLabel = paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản';
    const txDescription = sanitizedNotes
      ? `Thưởng trả nợ ${methodLabel} - ${sanitizedNotes}`
      : `Thưởng trả nợ ${methodLabel}`;

    // --- Execute in a transaction: create loyalty tx + update customer ---
    const updateData: Record<string, unknown> = {
      creditBalance: newCreditBalance,
      loyaltyPoints: newLoyaltyPoints,
      loyaltyTier: tierFromSpend(customer.totalSpend),
    };
    // If fully paid off, reset credit status to ACTIVE
    if (newCreditBalance <= 0) {
      updateData.creditStatus = 'ACTIVE';
      updateData.creditBalance = 0;
    }

    const [loyaltyTx, updatedCustomer] = await db.$transaction([
      // Create loyalty transaction (EARN) as reward for repayment
      db.loyaltyTransaction.create({
        data: {
          customerId: customer.id,
          distributorId: distId,
          type: 'EARN',
          points: loyaltyPointsEarned,
          balance: newLoyaltyPoints,
          description: loyaltyPointsEarned > 0
            ? `${txDescription}: +${loyaltyPointsEarned} điểm`
            : `${txDescription} (không đủ 100K để tích điểm)`,
        },
      }),
      // Update customer
      db.distributorCustomer.update({
        where: { id: customer.id },
        data: updateData,
      }),
    ]);

    return NextResponse.json(
      successResponse({
        customer: updatedCustomer,
        payment: {
          customerId: customer.id,
          customerName: customer.name,
          amount: paymentAmount,
          paymentMethod,
          previousBalance: customer.creditBalance,
          newBalance: newCreditBalance,
          fullyPaid: newCreditBalance <= 0,
        },
        loyaltyReward: {
          pointsEarned: loyaltyPointsEarned,
          previousPoints: customer.loyaltyPoints,
          newPoints: newLoyaltyPoints,
        },
        transaction: loyaltyTx,
      }),
    );
  } catch (error) {
    console.error('[DISTRIBUTOR CREDIT PAYMENT ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}