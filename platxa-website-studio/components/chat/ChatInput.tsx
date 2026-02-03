"use client";

import { useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  placeholder = "Type a message...",
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading && !disabled) {
        onSubmit(e as unknown as FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="relative">
      <div className="flex items-end gap-2 p-2 border rounded-xl bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isLoading}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent px-2 py-1.5 text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "min-h-[36px] max-h-[200px]"
          )}
        />
        <Button
          type="submit"
          size="icon"
          data-testid="chat-send"
          disabled={!value.trim() || isLoading || disabled}
          className="flex-shrink-0 h-9 w-9"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground text-center">
        Press Enter to send, Shift+Enter for new line
      </p>
    </form>
  );
}
