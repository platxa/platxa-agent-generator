"use client";

/**
 * FileChangeSummary Component
 *
 * Shows what files were modified in each AI response with diff viewing.
 * Provides a clear overview of changes made during generation.
 *
 * Features:
 * - Files added/modified/deleted indicators
 * - Click to view diff for each file
 * - Collapsible file groups by action type
 * - Lines changed count
 * - Copy path functionality
 * - Expandable inline diff preview
 *
 * Feature #93: UI Enhancements - FileChangeSummary
 */

import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import {
  FileCode,
  FilePlus,
  FileX,
  FilePen,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Minus,
  Eye,
  EyeOff,
  FolderOpen,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

/** File change action type */
export type FileAction = "added" | "modified" | "deleted";

/** Diff line type */
export type DiffLineType = "added" | "removed" | "unchanged" | "context";

/** Diff line */
export interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/** File change entry */
export interface FileChange {
  /** File path */
  path: string;
  /** Action performed */
  action: FileAction;
  /** Lines added */
  linesAdded?: number;
  /** Lines removed */
  linesRemoved?: number;
  /** Diff content */
  diff?: DiffLine[];
  /** Language for syntax highlighting */
  language?: string;
  /** File size in bytes */
  size?: number;
  /** Optional description */
  description?: string;
}

/** FileChangeSummary props */
export interface FileChangeSummaryProps {
  /** List of file changes */
  changes: FileChange[];
  /** Callback when file is clicked */
  onFileClick?: (file: FileChange) => void;
  /** Callback to view full diff */
  onViewDiff?: (file: FileChange) => void;
  /** Show inline diff previews */
  showInlineDiff?: boolean;
  /** Group files by action type */
  groupByAction?: boolean;
  /** Maximum files to show before "show more" */
  maxFilesVisible?: number;
  /** Compact mode */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getFileDirectory(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.join("/") || ".";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getActionConfig(action: FileAction) {
  const configs = {
    added: {
      icon: FilePlus,
      label: "Added",
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/30",
      borderColor: "border-green-200 dark:border-green-800",
    },
    modified: {
      icon: FilePen,
      label: "Modified",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    deleted: {
      icon: FileX,
      label: "Deleted",
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      borderColor: "border-red-200 dark:border-red-800",
    },
  };
  return configs[action];
}

// =============================================================================
// Sub-Components
// =============================================================================

/** Copy path button */
function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [path]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      title="Copy path"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/** Lines changed badge */
function LinesChangedBadge({ added, removed }: { added?: number; removed?: number }) {
  if (!added && !removed) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {added !== undefined && added > 0 && (
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
          <Plus className="w-3 h-3" />
          {added}
        </span>
      )}
      {removed !== undefined && removed > 0 && (
        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
          <Minus className="w-3 h-3" />
          {removed}
        </span>
      )}
    </div>
  );
}

/** Diff preview component */
function DiffPreview({ diff, maxLines = 10 }: { diff: DiffLine[]; maxLines?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visibleLines = expanded ? diff : diff.slice(0, maxLines);
  const hasMore = diff.length > maxLines;

  return (
    <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div className="overflow-x-auto">
        <pre className="text-xs">
          {visibleLines.map((line, idx) => (
            <div
              key={idx}
              className={`px-3 py-0.5 ${
                line.type === "added"
                  ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                  : line.type === "removed"
                  ? "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                  : "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-400"
              }`}
            >
              <span className="inline-block w-4 mr-2 text-gray-400 select-none">
                {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
              </span>
              <code>{line.content}</code>
            </div>
          ))}
        </pre>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          {expanded ? "Show less" : `Show ${diff.length - maxLines} more lines`}
        </button>
      )}
    </div>
  );
}

/** Single file change item */
function FileChangeItem({
  change,
  onFileClick,
  onViewDiff,
  showInlineDiff,
  compact,
}: {
  change: FileChange;
  onFileClick?: (file: FileChange) => void;
  onViewDiff?: (file: FileChange) => void;
  showInlineDiff?: boolean;
  compact?: boolean;
}) {
  const [diffVisible, setDiffVisible] = useState(false);
  const config = getActionConfig(change.action);
  const Icon = config.icon;

  return (
    <div className="group">
      <div
        className={`
          flex items-center gap-3 p-2 rounded-lg cursor-pointer
          hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
          ${compact ? "py-1.5" : "py-2"}
        `}
        onClick={() => onFileClick?.(change)}
      >
        {/* Action icon */}
        <div className={`p-1.5 rounded ${config.bgColor}`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {getFileName(change.path)}
            </span>
            <CopyPathButton path={change.path} />
          </div>
          {!compact && (
            <p className="text-xs text-gray-500 truncate">
              {getFileDirectory(change.path)}
            </p>
          )}
          {change.description && (
            <p className="text-xs text-gray-500 mt-0.5">{change.description}</p>
          )}
        </div>

        {/* Stats and actions */}
        <div className="flex items-center gap-3">
          <LinesChangedBadge added={change.linesAdded} removed={change.linesRemoved} />

          {change.size !== undefined && (
            <span className="text-xs text-gray-400">{formatFileSize(change.size)}</span>
          )}

          {change.diff && showInlineDiff && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDiffVisible(!diffVisible);
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              title={diffVisible ? "Hide diff" : "Show diff"}
            >
              {diffVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {onViewDiff && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewDiff(change);
              }}
              className="p-1 text-gray-400 hover:text-blue-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="View full diff"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline diff preview */}
      {diffVisible && change.diff && (
        <div className="ml-10 mr-2 mb-2">
          <DiffPreview diff={change.diff} />
        </div>
      )}
    </div>
  );
}

/** Action group header */
function ActionGroupHeader({
  action,
  count,
  expanded,
  onToggle,
}: {
  action: FileAction;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const config = getActionConfig(action);
  const Icon = config.icon;

  return (
    <button
      onClick={onToggle}
      className={`
        w-full flex items-center gap-2 px-3 py-2 rounded-lg
        ${config.bgColor} ${config.borderColor} border
        hover:opacity-90 transition-opacity
      `}
    >
      {expanded ? (
        <ChevronDown className="w-4 h-4 text-gray-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-500" />
      )}
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`font-medium ${config.color}`}>
        {count} {config.label}
      </span>
    </button>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FileChangeSummary({
  changes,
  onFileClick,
  onViewDiff,
  showInlineDiff = true,
  groupByAction = true,
  maxFilesVisible = 10,
  compact = false,
  className = "",
}: FileChangeSummaryProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<FileAction>>(
    new Set(["added", "modified", "deleted"])
  );
  const [showAll, setShowAll] = useState(false);

  // Group changes by action
  const groupedChanges = useMemo(() => {
    const groups: Record<FileAction, FileChange[]> = {
      added: [],
      modified: [],
      deleted: [],
    };
    changes.forEach((change) => {
      groups[change.action].push(change);
    });
    return groups;
  }, [changes]);

  // Calculate summary stats
  const summary = useMemo(() => {
    let totalAdded = 0;
    let totalRemoved = 0;
    changes.forEach((c) => {
      totalAdded += c.linesAdded || 0;
      totalRemoved += c.linesRemoved || 0;
    });
    return {
      totalFiles: changes.length,
      filesAdded: groupedChanges.added.length,
      filesModified: groupedChanges.modified.length,
      filesDeleted: groupedChanges.deleted.length,
      linesAdded: totalAdded,
      linesRemoved: totalRemoved,
    };
  }, [changes, groupedChanges]);

  const toggleGroup = useCallback((action: FileAction) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(action)) {
        next.delete(action);
      } else {
        next.add(action);
      }
      return next;
    });
  }, []);

  const visibleChanges = showAll ? changes : changes.slice(0, maxFilesVisible);
  const hasMore = changes.length > maxFilesVisible;

  if (changes.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        <FileCode className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No file changes</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden ${className}`}>
      {/* Header with summary */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              File Changes
            </h3>
            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
              {summary.totalFiles} {summary.totalFiles === 1 ? "file" : "files"}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            {summary.filesAdded > 0 && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <FilePlus className="w-4 h-4" />
                {summary.filesAdded}
              </span>
            )}
            {summary.filesModified > 0 && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <FilePen className="w-4 h-4" />
                {summary.filesModified}
              </span>
            )}
            {summary.filesDeleted > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <FileX className="w-4 h-4" />
                {summary.filesDeleted}
              </span>
            )}
          </div>
        </div>

        {/* Lines changed summary */}
        {(summary.linesAdded > 0 || summary.linesRemoved > 0) && (
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
            <span>Total:</span>
            {summary.linesAdded > 0 && (
              <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                <Plus className="w-3 h-3" />
                {summary.linesAdded} lines
              </span>
            )}
            {summary.linesRemoved > 0 && (
              <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
                <Minus className="w-3 h-3" />
                {summary.linesRemoved} lines
              </span>
            )}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="p-3">
        {groupByAction ? (
          <div className="space-y-3">
            {(["added", "modified", "deleted"] as FileAction[]).map((action) => {
              const files = groupedChanges[action];
              if (files.length === 0) return null;

              const isExpanded = expandedGroups.has(action);

              return (
                <div key={action}>
                  <ActionGroupHeader
                    action={action}
                    count={files.length}
                    expanded={isExpanded}
                    onToggle={() => toggleGroup(action)}
                  />
                  {isExpanded && (
                    <div className="mt-2 space-y-1">
                      {files.map((change, idx) => (
                        <FileChangeItem
                          key={`${change.path}-${idx}`}
                          change={change}
                          onFileClick={onFileClick}
                          onViewDiff={onViewDiff}
                          showInlineDiff={showInlineDiff}
                          compact={compact}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {visibleChanges.map((change, idx) => (
              <FileChangeItem
                key={`${change.path}-${idx}`}
                change={change}
                onFileClick={onFileClick}
                onViewDiff={onViewDiff}
                showInlineDiff={showInlineDiff}
                compact={compact}
              />
            ))}
            {hasMore && !showAll && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
              >
                Show {changes.length - maxFilesVisible} more files
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FileChangeSummary;
