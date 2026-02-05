"use client";

/**
 * ImprovedHistoryView Component
 *
 * Visual timeline of version history with diff previews and restore capability.
 * Provides intuitive navigation through project changes over time.
 *
 * Features:
 * - Visual timeline with change indicators
 * - Diff preview on hover/click
 * - Grouped changes by day/session
 * - Filter by change type
 * - Search changes
 * - Restore to any point
 *
 * Feature #90: UI Enhancements - ImprovedHistoryView
 */

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  Clock,
  RotateCcw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  FileText,
  Layout,
  Palette,
  Code,
  Image,
  Settings,
  Plus,
  Minus,
  Edit3,
  Trash2,
  Eye,
  User,
  Calendar,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** Change type */
export type ChangeType = "page" | "component" | "style" | "asset" | "config" | "content";

/** Change action */
export type ChangeAction = "create" | "update" | "delete" | "move" | "rename";

/** History entry */
export interface HistoryEntry {
  id: string;
  timestamp: Date;
  author: string;
  authorAvatar?: string;
  changeType: ChangeType;
  action: ChangeAction;
  target: string;
  description: string;
  diff?: {
    before?: string;
    after?: string;
    additions?: number;
    deletions?: number;
  };
  isBookmarked?: boolean;
  sessionId?: string;
}

/** Grouped history entries */
interface HistoryGroup {
  date: string;
  entries: HistoryEntry[];
}

/** ImprovedHistoryView props */
export interface ImprovedHistoryViewProps {
  entries: HistoryEntry[];
  currentVersionId?: string;
  onRestore: (entryId: string) => Promise<void>;
  onPreview?: (entryId: string) => void;
  onBookmark?: (entryId: string) => void;
  className?: string;
}

// =============================================================================
// Constants
// =============================================================================

const CHANGE_TYPE_CONFIG: Record<ChangeType, { icon: React.ReactNode; color: string; label: string }> = {
  page: { icon: <FileText className="w-4 h-4" />, color: "text-blue-500", label: "Page" },
  component: { icon: <Layout className="w-4 h-4" />, color: "text-purple-500", label: "Component" },
  style: { icon: <Palette className="w-4 h-4" />, color: "text-pink-500", label: "Style" },
  asset: { icon: <Image className="w-4 h-4" />, color: "text-green-500", label: "Asset" },
  config: { icon: <Settings className="w-4 h-4" />, color: "text-gray-500", label: "Config" },
  content: { icon: <Code className="w-4 h-4" />, color: "text-amber-500", label: "Content" },
};

