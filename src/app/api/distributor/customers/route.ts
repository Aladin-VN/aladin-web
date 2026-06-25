// ALADIN — Distributor Customer Management API
// GET    /api/distributor/customers          — List customers with filters & stats
// POST   /api/distributor/customers          — Create a new customer
// PUT    /api/distributor/customers          — Update an existing customer

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import {
  ROLES,
  successResponse,
  errorResponse,
  sanitizeInput,
  isValidVNPhone,
  LOYALTY_TIERS,
} from '@/lib/security';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

// ============================================================
// Helpers
// ============================================================

const VALID_SHOP_TYPES = ['TAPHOA', 'CONVENIENCE', 'RESTAURANT', 'FACTORY'] as const;
const VALID_TIERS = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
const VALID_CREDIT_STATUSES = ['ACTIVE', 'LOCKED', 'OVERDUE'] as const;

/** Determine tier from totalSpend */
function tierFromSpend(totalSpend: number): string {
  if (totalSpend >= LOYALTY_TIERS.PLATINUM.minGmv) return 'PLATINUM';
  if (totalSpend >= LOYALTY_TIERS.GOLD.minGmv) return 'GOLD';
  if (totalSpend >= LOYALTY_TIERS.SILVER.minGmv) return 'SILVER';
  return 'BRONZE';
}

/** Build the Prisma orderBy clause from the sort param */
function buildSortParam(sort: string | null): Prisma.DistributorCustomerOrderByWithRelationInput {
  switch (sort) {
    case 'totalSpend':
      return { totalSpend: 'desc' };
    case 'loyaltyPoints':
      return { loyaltyPoints: 'desc' };
    case 'latest':
    default:
      return { createdAt: 'desc' };
  }
}

