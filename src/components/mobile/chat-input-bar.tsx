'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface ChatInputBarProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

// ============================================
// Chat Input Bar Component
// ============================================

export function ChatInputBar({ onSend, disabled = false, placeholder }: ChatInputBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="sticky bottom-0 z-10 bg-background border-t px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2 max-w-lg mx-auto">
        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-normal',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'max-h-[120px] overflow-y-auto'
          )}
        />

        {/* Send button */}
        <Button
          size="icon"
          className="h-10 w-10 rounded-xl shrink-0"
          disabled={!canSend}
          onClick={handleSend}
          aria-label="Send message"
        >
          <SendHorizontal className="h-4.5 w-4.5" />
        </Button>
      </div>
    </div>
  );
}