const ACTION_CONFIG: Record<ChangeAction, { icon: React.ReactNode; color: string; label: string }> = {
  create: { icon: <Plus className="w-3 h-3" />, color: "text-green-500 bg-green-100 dark:bg-green-900/30", label: "Created" },
  update: { icon: <Edit3 className="w-3 h-3" />, color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30", label: "Updated" },
  delete: { icon: <Trash2 className="w-3 h-3" />, color: "text-red-500 bg-red-100 dark:bg-red-900/30", label: "Deleted" },
  move: { icon: <ChevronRight className="w-3 h-3" />, color: "text-amber-500 bg-amber-100 dark:bg-amber-900/30", label: "Moved" },
  rename: { icon: <Edit3 className="w-3 h-3" />, color: "text-purple-500 bg-purple-100 dark:bg-purple-900/30", label: "Renamed" },
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDate(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

function groupEntriesByDate(entries: HistoryEntry[]): HistoryGroup[] {
  const groups: Map<string, HistoryEntry[]> = new Map();

  for (const entry of entries) {
    const dateKey = entry.timestamp.toDateString();
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(entry);
  }

  return Array.from(groups.entries())
    .map(([date, entries]) => ({
      date,
      entries: entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map(part => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Diff preview component */
function DiffPreview({ diff }: { diff: NonNullable<HistoryEntry["diff"]> }) {
  return (
    <div className="mt-3 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-500">Changes</span>
        <div className="flex items-center gap-3 text-xs">
          {diff.additions !== undefined && (
            <span className="text-green-600 dark:text-green-400">+{diff.additions}</span>
          )}
          {diff.deletions !== undefined && (
            <span className="text-red-600 dark:text-red-400">-{diff.deletions}</span>
          )}
        </div>
      </div>

      <div className="max-h-48 overflow-auto">
        {diff.before && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 mb-1">
              <Minus className="w-3 h-3" />
              Before
            </div>
            <pre className="text-xs text-red-800 dark:text-red-200 whitespace-pre-wrap font-mono">
              {diff.before}
            </pre>
          </div>
        )}

        {diff.after && (
          <div className="px-3 py-2 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 mb-1">
              <Plus className="w-3 h-3" />
              After
            </div>
            <pre className="text-xs text-green-800 dark:text-green-200 whitespace-pre-wrap font-mono">
              {diff.after}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/** Timeline entry component */
function TimelineEntry({
  entry,
  isFirst,
  isLast,
  onRestore,
  onPreview,
  onBookmark,
}: {
  entry: HistoryEntry;
  isFirst: boolean;
  isLast: boolean;
  onRestore: () => void;
  onPreview?: () => void;
  onBookmark?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = CHANGE_TYPE_CONFIG[entry.changeType];
  const actionConfig = ACTION_CONFIG[entry.action];

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-px ${isFirst ? "h-4" : "h-4"} bg-gray-200 dark:bg-gray-700`} />
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${typeConfig.color} bg-gray-100 dark:bg-gray-800 border-2 border-white dark:border-gray-900 shadow-sm z-10`}>
          {typeConfig.icon}
        </div>
        {!isLast && <div className="w-px flex-1 bg-gray-200 dark:bg-gray-700" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div
          className={`p-4 rounded-lg border transition-colors cursor-pointer ${
            expanded
              ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
          onClick={() => setExpanded(!expanded)}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${actionConfig.color}`}>
                  {actionConfig.icon}
                  {actionConfig.label}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {entry.target}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">
                {entry.description}
              </p>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatTime(entry.timestamp)}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </div>
          </div>

          {/* Author */}
          <div className="flex items-center gap-2 mt-3">
            {entry.authorAvatar ? (
              <img src={entry.authorAvatar} alt={entry.author} className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                {getInitials(entry.author)}
              </div>
            )}
            <span className="text-xs text-gray-500">{entry.author}</span>
          </div>

          {/* Expanded content */}
          {expanded && (
            <div onClick={(e) => e.stopPropagation()}>
              {/* Diff preview */}
              {entry.diff && <DiffPreview diff={entry.diff} />}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onRestore}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restore
                </button>
                {onPreview && (
                  <button
                    onClick={onPreview}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                )}
                {onBookmark && (
                  <button
                    onClick={onBookmark}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md ${
                      entry.isBookmarked
                        ? "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    {entry.isBookmarked ? "Bookmarked" : "Bookmark"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Date group header */
function DateGroupHeader({ date, entryCount }: { date: string; entryCount: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full">
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatDate(new Date(date))}
        </span>
      </div>
      <span className="text-xs text-gray-400">
        {entryCount} change{entryCount !== 1 ? "s" : ""}
      </span>
      <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ImprovedHistoryView({
  entries,
  currentVersionId,
  onRestore,
  onPreview,
  onBookmark,
  className = "",
}: ImprovedHistoryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<ChangeType>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Filter entries
  const filteredEntries = useMemo(() => {
    let filtered = [...entries];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        e => e.target.toLowerCase().includes(query) ||
             e.description.toLowerCase().includes(query) ||
             e.author.toLowerCase().includes(query)
      );
    }

    // Filter by type
    if (selectedTypes.size > 0) {
      filtered = filtered.filter(e => selectedTypes.has(e.changeType));
    }

    return filtered;
  }, [entries, searchQuery, selectedTypes]);

  // Group by date
  const groupedEntries = useMemo(() => groupEntriesByDate(filteredEntries), [filteredEntries]);

  const toggleTypeFilter = useCallback((type: ChangeType) => {
    setSelectedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleRestore = useCallback(async (entryId: string) => {
    if (confirm("Restore to this version? Current changes will be saved as a new version.")) {
      await onRestore(entryId);
    }
  }, [onRestore]);

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Version History
            </h2>
            <p className="text-sm text-gray-500">
              {entries.length} change{entries.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              selectedTypes.size > 0
                ? "border-blue-300 bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filter
            {selectedTypes.size > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                {selectedTypes.size}
              </span>
            )}
          </button>
        </div>

        {/* Filter options */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-2">Filter by type:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(CHANGE_TYPE_CONFIG) as ChangeType[]).map(type => {
                const config = CHANGE_TYPE_CONFIG[type];
                const isSelected = selectedTypes.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleTypeFilter(type)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      isSelected
                        ? "bg-white dark:bg-gray-900 border-2 border-blue-500 text-blue-600"
                        : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                  >
                    <span className={config.color}>{config.icon}</span>
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="p-6">
        {groupedEntries.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500">
              {searchQuery || selectedTypes.size > 0
                ? "No changes match your filters"
                : "No changes recorded yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedEntries.map((group, groupIndex) => (
              <div key={group.date}>
                <DateGroupHeader date={group.date} entryCount={group.entries.length} />

                <div>
                  {group.entries.map((entry, entryIndex) => (
                    <TimelineEntry
                      key={entry.id}
                      entry={entry}
                      isFirst={groupIndex === 0 && entryIndex === 0}
                      isLast={
                        groupIndex === groupedEntries.length - 1 &&
                        entryIndex === group.entries.length - 1
                      }
                      onRestore={() => handleRestore(entry.id)}
                      onPreview={onPreview ? () => onPreview(entry.id) : undefined}
                      onBookmark={onBookmark ? () => onBookmark(entry.id) : undefined}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ImprovedHistoryView;
