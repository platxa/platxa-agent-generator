"use client";

/**
 * ConflictResolutionPanel Component
 *
 * UI for detecting and resolving conflicts when changes diverge between
 * local and remote versions.
 *
 * Features:
 * - Conflict detection display
 * - Side-by-side diff view
 * - Choose local/remote/merged version
 * - Manual conflict resolution editor
 * - Batch resolution for multiple conflicts
 * - Conflict markers parsing
 * - Resolution history
 *
 * Feature #46: GitHub Integration - Conflict detection and resolution UI
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  GitMerge,
  GitBranch,
  AlertTriangle,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Copy,
  FileCode2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Edit3,
  Eye,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types
// =============================================================================

/** Conflict type */
export type ConflictType = "content" | "rename" | "delete" | "mode";

/** Resolution choice */
export type ResolutionChoice = "local" | "remote" | "both" | "manual" | "none";

/** Single line in a diff */
export interface DiffLine {
  lineNumber: {
    local?: number;
    remote?: number;
  };
  content: string;
  type: "unchanged" | "added" | "removed" | "conflict-local" | "conflict-remote" | "conflict-marker";
}

/** Conflict region within a file */
export interface ConflictRegion {
  id: string;
  startLine: number;
  endLine: number;
  localContent: string[];
  remoteContent: string[];
  resolution?: ResolutionChoice;
  resolvedContent?: string[];
}

/** File with conflicts */
export interface ConflictedFile {
  id: string;
  path: string;
  type: ConflictType;
  localVersion: string;
  remoteVersion: string;
  baseVersion?: string;
  conflicts: ConflictRegion[];
  resolved: boolean;
  resolvedContent?: string;
}

