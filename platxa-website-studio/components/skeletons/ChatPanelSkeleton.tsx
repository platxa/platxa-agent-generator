"use client";

import { Skeleton, SkeletonText, SkeletonAvatar } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/**
 * Chat message skeleton
 */
function ChatMessageSkeleton({
  isUser = false,
  className,
}: {
  isUser?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isUser && "flex-row-reverse",
        className
      )}
    >
      <SkeletonAvatar size="sm" />
      <div className={cn("flex-1 space-y-2", isUser && "text-right")}>
        <Skeleton className={cn("h-3 w-20", isUser && "ml-auto")} />
        <div
          className={cn(
            "rounded-lg p-3 space-y-2",
            isUser ? "bg-primary/10 ml-auto max-w-[80%]" : "bg-muted max-w-[80%]"
          )}
        >
          <SkeletonText lines={isUser ? 1 : 3} />
        </div>
      </div>
    </div>
  );
}

/**
 * Chat panel loading skeleton
 */
export function ChatPanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden p-2 space-y-2">
        <ChatMessageSkeleton isUser={false} />
        <ChatMessageSkeleton isUser={true} />
        <ChatMessageSkeleton isUser={false} />
        <ChatMessageSkeleton isUser={true} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    </div>
  );
}

export default ChatPanelSkeleton;