// ============================================================
// GET — List customers with pagination, search, filters, stats
// ============================================================
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = searchParams.get('search')?.trim() || null;
    const tier = searchParams.get('tier') || null;
    const creditStatus = searchParams.get('creditStatus') || null;
    const sort = searchParams.get('sort') || 'latest';

    // --- Build where clause ---
    const where: Prisma.DistributorCustomerWhereInput = { distributorId: distId };

    if (search) {
      const sanitized = sanitizeInput(search);
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { phone: { contains: sanitized } },
        { code: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    if (tier && VALID_TIERS.includes(tier as typeof VALID_TIERS[number])) {
      where.loyaltyTier = tier;
    }

    if (creditStatus && VALID_CREDIT_STATUSES.includes(creditStatus as typeof VALID_CREDIT_STATUSES[number])) {
      where.creditStatus = creditStatus;
    }

    const orderBy = buildSortParam(sort);

    // --- Fetch items, total, and tier stats in parallel ---
    const [customers, total, tierCounts] = await Promise.all([
      db.distributorCustomer.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.distributorCustomer.count({ where }),
      // Tier breakdown for ALL customers (not filtered), for the stats panel
      db.distributorCustomer.groupBy({
        by: ['loyaltyTier'],
        where: { distributorId: distId },
        _count: { loyaltyTier: true },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // Build byTier object
    const byTier: Record<string, number> = {
      BRONZE: 0,
      SILVER: 0,
      GOLD: 0,
      PLATINUM: 0,
    };
    for (const tc of tierCounts) {
      if (tc.loyaltyTier in byTier) {
        byTier[tc.loyaltyTier] = tc._count.loyaltyTier;
      }
    }

    // Sum totalSpend across all distributor customers (for stats)
    const allCustomersTotalSpend = await db.distributorCustomer.aggregate({
      where: { distributorId: distId },
      _sum: { totalSpend: true, totalOrders: true },
    });

    return NextResponse.json(
      successResponse(
        {
          items: customers,
          pagination: { page, limit, total, totalPages },
          stats: {
            total,
            byTier,
            totalSpend: allCustomersTotalSpend._sum.totalSpend || 0,
            totalOrders: allCustomersTotalSpend._sum.totalOrders || 0,
          },
        },
        { page, limit, total, totalPages },
      ),
    );
  } catch (error) {
    console.error('[DISTRIBUTOR CUSTOMERS LIST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

// ============================================================
// POST — Create a new customer
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
    const {
      name,
      phone,
      address,
      district,
      shopType,
      note,
      creditLimit,
      paymentTermsDays,
    } = body as {
      name?: string;
      phone?: string;
      address?: string;
      district?: string;
      shopType?: string;
      note?: string;
      creditLimit?: number;
      paymentTermsDays?: number;
    };

    // --- Validate required fields ---
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Tên khách hàng là bắt buộc.'), { status: 400 });
    }

    if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Số điện thoại là bắt buộc.'), { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (!isValidVNPhone(cleanPhone)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Số điện thoại không hợp lệ. Sử dụng định dạng 09xx/03xx/07xx/08xx/05xx.'),
        { status: 400 },
      );
    }

    // Validate optional fields
    if (shopType && !VALID_SHOP_TYPES.includes(shopType as typeof VALID_SHOP_TYPES[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Loại cửa hàng không hợp lệ. Chọn: ${VALID_SHOP_TYPES.join(', ')}.`),
        { status: 400 },
      );
    }

    if (creditLimit !== undefined && creditLimit !== null) {
      const cl = Number(creditLimit);
      if (!Number.isInteger(cl) || (cl !== 0 && cl < 100000)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Hạn mức công nợ phải là 0 (COD) hoặc lớn hơn 100.000 ₫.'),
          { status: 400 },
        );
      }
    }

    if (paymentTermsDays !== undefined && paymentTermsDays !== null) {
      const ptd = Number(paymentTermsDays);
      if (!Number.isInteger(ptd) || ptd < 0 || ptd > 90) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Số ngày công nợ phải từ 0 đến 90 ngày.'),
          { status: 400 },
        );
      }
    }

    // Sanitize string inputs
    const sanitizedName = sanitizeInput(name.trim());
    const sanitizedAddress = address ? sanitizeInput(address) : null;
    const sanitizedDistrict = district ? sanitizeInput(district) : null;
    const sanitizedNote = note ? sanitizeInput(note) : null;

    // --- Check phone uniqueness within distributor ---
    const existingPhone = await db.distributorCustomer.findUnique({
      where: { distributorId_phone: { distributorId: distId, phone: cleanPhone } },
      select: { id: true },
    });
    if (existingPhone) {
      return NextResponse.json(errorResponse('DUPLICATE_PHONE', 'Số điện thoại đã tồn tại trong danh sách khách hàng.'), { status: 409 });
    }

    // --- Auto-generate customer code: KH-{sequential number padded to 3} ---
    const lastCustomer = await db.distributorCustomer.findFirst({
      where: { distributorId: distId },
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1;
    if (lastCustomer) {
      const match = lastCustomer.code.match(/^KH-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const code = `KH-${String(nextNumber).padStart(3, '0')}`;

    // --- Create customer ---
    const customer = await db.distributorCustomer.create({
      data: {
        distributorId: distId,
        code,
        name: sanitizedName,
        phone: cleanPhone,
        address: sanitizedAddress,
        district: sanitizedDistrict,
        shopType: shopType || null,
        note: sanitizedNote,
        creditLimit: creditLimit !== undefined ? Number(creditLimit) : 0,
        creditBalance: 0,
        creditStatus: 'ACTIVE',
        paymentTermsDays: paymentTermsDays !== undefined ? Number(paymentTermsDays) : 0,
        loyaltyPoints: 0,
        loyaltyTier: 'BRONZE',
        totalSpend: 0,
        totalOrders: 0,
        isActive: true,
      },
    });

    return NextResponse.json(successResponse(customer), { status: 201 });
  } catch (error) {
    console.error('[DISTRIBUTOR CUSTOMERS CREATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

// ============================================================
// PUT — Update an existing customer
// ============================================================
export async function PUT(request: NextRequest) {
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
    const {
      id,
      name,
      phone,
      address,
      district,
      shopType,
      note,
      creditLimit,
      paymentTermsDays,
      creditStatus,
      loyaltyTier,
      isActive,
    } = body as {
      id?: string;
      name?: string;
      phone?: string;
      address?: string;
      district?: string;
      shopType?: string;
      note?: string;
      creditLimit?: number;
      paymentTermsDays?: number;
      creditStatus?: string;
      loyaltyTier?: string;
      isActive?: boolean;
    };

    // --- Validate id ---
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'ID khách hàng là bắt buộc.'), { status: 400 });
    }

    // --- Verify customer belongs to this distributor ---
    const existing = await db.distributorCustomer.findUnique({
      where: { id },
      select: { id: true, distributorId: true, phone: true },
    });
    if (!existing) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy khách hàng.'), { status: 404 });
    }
    if (existing.distributorId !== distId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Không có quyền chỉnh sửa khách hàng này.'), { status: 403 });
    }

    // --- Validate optional fields ---
    if (phone !== undefined && phone !== null) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!isValidVNPhone(cleanPhone)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Số điện thoại không hợp lệ. Sử dụng định dạng 09xx/03xx/07xx/08xx/05xx.'),
          { status: 400 },
        );
      }
      // Check uniqueness if phone changed
      if (cleanPhone !== existing.phone) {
        const dupPhone = await db.distributorCustomer.findUnique({
          where: { distributorId_phone: { distributorId: distId, phone: cleanPhone } },
          select: { id: true },
        });
        if (dupPhone) {
          return NextResponse.json(errorResponse('DUPLICATE_PHONE', 'Số điện thoại đã tồn tại trong danh sách khách hàng.'), { status: 409 });
        }
      }
    }

    if (shopType && !VALID_SHOP_TYPES.includes(shopType as typeof VALID_SHOP_TYPES[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Loại cửa hàng không hợp lệ. Chọn: ${VALID_SHOP_TYPES.join(', ')}.`),
        { status: 400 },
      );
    }

    if (creditLimit !== undefined && creditLimit !== null) {
      const cl = Number(creditLimit);
      if (!Number.isInteger(cl) || (cl !== 0 && cl < 100000)) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Hạn mức công nợ phải là 0 (COD) hoặc lớn hơn 100.000 ₫.'),
          { status: 400 },
        );
      }
    }

    if (paymentTermsDays !== undefined && paymentTermsDays !== null) {
      const ptd = Number(paymentTermsDays);
      if (!Number.isInteger(ptd) || ptd < 0 || ptd > 90) {
        return NextResponse.json(
          errorResponse('VALIDATION_ERROR', 'Số ngày công nợ phải từ 0 đến 90 ngày.'),
          { status: 400 },
        );
      }
    }

    if (creditStatus && !VALID_CREDIT_STATUSES.includes(creditStatus as typeof VALID_CREDIT_STATUSES[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Trạng thái công nợ không hợp lệ. Chọn: ${VALID_CREDIT_STATUSES.join(', ')}.`),
        { status: 400 },
      );
    }

    if (loyaltyTier && !VALID_TIERS.includes(loyaltyTier as typeof VALID_TIERS[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Hạng thành viên không hợp lệ. Chọn: ${VALID_TIERS.join(', ')}.`),
        { status: 400 },
      );
    }

    // --- Build update data (only include provided fields) ---
    const data: Prisma.DistributorCustomerUpdateInput = {};

    if (name !== undefined && name !== null) {
      data.name = sanitizeInput(name.trim());
    }
    if (phone !== undefined && phone !== null) {
      data.phone = phone.replace(/\D/g, '');
    }
    if (address !== undefined) {
      data.address = address ? sanitizeInput(address) : null;
    }
    if (district !== undefined) {
      data.district = district ? sanitizeInput(district) : null;
    }
    if (shopType !== undefined) {
      data.shopType = shopType || null;
    }
    if (note !== undefined) {
      data.note = note ? sanitizeInput(note) : null;
    }
    if (creditLimit !== undefined && creditLimit !== null) {
      data.creditLimit = Number(creditLimit);
    }
    if (paymentTermsDays !== undefined && paymentTermsDays !== null) {
      data.paymentTermsDays = Number(paymentTermsDays);
    }
    if (creditStatus) {
      data.creditStatus = creditStatus;
    }
    if (loyaltyTier) {
      data.loyaltyTier = loyaltyTier;
    }
    if (isActive !== undefined) {
      data.isActive = Boolean(isActive);
    }

    // --- Update customer ---
    const updated = await db.distributorCustomer.update({
      where: { id },
      data,
    });

    return NextResponse.json(successResponse(updated));
  } catch (error) {
    console.error('[DISTRIBUTOR CUSTOMERS UPDATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}