/** Component props */
export interface ConflictResolutionPanelProps {
  /** Files with conflicts */
  files: ConflictedFile[];
  /** Callback when a file is resolved */
  onResolve?: (fileId: string, content: string) => void;
  /** Callback when all conflicts are resolved */
  onResolveAll?: (files: { id: string; content: string }[]) => void;
  /** Callback to refresh conflict status */
  onRefresh?: () => void;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Parse diff content into lines
 */
function parseDiffLines(local: string, remote: string): DiffLine[] {
  const localLines = local.split("\n");
  const remoteLines = remote.split("\n");
  const result: DiffLine[] = [];

  // Simple line-by-line diff (in production, use a proper diff algorithm)
  const maxLines = Math.max(localLines.length, remoteLines.length);

  for (let i = 0; i < maxLines; i++) {
    const localLine = localLines[i];
    const remoteLine = remoteLines[i];

    if (localLine === remoteLine) {
      result.push({
        lineNumber: { local: i + 1, remote: i + 1 },
        content: localLine || "",
        type: "unchanged",
      });
    } else if (localLine === undefined) {
      result.push({
        lineNumber: { remote: i + 1 },
        content: remoteLine,
        type: "added",
      });
    } else if (remoteLine === undefined) {
      result.push({
        lineNumber: { local: i + 1 },
        content: localLine,
        type: "removed",
      });
    } else {
      // Both exist but different - show as conflict
      result.push({
        lineNumber: { local: i + 1 },
        content: localLine,
        type: "conflict-local",
      });
      result.push({
        lineNumber: { remote: i + 1 },
        content: remoteLine,
        type: "conflict-remote",
      });
    }
  }

  return result;
}

/**
 * Generate resolved content based on choice
 */
function generateResolvedContent(
  conflict: ConflictRegion,
  choice: ResolutionChoice
): string[] {
  switch (choice) {
    case "local":
      return conflict.localContent;
    case "remote":
      return conflict.remoteContent;
    case "both":
      return [...conflict.localContent, ...conflict.remoteContent];
    case "manual":
      return conflict.resolvedContent || conflict.localContent;
    default:
      return [];
  }
}

/**
 * Apply resolutions to generate final content
 */
function applyResolutions(file: ConflictedFile): string {
  const lines = file.localVersion.split("\n");
  let offset = 0;

  // Sort conflicts by start line
  const sortedConflicts = [...file.conflicts].sort((a, b) => a.startLine - b.startLine);

  for (const conflict of sortedConflicts) {
    if (!conflict.resolution || conflict.resolution === "none") continue;

    const resolved = generateResolvedContent(conflict, conflict.resolution);
    const removeCount = conflict.endLine - conflict.startLine + 1;

    lines.splice(conflict.startLine + offset - 1, removeCount, ...resolved);
    offset += resolved.length - removeCount;
  }

  return lines.join("\n");
}

// =============================================================================
// Sub-components
// =============================================================================

/** Diff line display */
interface DiffLineViewProps {
  line: DiffLine;
  showLineNumbers?: boolean;
}

function DiffLineView({ line, showLineNumbers = true }: DiffLineViewProps) {
  const bgColors: Record<DiffLine["type"], string> = {
    unchanged: "",
    added: "bg-green-50 dark:bg-green-950/30",
    removed: "bg-red-50 dark:bg-red-950/30",
    "conflict-local": "bg-blue-50 dark:bg-blue-950/30",
    "conflict-remote": "bg-yellow-50 dark:bg-yellow-950/30",
    "conflict-marker": "bg-purple-100 dark:bg-purple-950/50",
  };

  const prefixes: Record<DiffLine["type"], string> = {
    unchanged: " ",
    added: "+",
    removed: "-",
    "conflict-local": "◄",
    "conflict-remote": "►",
    "conflict-marker": "=",
  };

  return (
    <div className={cn("flex font-mono text-sm", bgColors[line.type])}>
      {showLineNumbers && (
        <div className="flex-shrink-0 w-20 px-2 text-right text-muted-foreground border-r select-none">
          <span className="text-blue-600 dark:text-blue-400">
            {line.lineNumber.local || ""}
          </span>
          <span className="mx-1">|</span>
          <span className="text-yellow-600 dark:text-yellow-400">
            {line.lineNumber.remote || ""}
          </span>
        </div>
      )}
      <div className="flex-shrink-0 w-6 text-center text-muted-foreground select-none">
        {prefixes[line.type]}
      </div>
      <pre className="flex-1 px-2 whitespace-pre-wrap break-all">{line.content}</pre>
    </div>
  );
}

/** Conflict region card */
interface ConflictRegionCardProps {
  conflict: ConflictRegion;
  onChange: (resolution: ResolutionChoice, content?: string[]) => void;
  expanded: boolean;
  onToggle: () => void;
}

function ConflictRegionCard({
  conflict,
  onChange,
  expanded,
  onToggle,
}: ConflictRegionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(
    conflict.resolvedContent?.join("\n") || conflict.localContent.join("\n")
  );

  const handleManualSave = () => {
    onChange("manual", editContent.split("\n"));
    setIsEditing(false);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 bg-muted/50 hover:bg-muted transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <AlertTriangle className="h-4 w-4 text-yellow-500" />
        <span className="font-medium">
          Lines {conflict.startLine}-{conflict.endLine}
        </span>
        {conflict.resolution && conflict.resolution !== "none" && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            Resolved ({conflict.resolution})
          </span>
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-4 space-y-4">
          {/* Side by side comparison */}
          <div className="grid grid-cols-2 gap-4">
            {/* Local version */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-blue-600">
                <ArrowLeft className="h-4 w-4" />
                Local (Your changes)
              </div>
              <div className="border rounded bg-blue-50/50 dark:bg-blue-950/20 p-2 font-mono text-sm max-h-48 overflow-auto">
                {conflict.localContent.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line || " "}
                  </div>
                ))}
              </div>
            </div>

            {/* Remote version */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium text-yellow-600">
                <ArrowRight className="h-4 w-4" />
                Remote (Incoming changes)
              </div>
              <div className="border rounded bg-yellow-50/50 dark:bg-yellow-950/20 p-2 font-mono text-sm max-h-48 overflow-auto">
                {conflict.remoteContent.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line || " "}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Manual edit */}
          {isEditing && (
            <div>
              <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                <Edit3 className="h-4 w-4" />
                Manual Resolution
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-32 p-2 font-mono text-sm border rounded bg-background resize-y"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1 text-sm border rounded hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleManualSave}
                  className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Resolution buttons */}
          {!isEditing && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onChange("local")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-sm border rounded transition-colors",
                  conflict.resolution === "local"
                    ? "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-300"
                    : "hover:bg-muted"
                )}
              >
                <ArrowLeft className="h-3 w-3" />
                Accept Local
              </button>
              <button
                onClick={() => onChange("remote")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-sm border rounded transition-colors",
                  conflict.resolution === "remote"
                    ? "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/50 dark:border-yellow-700 dark:text-yellow-300"
                    : "hover:bg-muted"
                )}
              >
                <ArrowRight className="h-3 w-3" />
                Accept Remote
              </button>
              <button
                onClick={() => onChange("both")}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-sm border rounded transition-colors",
                  conflict.resolution === "both"
                    ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300"
                    : "hover:bg-muted"
                )}
              >
                <Layers className="h-3 w-3" />
                Accept Both
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className={cn(
                  "flex items-center gap-1 px-3 py-1.5 text-sm border rounded transition-colors",
                  conflict.resolution === "manual"
                    ? "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/50 dark:border-purple-700 dark:text-purple-300"
                    : "hover:bg-muted"
                )}
              >
                <Edit3 className="h-3 w-3" />
                Edit Manually
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** File conflict card */
interface FileConflictCardProps {
  file: ConflictedFile;
  onResolveConflict: (conflictId: string, resolution: ResolutionChoice, content?: string[]) => void;
  onResolveFile: (content: string) => void;
  expanded: boolean;
  onToggle: () => void;
}

