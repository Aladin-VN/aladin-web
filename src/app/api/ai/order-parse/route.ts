// POST /api/ai/order-parse — Parse Vietnamese text into structured order
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/get-auth-user';
import { successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

// Simple Vietnamese NLP: extract product name + quantity patterns
function parseVietnameseOrder(text: string): { name: string; quantity: number }[] {
  const results: { name: string; quantity: number }[] = [];
  // Pattern: number + unit + product name
  const patterns = [
    /(\d+)\s*(thùng|chai|lon|kg|gói|hộp|bịch|cái|quả|vỉ|chục)\s+([\w\sàảáàạâầấậêềếệôồốộơờớợứừựỳýỹ]+)/gi,
    /([\w\sàảáàạâầấậêềếệôồốộơờớợứừựỳýỹ]+?)\s*(\d+)\s*(thùng|chai|lon|kg|gói|hộp|bịch|cái)/gi,
  ];
  
  for (const p of patterns) {
    const matches = text.matchAll(new RegExp(p.source, 'gi'));
    for (const m of matches) {
      if (p === patterns[0]) {
        results.push({ name: m[3].trim(), quantity: parseInt(m[1]) });
      } else {
        results.push({ name: m[1].trim(), quantity: parseInt(m[3]) });
      }
    }
  }
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    const { text } = await request.json() as { text: string };
    if (!text?.trim()) return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Chưa nhập nội dung.'), { status: 400 });

    // Parse the Vietnamese text
    const parsed = parseVietnameseOrder(text);
    
    // Match to actual products in DB
    const matchedItems = [];
    for (const item of parsed) {
      const products = await db.product.findMany({
        where: {
          OR: [
            { name: { contains: item.name, mode: 'insensitive' } },
            { name: { contains: item.name.replace(/\s+/g, '%'), mode: 'insensitive' } },
          ],
          isActive: true,
        },
        select: { id: true, name: true, sku: true, basePrice: true, unit: true },
        take: 1,
      });
      if (products.length > 0) {
        const p = products[0];
        matchedItems.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          quantity: item.quantity,
          unitPrice: p.basePrice,
          subtotal: p.basePrice * item.quantity,
          confidence: 0.85,
        });
      } else {
        matchedItems.push({
          productId: null,
          productName: item.name,
          sku: '',
          quantity: item.quantity,
          unitPrice: 0,
          subtotal: 0,
          confidence: 0.3,
        });
      }
    }

    return NextResponse.json(successResponse({
      parsed: matchedItems,
      confidence: matchedItems.length > 0 ? matchedItems.reduce((s, i) => s + i.confidence, 0) / matchedItems.length : 0,
      originalText: text,
    }));
  } catch (error) {
    console.error('[AI ORDER PARSE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi.'), { status: 500 });
  }
}