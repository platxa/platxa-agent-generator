"use client";

/**
 * ActivityFeed
 *
 * Displays recent team activity including edits, commits, comments,
 * and other collaborative actions with timestamps.
 *
 * Feature #75: Collaboration - ActivityFeed component
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  FileEdit,
  GitCommit,
  MessageSquare,
  Users,
  Eye,
  Plus,
  Trash2,
  Settings,
  Upload,
  Download,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Clock,
  Filter,
  ChevronDown,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export type ActivityType =
  | "edit"
  | "commit"
  | "comment"
  | "join"
  | "leave"
  | "view"
  | "create"
  | "delete"
  | "settings"
  | "upload"
  | "download"
  | "sync"
  | "approve"
  | "reject"
  | "mention";

export interface ActivityItem {
  /** Unique activity ID */
  id: string;
  /** Type of activity */
  type: ActivityType;
  /** User who performed the action */
  user: {
    id: string;
    name: string;
    avatar?: string;
    color: string;
    isAi?: boolean;
  };
  /** Activity description */
  description: string;
  /** Target resource (file, comment, etc.) */
  target?: {
    type: "file" | "comment" | "commit" | "user" | "project" | "workspace";
    id: string;
    name: string;
    path?: string;
  };
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
  /** Whether user has seen this activity */
  seen?: boolean;
}

export interface ActivityFeedProps {
  /** List of activities to display */
  activities: ActivityItem[];
  /** Maximum number of activities to show */
  maxItems?: number;
  /** Filter by activity types */
  filterTypes?: ActivityType[];
  /** Filter by user IDs */
  filterUsers?: string[];
  /** Show filter controls */
  showFilters?: boolean;
  /** Show relative timestamps */
  relativeTime?: boolean;
  /** Compact display mode */
  compact?: boolean;
  /** Group activities by date */
  groupByDate?: boolean;
  /** Callback when activity is clicked */
  onActivityClick?: (activity: ActivityItem) => void;
  /** Callback to load more activities */
  onLoadMore?: () => void;
  /** Whether more activities are available */
  hasMore?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const ACTIVITY_ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  edit: FileEdit,
  commit: GitCommit,
  comment: MessageSquare,
  join: Users,
  leave: Users,
  view: Eye,
  create: Plus,
  delete: Trash2,
  settings: Settings,
  upload: Upload,
  download: Download,
  sync: RefreshCw,
  approve: Check,
  reject: X,
  mention: MessageSquare,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  edit: "text-blue-500 bg-blue-500/10",
  commit: "text-green-500 bg-green-500/10",
  comment: "text-purple-500 bg-purple-500/10",
  join: "text-emerald-500 bg-emerald-500/10",
  leave: "text-gray-500 bg-gray-500/10",
  view: "text-sky-500 bg-sky-500/10",
  create: "text-teal-500 bg-teal-500/10",
  delete: "text-red-500 bg-red-500/10",
  settings: "text-orange-500 bg-orange-500/10",
  upload: "text-indigo-500 bg-indigo-500/10",
  download: "text-cyan-500 bg-cyan-500/10",
  sync: "text-yellow-500 bg-yellow-500/10",
  approve: "text-green-500 bg-green-500/10",
  reject: "text-red-500 bg-red-500/10",
  mention: "text-pink-500 bg-pink-500/10",
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  edit: "Edits",
  commit: "Commits",
  comment: "Comments",
  join: "Joins",
  leave: "Leaves",
  view: "Views",
  create: "Creates",
  delete: "Deletes",
  settings: "Settings",
  upload: "Uploads",
  download: "Downloads",
  sync: "Syncs",
  approve: "Approvals",
  reject: "Rejections",
  mention: "Mentions",
};

// =============================================================================
// Component
// =============================================================================