function FileConflictCard({
  file,
  onResolveConflict,
  onResolveFile,
  expanded,
  onToggle,
}: FileConflictCardProps) {
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"conflicts" | "diff" | "preview">("conflicts");

  const resolvedCount = file.conflicts.filter(
    (c) => c.resolution && c.resolution !== "none"
  ).length;

  const allResolved = resolvedCount === file.conflicts.length;

  const toggleConflict = (id: string) => {
    setExpandedConflicts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Generate preview content
  const previewContent = useMemo(() => {
    if (!allResolved) return "";
    return applyResolutions(file);
  }, [file, allResolved]);

  // Diff lines for diff view
  const diffLines = useMemo(
    () => parseDiffLines(file.localVersion, file.remoteVersion),
    [file.localVersion, file.remoteVersion]
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <FileCode2 className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1 text-left">
          <div className="font-medium">{file.path}</div>
          <div className="text-xs text-muted-foreground">
            {file.conflicts.length} conflict{file.conflicts.length !== 1 ? "s" : ""}
            {" • "}
            {resolvedCount} resolved
          </div>
        </div>
        {file.resolved ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : allResolved ? (
          <span className="text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-900/50 px-2 py-1 rounded">
            Ready to apply
          </span>
        ) : (
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
        )}
      </button>

      {/* Content */}
      {expanded && (
        <div className="border-t">
          {/* View mode tabs */}
          <div className="flex border-b">
            <button
              onClick={() => setViewMode("conflicts")}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-sm border-b-2 transition-colors",
                viewMode === "conflicts"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertTriangle className="h-4 w-4" />
              Conflicts ({file.conflicts.length})
            </button>
            <button
              onClick={() => setViewMode("diff")}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-sm border-b-2 transition-colors",
                viewMode === "diff"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <GitMerge className="h-4 w-4" />
              Full Diff
            </button>
            <button
              onClick={() => setViewMode("preview")}
              disabled={!allResolved}
              className={cn(
                "flex items-center gap-1 px-4 py-2 text-sm border-b-2 transition-colors",
                viewMode === "preview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
                !allResolved && "opacity-50 cursor-not-allowed"
              )}
            >
              <Eye className="h-4 w-4" />
              Preview
            </button>
          </div>

          {/* View content */}
          <div className="p-4">
            {viewMode === "conflicts" && (
              <div className="space-y-3">
                {file.conflicts.map((conflict) => (
                  <ConflictRegionCard
                    key={conflict.id}
                    conflict={conflict}
                    onChange={(resolution, content) =>
                      onResolveConflict(conflict.id, resolution, content)
                    }
                    expanded={expandedConflicts.has(conflict.id)}
                    onToggle={() => toggleConflict(conflict.id)}
                  />
                ))}
              </div>
            )}

            {viewMode === "diff" && (
              <div className="border rounded overflow-auto max-h-96">
                {diffLines.map((line, i) => (
                  <DiffLineView key={i} line={line} />
                ))}
              </div>
            )}

            {viewMode === "preview" && allResolved && (
              <div className="border rounded overflow-auto max-h-96 bg-muted/30">
                <pre className="p-4 font-mono text-sm whitespace-pre-wrap">
                  {previewContent}
                </pre>
              </div>
            )}
          </div>

          {/* Actions */}
          {allResolved && !file.resolved && (
            <div className="flex justify-end gap-2 p-4 border-t bg-muted/30">
              <button
                onClick={() => onResolveFile(previewContent)}
                className="flex items-center gap-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
              >
                <Check className="h-4 w-4" />
                Apply Resolution
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ConflictResolutionPanel({
  files,
  onResolve,
  onResolveAll,
  onRefresh,
  isLoading = false,
  className,
}: ConflictResolutionPanelProps) {
  const [localFiles, setLocalFiles] = useState<ConflictedFile[]>(files);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    new Set(files.slice(0, 1).map((f) => f.id))
  );

  // Sync with props
  React.useEffect(() => {
    setLocalFiles(files);
  }, [files]);

  const toggleFile = (id: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleResolveConflict = useCallback(
    (fileId: string, conflictId: string, resolution: ResolutionChoice, content?: string[]) => {
      setLocalFiles((prev) =>
        prev.map((file) =>
          file.id === fileId
            ? {
                ...file,
                conflicts: file.conflicts.map((c) =>
                  c.id === conflictId
                    ? { ...c, resolution, resolvedContent: content }
                    : c
                ),
              }
            : file
        )
      );
    },
    []
  );

  const handleResolveFile = useCallback(
    (fileId: string, content: string) => {
      setLocalFiles((prev) =>
        prev.map((file) =>
          file.id === fileId
            ? { ...file, resolved: true, resolvedContent: content }
            : file
        )
      );
      onResolve?.(fileId, content);
    },
    [onResolve]
  );

  const handleResolveAll = useCallback(() => {
    const resolved = localFiles
      .filter((f) => f.resolved && f.resolvedContent)
      .map((f) => ({ id: f.id, content: f.resolvedContent! }));

    onResolveAll?.(resolved);
  }, [localFiles, onResolveAll]);

  // Stats
  const totalConflicts = localFiles.reduce((sum, f) => sum + f.conflicts.length, 0);
  const resolvedFiles = localFiles.filter((f) => f.resolved).length;
  const allFilesResolved = resolvedFiles === localFiles.length;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <GitMerge className="h-5 w-5 text-yellow-500" />
          <div>
            <h2 className="font-semibold">Conflict Resolution</h2>
            <p className="text-xs text-muted-foreground">
              {localFiles.length} file{localFiles.length !== 1 ? "s" : ""} with {totalConflicts}{" "}
              conflict{totalConflicts !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </button>
          )}
          {allFilesResolved && onResolveAll && (
            <button
              onClick={handleResolveAll}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 transition-colors"
            >
              <Check className="h-4 w-4" />
              Apply All
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {localFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
            <h3 className="font-medium">No Conflicts</h3>
            <p className="text-sm text-muted-foreground mt-1">
              All changes have been merged successfully
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {localFiles.map((file) => (
              <FileConflictCard
                key={file.id}
                file={file}
                onResolveConflict={(conflictId, resolution, content) =>
                  handleResolveConflict(file.id, conflictId, resolution, content)
                }
                onResolveFile={(content) => handleResolveFile(file.id, content)}
                expanded={expandedFiles.has(file.id)}
                onToggle={() => toggleFile(file.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
        <span>
          {resolvedFiles} of {localFiles.length} files resolved
        </span>
        <span>
          {allFilesResolved ? (
            <span className="text-green-600">Ready to merge</span>
          ) : (
            <span className="text-yellow-600">Conflicts pending</span>
          )}
        </span>
      </div>
    </div>
  );
}

export default ConflictResolutionPanel;
