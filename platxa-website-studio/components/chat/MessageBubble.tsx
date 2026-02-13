"use client";

import { memo, useMemo } from "react";
import type { Message } from "ai";
import { User, Bot, FileCode } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { parseGeneratedFiles, extractTextContent } from "@/lib/ai/parser";
import { FileList } from "./FileList";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // Get message content as string (AI SDK v3 - content is always a string)
  const messageContent = message.content;

  // Parse files and text from assistant messages
  const { files, textContent } = useMemo(() => {
    if (isUser) {
      return { files: [], textContent: messageContent };
    }
    return {
      files: parseGeneratedFiles(messageContent),
      textContent: extractTextContent(messageContent),
    };
  }, [messageContent, isUser]);

  return (
    <div
      className={cn(
        "flex gap-3 message-enter",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          "flex flex-col gap-2 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Text content */}
        {textContent && (
          <div
            className={cn(
              "px-4 py-2 rounded-2xl text-sm",
              isUser
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            )}
          >
            <div className="whitespace-pre-wrap">{textContent}</div>
          </div>
        )}

        {/* Generated files */}
        {files.length > 0 && (
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileCode className="w-3 h-3" />
              <span>Generated {files.length} file(s)</span>
            </div>
            <FileList files={files} />
          </div>
        )}
      </div>
    </div>
  );
});