export function ActivityFeed({
  activities,
  maxItems = 50,
  filterTypes,
  filterUsers,
  showFilters = false,
  relativeTime = true,
  compact = false,
  groupByDate = true,
  onActivityClick,
  onLoadMore,
  hasMore = false,
  loading = false,
  className,
}: ActivityFeedProps) {
  const [selectedTypes, setSelectedTypes] = useState<Set<ActivityType>>(
    new Set(filterTypes || [])
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter and limit activities
  const filteredActivities = useMemo(() => {
    let result = [...activities];

    // Filter by type
    if (selectedTypes.size > 0) {
      result = result.filter((a) => selectedTypes.has(a.type));
    }

    // Filter by user
    if (filterUsers && filterUsers.length > 0) {
      result = result.filter((a) => filterUsers.includes(a.user.id));
    }

    // Sort by timestamp (newest first)
    result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Limit
    return result.slice(0, maxItems);
  }, [activities, selectedTypes, filterUsers, maxItems]);

  // Group by date
  const groupedActivities = useMemo(() => {
    if (!groupByDate) {
      return { ungrouped: filteredActivities };
    }

    const groups: Record<string, ActivityItem[]> = {};

    for (const activity of filteredActivities) {
      const dateKey = getDateKey(activity.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    }

    return groups;
  }, [filteredActivities, groupByDate]);

  // Toggle filter type
  const toggleType = useCallback((type: ActivityType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Clear filters
  const clearFilters = useCallback(() => {
    setSelectedTypes(new Set());
  }, []);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header with filters */}
      {showFilters && (
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-medium text-sm">Activity</h3>
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted",
              selectedTypes.size > 0 && "text-primary"
            )}
          >
            <Filter className="w-3 h-3" />
            {selectedTypes.size > 0 ? `${selectedTypes.size} filters` : "Filter"}
            <ChevronDown
              className={cn("w-3 h-3 transition-transform", filtersOpen && "rotate-180")}
            />
          </button>
        </div>
      )}

      {/* Filter dropdown */}
      {showFilters && filtersOpen && (
        <div className="p-3 border-b bg-muted/30">
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ACTIVITY_LABELS).map(([type, label]) => (
              <button
                key={type}
                onClick={() => toggleType(type as ActivityType)}
                className={cn(
                  "px-2 py-1 text-xs rounded-full transition-colors",
                  selectedTypes.has(type as ActivityType)
                    ? ACTIVITY_COLORS[type as ActivityType]
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {selectedTypes.size > 0 && (
            <button
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground mt-2"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto">
        {filteredActivities.length === 0 ? (
          <EmptyState />
        ) : groupByDate ? (
          Object.entries(groupedActivities).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="sticky top-0 px-3 py-1.5 text-xs font-medium text-muted-foreground bg-background/95 backdrop-blur border-b">
                {formatDateKey(dateKey)}
              </div>
              {items.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  compact={compact}
                  relativeTime={relativeTime}
                  onClick={onActivityClick}
                />
              ))}
            </div>
          ))
        ) : (
          filteredActivities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              compact={compact}
              relativeTime={relativeTime}
              onClick={onActivityClick}
            />
          ))
        )}

        {/* Load more button */}
        {hasMore && (
          <div className="p-3 text-center">
            <button
              onClick={onLoadMore}
              disabled={loading}
              className="text-xs text-primary hover:underline disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Activity Row
// =============================================================================

interface ActivityRowProps {
  activity: ActivityItem;
  compact: boolean;
  relativeTime: boolean;
  onClick?: (activity: ActivityItem) => void;
}

function ActivityRow({ activity, compact, relativeTime, onClick }: ActivityRowProps) {
  const Icon = ACTIVITY_ICONS[activity.type];
  const colorClass = ACTIVITY_COLORS[activity.type];

  return (
    <div
      className={cn(
        "flex gap-3 px-3 py-2 hover:bg-muted/50 transition-colors cursor-pointer",
        !activity.seen && "bg-primary/5",
        compact ? "py-1.5" : "py-2.5"
      )}
      onClick={() => onClick?.(activity)}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex-shrink-0 rounded-full flex items-center justify-center",
          colorClass,
          compact ? "w-6 h-6" : "w-8 h-8"
        )}
      >
        <Icon className={compact ? "w-3 h-3" : "w-4 h-4"} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={cn("flex items-start gap-2", compact && "items-center")}>
          {/* User avatar (non-compact) */}
          {!compact && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white flex-shrink-0"
              style={{ backgroundColor: activity.user.color }}
            >
              {activity.user.isAi ? "AI" : getInitials(activity.user.name)}
            </div>
          )}

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <p className={cn("text-sm", compact && "text-xs")}>
              <span className="font-medium">{activity.user.name}</span>
              {activity.user.isAi && (
                <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">
                  AI
                </span>
              )}{" "}
              <span className="text-muted-foreground">{activity.description}</span>
            </p>

            {/* Target (non-compact) */}
            {!compact && activity.target && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {activity.target.path || activity.target.name}
              </p>
            )}
          </div>

          {/* Timestamp */}
          <span
            className={cn(
              "text-muted-foreground flex-shrink-0",
              compact ? "text-[10px]" : "text-xs"
            )}
            title={activity.timestamp.toLocaleString()}
          >
            {relativeTime
              ? formatRelativeTime(activity.timestamp)
              : formatTime(activity.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Empty State
// =============================================================================

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Clock className="w-10 h-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">No recent activity</p>
      <p className="text-xs text-muted-foreground/70 mt-1">
        Team activity will appear here
      </p>
    </div>
  );
}

// =============================================================================
// Activity Feed Hook
// =============================================================================

export interface UseActivityFeedOptions {
  /** Initial activities */
  initialActivities?: ActivityItem[];
  /** Maximum activities to keep in memory */
  maxActivities?: number;
  /** Auto-mark as seen after this many ms */
  autoMarkSeenAfter?: number;
}

export function useActivityFeed(options: UseActivityFeedOptions = {}) {
  const { initialActivities = [], maxActivities = 100, autoMarkSeenAfter = 5000 } = options;

  const [activities, setActivities] = useState<ActivityItem[]>(initialActivities);
  const [unreadCount, setUnreadCount] = useState(0);

  // Add new activity
  const addActivity = useCallback(
    (activity: Omit<ActivityItem, "id" | "timestamp" | "seen">) => {
      const newActivity: ActivityItem = {
        ...activity,
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: new Date(),
        seen: false,
      };

      setActivities((prev) => {
        const updated = [newActivity, ...prev].slice(0, maxActivities);
        return updated;
      });

      setUnreadCount((prev) => prev + 1);

      // Auto-mark as seen
      if (autoMarkSeenAfter > 0) {
        setTimeout(() => {
          markAsSeen(newActivity.id);
        }, autoMarkSeenAfter);
      }

      return newActivity;
    },
    [maxActivities, autoMarkSeenAfter]
  );

  // Mark activity as seen
  const markAsSeen = useCallback((activityId: string) => {
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId && !a.seen ? { ...a, seen: true } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Mark all as seen
  const markAllAsSeen = useCallback(() => {
    setActivities((prev) => prev.map((a) => ({ ...a, seen: true })));
    setUnreadCount(0);
  }, []);

  // Clear all activities
  const clearActivities = useCallback(() => {
    setActivities([]);
    setUnreadCount(0);
  }, []);

  // Update unread count when activities change
  useEffect(() => {
    const unseen = activities.filter((a) => !a.seen).length;
    setUnreadCount(unseen);
  }, [activities]);

  return {
    activities,
    unreadCount,
    addActivity,
    markAsSeen,
    markAllAsSeen,
    clearActivities,
    setActivities,
  };
}

// =============================================================================
// Utilities
// =============================================================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getDateKey(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return "today";
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return "yesterday";
  }
  return date.toISOString().split("T")[0];
}

function formatDateKey(key: string): string {
  if (key === "today") return "Today";
  if (key === "yesterday") return "Yesterday";
  return new Date(key).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =============================================================================
// Activity Builders (Convenience functions)
// =============================================================================

export const ActivityBuilders = {
  edit: (
    user: ActivityItem["user"],
    fileName: string,
    filePath: string
  ): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "edit",
    user,
    description: `edited`,
    target: { type: "file", id: filePath, name: fileName, path: filePath },
  }),

  commit: (
    user: ActivityItem["user"],
    message: string,
    commitId: string
  ): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "commit",
    user,
    description: `committed "${message.slice(0, 50)}${message.length > 50 ? "..." : ""}"`,
    target: { type: "commit", id: commitId, name: commitId.slice(0, 7) },
  }),

  comment: (
    user: ActivityItem["user"],
    preview: string,
    targetFile?: string
  ): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "comment",
    user,
    description: `commented: "${preview.slice(0, 40)}${preview.length > 40 ? "..." : ""}"`,
    target: targetFile
      ? { type: "file", id: targetFile, name: targetFile.split("/").pop() || targetFile }
      : undefined,
  }),

  join: (user: ActivityItem["user"]): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "join",
    user,
    description: "joined the workspace",
  }),

  leave: (user: ActivityItem["user"]): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "leave",
    user,
    description: "left the workspace",
  }),

  create: (
    user: ActivityItem["user"],
    fileName: string,
    filePath: string
  ): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "create",
    user,
    description: `created`,
    target: { type: "file", id: filePath, name: fileName, path: filePath },
  }),

  delete: (
    user: ActivityItem["user"],
    fileName: string,
    filePath: string
  ): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "delete",
    user,
    description: `deleted`,
    target: { type: "file", id: filePath, name: fileName, path: filePath },
  }),

  mention: (
    user: ActivityItem["user"],
    mentionedUser: string
  ): Omit<ActivityItem, "id" | "timestamp" | "seen"> => ({
    type: "mention",
    user,
    description: `mentioned @${mentionedUser}`,
    target: { type: "user", id: mentionedUser, name: mentionedUser },
  }),
};

// =============================================================================
// Export
// =============================================================================

export default ActivityFeed;
