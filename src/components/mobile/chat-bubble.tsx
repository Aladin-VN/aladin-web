'use client';

import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface ChatMessageData {
  id: string;
  direction: string;
  messageType: string;
  content: string;
  imageUrl?: string | null;
  metadata?: string | null;
  createdAt: string;
}

interface ChatBubbleProps {
  message: ChatMessageData;
  locale: string;
}

// ============================================
// Relative time formatter (Vietnamese)
// ============================================

function formatRelativeTime(dateStr: string, locale: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (locale === 'vi') {
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    if (diffHour < 24) return `${diffHour} giờ trước`;
    if (diffDay < 7) return `${diffDay} ngày trước`;
    return new Date(dateStr).toLocaleDateString('vi-VN');
  }

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US');
}

// ============================================
// Get localized content from message
// ============================================

function getMessageContent(message: ChatMessageData, locale: string): string {
  if (locale === 'en' && message.metadata) {
    try {
      const meta = JSON.parse(message.metadata);
      if (meta.contentEn) return meta.contentEn;
    } catch {
      // ignore parse errors
    }
  }
  return message.content;
}

// ============================================
// Chat Bubble Component
// ============================================

export function ChatBubble({ message, locale }: ChatBubbleProps) {
  const { direction, messageType, createdAt } = message;
  const content = getMessageContent(message, locale);

  // System message
  if (messageType === 'SYSTEM' || direction === 'SYSTEM') {
    return (
      <div className="flex justify-center py-2">
        <span className="text-[11px] text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
          {content}
        </span>
      </div>
    );
  }

  const isOutgoing = direction === 'OUTGOING';
  const time = formatRelativeTime(createdAt, locale);

  return (
    <div
      className={cn('flex gap-2 mb-3 max-w-[85%]', isOutgoing ? 'ml-auto flex-row-reverse' : 'mr-auto')}
    >
      <div
        className={cn(
          'rounded-2xl px-3.5 py-2.5 shadow-sm',
          isOutgoing
            ? 'bg-primary text-primary-foreground rounded-tl-sm'
            : 'bg-muted text-foreground rounded-tr-sm'
        )}
      >
        {/* Image attachment */}
        {message.imageUrl && (
          <div className="mb-2 -mx-1 -mt-1">
            <img
              src={message.imageUrl}
              alt=""
              className="rounded-xl max-w-[200px] max-h-[200px] object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Quick reply type */}
        {messageType === 'QUICK_REPLY' && (
          <div className={cn(
            'text-[10px] font-medium uppercase tracking-wider mb-1 opacity-60',
            isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}>
            {locale === 'vi' ? 'Trả lời nhanh' : 'Quick Reply'}
          </div>
        )}

        {/* Message text */}
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>

        {/* Timestamp */}
        <p
          className={cn(
            'text-[10px] mt-1 text-right opacity-50',
            isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
          )}
        >
          {time}
        </p>
      </div>
    </div>
  );
}
