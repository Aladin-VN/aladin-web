// ALADIN Chat API
// GET /api/chat — Fetch message history for authenticated user
// POST /api/chat — Send a message and receive bot response

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, sanitizeInput } from '@/lib/security';
import { db } from '@/lib/db';

// ============================================
// Bot response engine
// ============================================

interface BotResponse {
  vi: string;
  en: string;
}

function generateBotResponse(content: string): BotResponse {
  const lower = content.toLowerCase();

  if (lower.includes('đơn') || lower.includes('order')) {
    return {
      vi: 'Để kiểm tra tình trạng đơn hàng, bạn có thể vào mục "Đơn hàng" trên ứng dụng. Đơn hàng gần nhất sẽ hiển thị ở đầu danh sách. Bạn cần hỗ trợ thêm gì không?',
      en: 'To check your order status, go to the "Orders" section in the app. Your most recent order will appear at the top. Is there anything else I can help with?',
    };
  }

  if (lower.includes('công nợ') || lower.includes('credit') || lower.includes('thanh toán') || lower.includes('payment')) {
    return {
      vi: 'Thông tin công nợ của bạn được hiển thị trong mục "Công nợ". Bạn có thể xem số dư, lịch sử giao dịch và thực hiện thanh toán trực tiếp. Hạn mức công nợ sẽ được tăng dần theo lịch sử mua hàng.',
      en: 'Your credit information is available in the "Credit" section. You can view your balance, transaction history, and make payments directly. Your credit limit increases over time with good purchase history.',
    };
  }

  if (lower.includes('sản phẩm') || lower.includes('product') || lower.includes('hàng hóa')) {
    return {
      vi: 'Chúng tôi có hơn 500 sản phẩm từ các thương hiệu uy tín. Bạn có thể tìm kiếm sản phẩm theo danh mục, tên hoặc mã SKU. Đặt hàng tối thiểu từ 1 đơn vị với giá sỉ tốt nhất!',
      en: 'We have over 500 products from trusted brands. You can search by category, name, or SKU. Minimum order is just 1 unit with the best wholesale prices!',
    };
  }

  if (lower.includes('khuyến mãi') || lower.includes('promotion') || lower.includes('giảm giá') || lower.includes('discount')) {
    return {
      vi: 'Các chương trình khuyến mãi đang diễn ra được cập nhật thường xuyên trong mục "Khuyến mãi". Đừng bỏ lỡ các deal mua chung để tiết kiệm thêm 10-30%!',
      en: 'Current promotions are updated regularly in the "Promotions" section. Don\'t miss group buy deals for additional 10-30% savings!',
    };
  }

  if (lower.includes('giao hàng') || lower.includes('delivery') || lower.includes('vận chuyển') || lower.includes('ship')) {
    return {
      vi: 'Đơn hàng thường được giao trong 1-2 ngày làm việc. Bạn có thể theo dõi tiến độ giao hàng trong mục "Vận chuyển". Phí giao hàng miễn phí cho đơn từ 500.000₫!',
      en: 'Orders are typically delivered within 1-2 business days. Track your delivery status in the "Shipments" section. Free delivery on orders over 500,000₫!',
    };
  }

  if (lower.includes('xin chào') || lower.includes('hello') || lower.includes('hi') || lower.includes('chào')) {
    return {
      vi: 'Xin chào! Rất vui được hỗ trợ bạn. Tôi có thể giúp bạn về đơn hàng, công nợ, sản phẩm, khuyến mãi hoặc bất kỳ vấn đề nào khác.',
      en: 'Hello! Happy to assist you. I can help with orders, credit, products, promotions, or any other questions you may have.',
    };
  }

  return {
    vi: 'Cảm ơn bạn đã liên hệ! Đội ngũ hỗ trợ ALADIN luôn sẵn sàng. Bạn có thể hỏi tôi về đơn hàng, công nợ, sản phẩm, khuyến mãi, hoặc giao hàng.',
    en: 'Thank you for reaching out! The ALADIN support team is always ready to help. You can ask me about orders, credit, products, promotions, or delivery.',
  };
}

// ============================================
// GET /api/chat — Fetch message history
// ============================================

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const userId = payload.userId;
    const conversationId = `conv-${userId}`;

    const messages = await db.chatMessage.findMany({
      where: { userId, conversationId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Mark all INCOMING messages as read
    if (messages.length > 0) {
      await db.chatMessage.updateMany({
        where: {
          userId,
          conversationId,
          direction: 'INCOMING',
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    return NextResponse.json(successResponse(messages));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch messages';
    console.error('[CHAT GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}

// ============================================
// POST /api/chat — Send a message
// ============================================

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const body = await request.json();
    const { content, messageType } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Message content is required'),
        { status: 400 }
      );
    }

    const userId = payload.userId;
    const conversationId = `conv-${userId}`;
    const sanitizedContent = sanitizeInput(content.trim());
    const type = messageType || 'TEXT';

    // Create OUTGOING message
    const outgoingMsg = await db.chatMessage.create({
      data: {
        userId,
        conversationId,
        direction: 'OUTGOING',
        messageType: type,
        content: sanitizedContent,
        isRead: true,
      },
    });

    // Generate bot response after 500ms delay
    const botResponse = generateBotResponse(sanitizedContent);

    const incomingMsg = await db.chatMessage.create({
      data: {
        userId,
        conversationId,
        direction: 'INCOMING',
        messageType: 'TEXT',
        content: botResponse.vi,
        metadata: JSON.stringify({ contentEn: botResponse.en }),
        isRead: false,
      },
    });

    return NextResponse.json(
      successResponse({
        sent: outgoingMsg,
        reply: incomingMsg,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send message';
    console.error('[CHAT POST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', message), { status: 500 });
  }
}
