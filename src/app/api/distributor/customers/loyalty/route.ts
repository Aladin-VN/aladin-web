// ALADIN — Distributor Customer Loyalty Points Adjustment API
// POST /api/distributor/customers/loyalty — Adjust loyalty points (EARN / REDEEM / ADJUST)

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, successResponse, errorResponse, sanitizeInput, LOYALTY_TIERS } from '@/lib/security';
import { db } from '@/lib/db';

const VALID_TYPES = ['EARN', 'REDEEM', 'ADJUST'] as const;

/** Determine tier from totalSpend using LOYALTY_TIERS thresholds */
function tierFromSpend(totalSpend: number): string {
  if (totalSpend >= LOYALTY_TIERS.PLATINUM.minGmv) return 'PLATINUM';
  if (totalSpend >= LOYALTY_TIERS.GOLD.minGmv) return 'GOLD';
  if (totalSpend >= LOYALTY_TIERS.SILVER.minGmv) return 'SILVER';
  return 'BRONZE';
}

// ============================================================
// POST — Adjust loyalty points
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
    const { customerId, type, points, description, orderId } = body as {
      customerId?: string;
      type?: string;
      points?: number;
      description?: string;
      orderId?: string;
    };

    // --- Validate required fields ---
    if (!customerId || typeof customerId !== 'string' || customerId.trim().length === 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'ID khách hàng là bắt buộc.'), { status: 400 });
    }

    if (!type || !VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Loại giao dịch không hợp lệ. Chọn: ${VALID_TYPES.join(', ')}.`),
        { status: 400 },
      );
    }

    if (points === undefined || points === null || !Number.isInteger(points)) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Số điểm phải là số nguyên.'), { status: 400 });
    }

    // --- Validate customer exists and belongs to this distributor ---
    const customer = await db.distributorCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        distributorId: true,
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

    // --- Validate points based on type ---
    const typedPoints = Number(points);
    let newBalance: number;

    switch (type) {
      case 'EARN':
        if (typedPoints <= 0) {
          return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Điểm tích lũy phải lớn hơn 0.'), { status: 400 });
        }
        newBalance = customer.loyaltyPoints + typedPoints;
        break;

      case 'REDEEM':
        if (typedPoints <= 0) {
          return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Điểm đổi phải lớn hơn 0.'), { status: 400 });
        }
        if (typedPoints > customer.loyaltyPoints) {
          return NextResponse.json(
            errorResponse('INSUFFICIENT_POINTS', `Số dư không đủ. Hiện có ${customer.loyaltyPoints} điểm.`),
            { status: 400 },
          );
        }
        newBalance = customer.loyaltyPoints - typedPoints;
        break;

      case 'ADJUST':
        // Can be positive or negative, but balance must not go below 0
        newBalance = customer.loyaltyPoints + typedPoints;
        if (newBalance < 0) {
          return NextResponse.json(
            errorResponse('VALIDATION_ERROR', `Số dư không thể âm. Hiện có ${customer.loyaltyPoints} điểm, điều chỉnh ${typedPoints > 0 ? '+' : ''}${typedPoints} sẽ còn ${newBalance}.`),
            { status: 400 },
          );
        }
        break;

      default:
        return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Loại giao dịch không hợp lệ.'), { status: 400 });
    }

    // --- Sanitize optional string inputs ---
    const sanitizedDescription = description ? sanitizeInput(description) : null;
    const sanitizedOrderId = orderId || null;

    // --- Build description if not provided ---
    const txDescription =
      sanitizedDescription ||
      (type === 'EARN'
        ? `Tích lũy +${typedPoints} điểm`
        : type === 'REDEEM'
          ? `Đổi thưởng -${typedPoints} điểm`
          : `Điều chỉnh ${typedPoints >= 0 ? '+' : ''}${typedPoints} điểm`);

    // --- Determine the points value stored in transaction ---
    // EARN: positive, REDEEM: negative, ADJUST: as-is (positive or negative)
    const txPoints = type === 'REDEEM' ? -typedPoints : typedPoints;

    // --- Create LoyaltyTransaction and update customer in a transaction ---
    const [transaction, updatedCustomer] = await db.$transaction([
      db.loyaltyTransaction.create({
        data: {
          customerId: customer.id,
          distributorId: distId,
          type,
          points: txPoints,
          balance: newBalance,
          description: txDescription,
          orderId: sanitizedOrderId,
        },
      }),
      db.distributorCustomer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: newBalance,
          // Auto-upgrade tier based on totalSpend (only upgrade, never downgrade on manual adjust)
          loyaltyTier: tierFromSpend(customer.totalSpend),
        },
      }),
    ]);

    return NextResponse.json(
      successResponse({
        customer: updatedCustomer,
        transaction,
      }),
    );
  } catch (error) {
    console.error('[DISTRIBUTOR LOYALTY ADJUST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}