"use client";

/**
 * MessageQueue
 *
 * UI for managing pending AI requests with support for
 * reordering, pausing, and cancelling queued messages.
 *
 * Feature #94: UI Enhancements - Message queue UI
 */

import { useState, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  GripVertical,
  Play,
  Pause,
  X,
  Clock,
  Loader2,
  ChevronUp,
  ChevronDown,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  ListOrdered,
  Zap,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export type QueueItemStatus =
  | "pending"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type QueueItemPriority = "low" | "normal" | "high" | "urgent";

export interface QueueItem {
  /** Unique item ID */
  id: string;
  /** Message content/prompt */
  message: string;
  /** Item status */
  status: QueueItemStatus;
  /** Priority level */
  priority: QueueItemPriority;
  /** Created timestamp */
  createdAt: Date;
  /** Started processing timestamp */
  startedAt?: Date;
  /** Completed timestamp */
  completedAt?: Date;
  /** Estimated processing time in ms */
  estimatedTime?: number;
  /** Actual processing time in ms */
  actualTime?: number;
  /** Error message if failed */
  error?: string;
  /** Retry count */
  retries: number;
  /** Maximum retries */
  maxRetries: number;
  /** Associated context/file */
  context?: string;
  /** User who created the request */
  createdBy?: {
    id: string;
    name: string;
  };
}

export interface MessageQueueProps {
  /** Queue items */
  items: QueueItem[];
  /** Whether queue is paused globally */
  isPaused: boolean;
  /** Current processing item ID */
  processingId?: string;
  /** Callback to reorder items */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** Callback to pause/resume queue */
  onTogglePause: () => void;
  /** Callback to pause/resume single item */
  onToggleItemPause: (id: string) => void;
  /** Callback to cancel item */
  onCancel: (id: string) => void;
  /** Callback to retry item */
  onRetry: (id: string) => void;
  /** Callback to remove item */
  onRemove: (id: string) => void;
  /** Callback to clear completed */
  onClearCompleted: () => void;
  /** Callback to clear all */
  onClearAll: () => void;
  /** Callback to change priority */
  onChangePriority: (id: string, priority: QueueItemPriority) => void;
  /** Compact mode */
  compact?: boolean;
  /** Show estimated times */
  showEstimates?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<
  QueueItemStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  pending: { icon: Clock, color: "text-gray-500", label: "Pending" },
  processing: { icon: Loader2, color: "text-blue-500", label: "Processing" },
  paused: { icon: Pause, color: "text-yellow-500", label: "Paused" },
  completed: { icon: CheckCircle2, color: "text-green-500", label: "Completed" },
  failed: { icon: AlertCircle, color: "text-red-500", label: "Failed" },
  cancelled: { icon: X, color: "text-gray-400", label: "Cancelled" },
};

const PRIORITY_CONFIG: Record<
  QueueItemPriority,
  { color: string; bgColor: string; label: string }
> = {
  low: { color: "text-gray-500", bgColor: "bg-gray-100 dark:bg-gray-800", label: "Low" },
  normal: { color: "text-blue-500", bgColor: "bg-blue-100 dark:bg-blue-900/30", label: "Normal" },
  high: { color: "text-orange-500", bgColor: "bg-orange-100 dark:bg-orange-900/30", label: "High" },
  urgent: { color: "text-red-500", bgColor: "bg-red-100 dark:bg-red-900/30", label: "Urgent" },
};

// =============================================================================
// Component
// =============================================================================

export function MessageQueue({
  items,
  isPaused,
  processingId,
  onReorder,
  onTogglePause,
  onToggleItemPause,
  onCancel,
  onRetry,
  onRemove,
  onClearCompleted,
  onClearAll,
  onChangePriority,
  compact = false,
  showEstimates = true,
  className,
}: MessageQueueProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Categorize items
  const { pending, processing, completed, failed } = useMemo(() => {
    const pending = items.filter((i) => i.status === "pending" || i.status === "paused");
    const processing = items.filter((i) => i.status === "processing");
    const completed = items.filter((i) => i.status === "completed");
    const failed = items.filter((i) => i.status === "failed" || i.status === "cancelled");
    return { pending, processing, completed, failed };
  }, [items]);

  // Stats
  const stats = useMemo(() => ({
    total: items.length,
    pending: pending.length,
    processing: processing.length,
    completed: completed.length,
    failed: failed.length,
    estimatedTotal: pending.reduce((acc, i) => acc + (i.estimatedTime || 0), 0),
  }), [items, pending, processing, completed, failed]);

  // Drag handlers
  const handleDragStart = useCallback((index: number) => {
    setDraggedIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onReorder(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, onReorder]);

  // Move item up/down
  const moveItem = useCallback((index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < pending.length) {
      onReorder(index, newIndex);
    }
  }, [pending.length, onReorder]);

  return (
    <div className={cn("flex flex-col bg-background border rounded-lg", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">Message Queue</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{stats.pending} pending</span>
            {stats.processing > 0 && (
              <span className="text-blue-500">{stats.processing} processing</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Global pause/play */}
          <button
            onClick={onTogglePause}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors",
              isPaused
                ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400"
            )}
          >
            {isPaused ? (
              <>
                <Play className="w-3 h-3" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                Pause
              </>
            )}
          </button>

          {/* Clear menu */}
          <div className="relative group">
            <button className="p-1.5 rounded hover:bg-muted text-muted-foreground">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 hidden group-hover:block z-50 min-w-[140px]">
              <button
                onClick={onClearCompleted}
                disabled={completed.length === 0}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                Clear completed
              </button>
              <button
                onClick={onClearAll}
                disabled={items.length === 0}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:bg-muted disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Queue content */}
      <div className="flex-1 overflow-y-auto max-h-[400px]">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y">
            {/* Processing items */}
            {processing.map((item) => (
              <QueueItemRow
                key={item.id}
                item={item}
                isProcessing
                compact={compact}
                showEstimates={showEstimates}
                onCancel={() => onCancel(item.id)}
              />
            ))}

            {/* Pending items (draggable) */}
            {pending.map((item, index) => (
              <QueueItemRow
                key={item.id}
                item={item}
                index={index}
                totalPending={pending.length}
                compact={compact}
                showEstimates={showEstimates}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onMoveUp={() => moveItem(index, "up")}
                onMoveDown={() => moveItem(index, "down")}
                onTogglePause={() => onToggleItemPause(item.id)}
                onCancel={() => onCancel(item.id)}
                onChangePriority={(p) => onChangePriority(item.id, p)}
              />
            ))}

            {/* Failed items */}
            {failed.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                  Failed ({failed.length})
                </div>
                {failed.map((item) => (
                  <QueueItemRow
                    key={item.id}
                    item={item}
                    compact={compact}
                    showEstimates={false}
                    onRetry={() => onRetry(item.id)}
                    onRemove={() => onRemove(item.id)}
                  />
                ))}
              </>
            )}

            {/* Completed items (collapsed) */}
            {completed.length > 0 && (
              <CompletedSection
                items={completed}
                compact={compact}
                onRemove={onRemove}
              />
            )}
          </div>
        )}
      </div>

      {/* Footer with estimates */}
      {showEstimates && stats.estimatedTotal > 0 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <span>Estimated time remaining</span>
          <span className="font-medium">{formatDuration(stats.estimatedTotal)}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Queue Item Row
// =============================================================================

interface QueueItemRowProps {
  item: QueueItem;
  index?: number;
  totalPending?: number;
  isProcessing?: boolean;
  compact?: boolean;
  showEstimates?: boolean;
  isDragging?: boolean;
  isDragOver?: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onTogglePause?: () => void;
  onCancel?: () => void;
  onRetry?: () => void;
  onRemove?: () => void;
  onChangePriority?: (priority: QueueItemPriority) => void;
}

function QueueItemRow({
  item,
  index,
  totalPending,
  isProcessing,
  compact,
  showEstimates,
  isDragging,
  isDragOver,
  draggable,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onTogglePause,
  onCancel,
  onRetry,
  onRemove,
  onChangePriority,
}: QueueItemRowProps) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const statusConfig = STATUS_CONFIG[item.status];
  const priorityConfig = PRIORITY_CONFIG[item.priority];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors",
        isDragging && "opacity-50 bg-muted",
        isDragOver && "bg-primary/10 border-t-2 border-primary",
        isProcessing && "bg-blue-50 dark:bg-blue-900/10"
      )}
    >
      {/* Drag handle */}
      {draggable && (
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="w-4 h-4" />
        </div>
      )}

      {/* Status icon */}
      <div className={cn("flex-shrink-0", statusConfig.color)}>
        <StatusIcon
          className={cn("w-4 h-4", isProcessing && "animate-spin")}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={cn("text-sm truncate", compact ? "max-w-[200px]" : "max-w-[300px]")}>
            {item.message}
          </p>
          {/* Priority badge */}
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium",
              priorityConfig.bgColor,
              priorityConfig.color
            )}
          >
            {priorityConfig.label}
          </span>
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{formatRelativeTime(item.createdAt)}</span>
          {showEstimates && item.estimatedTime && (
            <span>~{formatDuration(item.estimatedTime)}</span>
          )}
          {item.context && <span className="truncate max-w-[100px]">{item.context}</span>}
          {item.error && (
            <span className="text-red-500 truncate max-w-[150px]">{item.error}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {/* Reorder buttons */}
        {draggable && index !== undefined && totalPending !== undefined && (
          <div className="flex flex-col">
            <button
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={index === totalPending - 1}
              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Priority menu */}
        {onChangePriority && (
          <div className="relative">
            <button
              onClick={() => setShowPriorityMenu(!showPriorityMenu)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground"
              title="Change priority"
            >
              <Zap className="w-3.5 h-3.5" />
            </button>
            {showPriorityMenu && (
              <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-50">
                {(Object.keys(PRIORITY_CONFIG) as QueueItemPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      onChangePriority(p);
                      setShowPriorityMenu(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted",
                      item.priority === p && "bg-muted"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", PRIORITY_CONFIG[p].bgColor)} />
                    {PRIORITY_CONFIG[p].label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pause/resume */}
        {onTogglePause && (
          <button
            onClick={onTogglePause}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            title={item.status === "paused" ? "Resume" : "Pause"}
          >
            {item.status === "paused" ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Retry */}
        {onRetry && (
          <button
            onClick={onRetry}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            title="Retry"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Cancel */}
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1.5 rounded hover:bg-muted text-red-500"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Remove */}
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-red-500"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Completed Section
// =============================================================================

interface CompletedSectionProps {
  items: QueueItem[];
  compact?: boolean;
  onRemove: (id: string) => void;
}

function CompletedSection({ items, compact, onRemove }: CompletedSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30 hover:bg-muted/50"
      >
        <span>Completed ({items.length})</span>
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {isExpanded && (
        <div className="divide-y opacity-60">
          {items.slice(0, 10).map((item) => (
            <QueueItemRow
              key={item.id}
              item={item}
              compact={compact}
              showEstimates={false}
              onRemove={() => onRemove(item.id)}
            />
          ))}
          {items.length > 10 && (
            <div className="px-4 py-2 text-xs text-muted-foreground text-center">
              +{items.length - 10} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ListOrdered className="w-10 h-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">No messages in queue</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        New AI requests will appear here
      </p>
    </div>
  );
}

// =============================================================================
// Hook for Queue Management
// =============================================================================

export interface UseMessageQueueOptions {
  maxConcurrent?: number;
  defaultPriority?: QueueItemPriority;
  autoRetry?: boolean;
  maxRetries?: number;
}

export function useMessageQueue(options: UseMessageQueueOptions = {}) {
  const {
    maxConcurrent = 1,
    defaultPriority = "normal",
    autoRetry = true,
    maxRetries = 3,
  } = options;

  const [items, setItems] = useState<QueueItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  // Add item to queue
  const enqueue = useCallback(
    (message: string, opts?: Partial<QueueItem>): QueueItem => {
      const item: QueueItem = {
        id: `queue-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        message,
        status: "pending",
        priority: opts?.priority || defaultPriority,
        createdAt: new Date(),
        retries: 0,
        maxRetries,
        ...opts,
      };

      setItems((prev) => {
        // Insert based on priority
        const insertIndex = prev.findIndex(
          (i) =>
            i.status === "pending" &&
            getPriorityValue(i.priority) < getPriorityValue(item.priority)
        );
        if (insertIndex === -1) {
          return [...prev, item];
        }
        const next = [...prev];
        next.splice(insertIndex, 0, item);
        return next;
      });

      return item;
    },
    [defaultPriority, maxRetries]
  );

  // Reorder items
  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setItems((prev) => {
      const pendingItems = prev.filter((i) => i.status === "pending" || i.status === "paused");
      const otherItems = prev.filter((i) => i.status !== "pending" && i.status !== "paused");

      const [moved] = pendingItems.splice(fromIndex, 1);
      pendingItems.splice(toIndex, 0, moved);

      return [...otherItems.filter((i) => i.status === "processing"), ...pendingItems, ...otherItems.filter((i) => i.status !== "processing")];
    });
  }, []);

  // Toggle global pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Toggle item pause
  const toggleItemPause = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: item.status === "paused" ? "pending" : "paused" }
          : item
      )
    );
  }, []);

  // Cancel item
  const cancel = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "cancelled" } : item
      )
    );
  }, []);

  // Retry item
  const retry = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: "pending", retries: item.retries + 1, error: undefined }
          : item
      )
    );
  }, []);

  // Remove item
  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear completed
  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((item) => item.status !== "completed"));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  // Change priority
  const changePriority = useCallback((id: string, priority: QueueItemPriority) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, priority } : item
      )
    );
  }, []);

  // Get next item to process
  const getNext = useCallback((): QueueItem | null => {
    if (isPaused) return null;

    const processing = items.filter((i) => i.status === "processing");
    if (processing.length >= maxConcurrent) return null;

    return items.find((i) => i.status === "pending") || null;
  }, [items, isPaused, maxConcurrent]);

  // Mark item as processing
  const markProcessing = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: "processing", startedAt: new Date() }
          : item
      )
    );
  }, []);

  // Mark item as completed
  const markCompleted = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const completedAt = new Date();
        return {
          ...item,
          status: "completed",
          completedAt,
          actualTime: item.startedAt
            ? completedAt.getTime() - item.startedAt.getTime()
            : undefined,
        };
      })
    );
  }, []);

  // Mark item as failed
  const markFailed = useCallback((id: string, error: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        // Auto retry
        if (autoRetry && item.retries < item.maxRetries) {
          return { ...item, status: "pending", retries: item.retries + 1, error };
        }

        return { ...item, status: "failed", error };
      })
    );
  }, [autoRetry]);

  return {
    items,
    isPaused,
    enqueue,
    reorder,
    togglePause,
    toggleItemPause,
    cancel,
    retry,
    remove,
    clearCompleted,
    clearAll,
    changePriority,
    getNext,
    markProcessing,
    markCompleted,
    markFailed,
  };
}

// =============================================================================
// Utilities
// =============================================================================

function getPriorityValue(priority: QueueItemPriority): number {
  const values: Record<QueueItemPriority, number> = {
    low: 0,
    normal: 1,
    high: 2,
    urgent: 3,
  };
  return values[priority];
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return date.toLocaleTimeString();
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (seconds < 60) return `${seconds}s`;
  return `${minutes}m ${seconds % 60}s`;
}

// =============================================================================
// Export
// =============================================================================

export default MessageQueue;
