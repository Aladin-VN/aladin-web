'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { ChatBubble, type ChatMessageData } from '@/components/mobile/chat-bubble';
import { ChatInputBar } from '@/components/mobile/chat-input-bar';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface QuickReply {
  vi: string;
  en: string;
}

// ============================================
// Constants
// ============================================

const QUICK_REPLIES: QuickReply[] = [
  { vi: 'Tình trạng đơn hàng', en: 'Order status' },
  { vi: 'Số dư công nợ', en: 'Credit balance' },
  { vi: 'Sản phẩm mới', en: 'New products' },
  { vi: 'Khuyến mãi', en: 'Promotions' },
];

const WELCOME_MESSAGE: ChatMessageData = {
  id: 'welcome',
  direction: 'SYSTEM',
  messageType: 'SYSTEM',
  content: '',
  createdAt: new Date().toISOString(),
};

// ============================================
// Chat Page
// ============================================

export default function MobileChatPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);

  // Fetch message history
  const fetchMessages = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    try {
      const res = await api.get<ChatMessageData[]>('/chat');
      if (res.success && res.data) {
        setMessages(res.data);
      }
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = useCallback(
    async (content: string) => {
      setIsSending(true);

      try {
        const res = await api.post<{ sent: ChatMessageData; reply: ChatMessageData }>('/chat', {
          content,
          messageType: 'TEXT',
        });

        if (res.success && res.data) {
          setMessages((prev) => [...prev, res.data!.sent, res.data!.reply]);
        }
      } catch {
        // silent fail
      } finally {
        setIsSending(false);
      }
    },
    []
  );

  // Handle quick reply
  const handleQuickReply = useCallback(
    (reply: QuickReply) => {
      const content = locale === 'vi' ? reply.vi : reply.en;
      handleSend(content);
    },
    [locale, handleSend]
  );

  // Determine welcome message content
  const welcomeContent = t(
    'Chào bạn! Tôi là trợ lý ALADIN. Tôi có thể giúp gì cho bạn?',
    'Hello! I\'m ALADIN assistant. How can I help?'
  );
  const displayWelcome = { ...WELCOME_MESSAGE, content: welcomeContent };
  const hasConversation = messages.length > 0;

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <MobileHeader
        title={t('Hỗ trợ ALADIN', 'ALADIN Support')}
        showBack
        showNotifications={false}
        rightAction={
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('Trực tuyến', 'Online')}
          </div>
        }
      />

      {/* Quick reply chips */}
      <div className="px-4 py-2 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {QUICK_REPLIES.map((reply, idx) => {
            const label = locale === 'vi' ? reply.vi : reply.en;
            return (
              <button
                key={idx}
                onClick={() => handleQuickReply(reply)}
                disabled={isSending}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  'bg-primary/5 text-primary border-primary/20 hover:bg-primary/10 active:scale-95',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          // Loading skeleton
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('flex gap-2 max-w-[75%]', i % 2 === 1 ? 'mr-auto' : 'ml-auto flex-row-reverse')}>
                <Skeleton className="h-16 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : hasConversation ? (
          // Message list
          <>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} locale={locale} />
            ))}
            {isSending && (
              <div className="flex gap-2 mb-3 max-w-[85%] mr-auto">
                <div className="rounded-2xl rounded-tr-sm bg-muted px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          // Empty state with welcome
          <div className="flex flex-col items-center justify-center h-full -mt-10">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-primary" />
            </div>
            <ChatBubble message={displayWelcome} locale={locale} />
            <p className="text-xs text-muted-foreground mt-4">
              {t('Bắt đầu trò chuyện', 'Start a conversation')}
            </p>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <ChatInputBar
        onSend={handleSend}
        disabled={isSending}
        placeholder={t('Nhập tin nhắn...', 'Type a message...')}
      />
    </div>
  );
}
