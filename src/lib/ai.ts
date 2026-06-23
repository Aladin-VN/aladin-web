// ALADIN AI Utility Module
// Wraps OpenAI-compatible API calls with mock fallback for Vietnamese text

const API_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface AiChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

/**
 * Call OpenAI-compatible chat completions API.
 * Falls back to mock responses when no API key is configured.
 */
export async function aiChat(
  systemPrompt: string,
  userMessage: string,
  options: AiChatOptions = {}
): Promise<string> {
  const { temperature = 0.3, maxTokens = 1024, timeoutMs = 15000 } = options;

  // Mock mode when no API key
  if (!API_KEY) {
    return mockChatResponse(systemPrompt, userMessage);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`[AI] API error ${res.status}: ${errText}`);
      return mockChatResponse(systemPrompt, userMessage);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[AI] Empty response from API');
      return mockChatResponse(systemPrompt, userMessage);
    }
    return content;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error('[AI] Request timed out');
    } else {
      console.error('[AI] Request failed:', err);
    }
    return mockChatResponse(systemPrompt, userMessage);
  }
}

/**
 * Call AI and parse JSON from the response.
 * Handles common cases: raw JSON, markdown code blocks, leading/trailing text.
 */
export async function aiJson<T = unknown>(
  systemPrompt: string,
  userMessage: string,
  options: AiChatOptions = {}
): Promise<T> {
  const text = await aiChat(systemPrompt, userMessage, options);

  try {
    // Try direct JSON parse first
    return JSON.parse(text) as T;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim()) as T;
      } catch {
        // fall through
      }
    }

    // Try finding JSON object/array in the text
    const objectMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (objectMatch?.[1]) {
      try {
        return JSON.parse(objectMatch[1]) as T;
      } catch {
        // fall through
      }
    }

    console.error('[AI] Could not parse JSON from response:', text.substring(0, 200));
    throw new Error('AI response could not be parsed as JSON');
  }
}

/**
 * Check if AI is available (has API key configured)
 */
export function isAiAvailable(): boolean {
  return !!API_KEY;
}

// ============================================
// MOCK RESPONSES
// ============================================

function mockChatResponse(systemPrompt: string, userMessage: string): string {
  // Detect order parsing requests
  if (
    systemPrompt.includes('parse') && systemPrompt.includes('order') ||
    userMessage.toLowerCase().includes('thùng') ||
    userMessage.toLowerCase().includes('chai') ||
    userMessage.toLowerCase().includes('bao') ||
    userMessage.toLowerCase().includes('gói') ||
    userMessage.toLowerCase().includes('muốn')
  ) {
    return JSON.stringify([
      { productName: 'Bia Heineken', quantity: 5, unit: 'thùng' },
      { productName: 'Nước mắm Nam Ngư', quantity: 10, unit: 'chai' },
    ]);
  }

  // Detect forecast requests
  if (systemPrompt.includes('forecast') || systemPrompt.includes('dự đoán')) {
    const today = new Date();
    const forecast = [];
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      forecast.push({
        date: d.toISOString().split('T')[0],
        predictedDemand: Math.floor(Math.random() * 50 + 20),
        confidence: 0.7 + Math.random() * 0.25,
      });
    }
    return JSON.stringify(forecast);
  }

  // Detect recommendation requests
  if (systemPrompt.includes('recommend') || systemPrompt.includes('gợi ý')) {
    return JSON.stringify([
      { reason: 'Bán chạy, tồn kho thấp', score: 0.92 },
      { reason: 'Xu hướng mùa hè tăng', score: 0.85 },
      { reason: 'Thường mua cùng nhau', score: 0.78 },
    ]);
  }

  // Default mock
  return 'Xin chào! Tôi là trợ lý AI Aladin. Hiện tại tôi đang ở chế độ demo. Vui lòng cấu hình API key để sử dụng đầy đủ tính năng AI.';
}