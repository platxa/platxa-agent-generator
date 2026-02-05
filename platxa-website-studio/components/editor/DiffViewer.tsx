"use client";

/**
 * DiffViewer
 *
 * Side-by-side file diff viewer with syntax highlighting
 * for comparing different versions of files.
 *
 * Feature #91: UI Enhancements - File diff viewer
 */

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Maximize2,
  Minimize2,
  ArrowLeftRight,
  FileCode,
  Plus,
  Minus,
  Equal,
} from "lucide-react";

// =============================================================================
// Types
// =============================================================================

export type DiffViewMode = "split" | "unified" | "inline";

export type DiffLineType = "add" | "delete" | "modify" | "unchanged" | "empty";

export interface DiffLine {
  /** Line type */
  type: DiffLineType;
  /** Original line number (null for additions) */
  oldLineNumber: number | null;
  /** New line number (null for deletions) */
  newLineNumber: number | null;
  /** Line content */
  content: string;
  /** Syntax highlighted HTML content */
  highlightedContent?: string;
  /** Word-level changes */
  wordChanges?: Array<{
    type: "add" | "delete" | "unchanged";
    value: string;
  }>;
}

export interface DiffHunk {
  /** Hunk header (e.g., @@ -1,5 +1,6 @@) */
  header: string;
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldLines: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newLines: number;
  /** Lines in this hunk */
  lines: DiffLine[];
  /** Is hunk collapsed */
  collapsed?: boolean;
}

export interface FileDiff {
  /** Old file path */
  oldPath: string;
  /** New file path */
  newPath: string;
  /** File language for syntax highlighting */
  language: string;
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Total additions */
  additions: number;
  /** Total deletions */
  deletions: number;
  /** Is binary file */
  isBinary: boolean;
  /** Is new file */
  isNew: boolean;
  /** Is deleted file */
  isDeleted: boolean;
  /** Is renamed file */
  isRenamed: boolean;
}

export interface DiffViewerProps {
  /** File diff data */
  diff: FileDiff;
  /** View mode */
  mode?: DiffViewMode;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Enable word-level diff highlighting */
  wordDiff?: boolean;
  /** Enable syntax highlighting */
  syntaxHighlight?: boolean;
  /** Collapse unchanged sections */
  collapseUnchanged?: boolean;
  /** Lines of context to show around changes */
  contextLines?: number;
  /** Callback when line is clicked */
  onLineClick?: (line: DiffLine, side: "old" | "new") => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Syntax Highlighting (simplified)
// =============================================================================

const SYNTAX_RULES: Record<string, Array<{ pattern: RegExp; className: string }>> = {
  javascript: [
    { pattern: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await)\b/g, className: "text-purple-400" },
    { pattern: /\b(true|false|null|undefined|this)\b/g, className: "text-orange-400" },
    { pattern: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, className: "text-green-400" },
    { pattern: /\/\/.*/g, className: "text-gray-500 italic" },
    { pattern: /\b\d+\.?\d*\b/g, className: "text-blue-400" },
  ],
  typescript: [
    { pattern: /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|async|await|type|interface|enum)\b/g, className: "text-purple-400" },
    { pattern: /\b(true|false|null|undefined|this|string|number|boolean|any|void)\b/g, className: "text-orange-400" },
    { pattern: /(["'`])(?:(?!\1)[^\\]|\\.)*\1/g, className: "text-green-400" },
    { pattern: /\/\/.*/g, className: "text-gray-500 italic" },
    { pattern: /\b\d+\.?\d*\b/g, className: "text-blue-400" },
  ],
  css: [
    { pattern: /[.#][\w-]+/g, className: "text-yellow-400" },
    { pattern: /\b[\w-]+(?=\s*:)/g, className: "text-blue-400" },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: "text-green-400" },
    { pattern: /\/\*[\s\S]*?\*\//g, className: "text-gray-500 italic" },
    { pattern: /#[0-9a-fA-F]{3,8}\b/g, className: "text-orange-400" },
  ],
  html: [
    { pattern: /&lt;\/?[\w-]+/g, className: "text-blue-400" },
    { pattern: /[\w-]+(?==)/g, className: "text-yellow-400" },
    { pattern: /(["'])(?:(?!\1)[^\\]|\\.)*\1/g, className: "text-green-400" },
    { pattern: /&lt;!--[\s\S]*?--&gt;/g, className: "text-gray-500 italic" },
  ],
};

function highlightSyntax(content: string, language: string): string {
  const rules = SYNTAX_RULES[language] || SYNTAX_RULES.javascript;
  let highlighted = escapeHtml(content);

  for (const rule of rules) {
    highlighted = highlighted.replace(rule.pattern, (match) =>
      `<span class="${rule.className}">${match}</span>`
    );
  }

  return highlighted;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// =============================================================================
// Diff Computation
// =============================================================================

/**
 * Compute word-level diff between two strings
 */
function computeWordDiff(
  oldText: string,
  newText: string
): DiffLine["wordChanges"] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  const changes: DiffLine["wordChanges"] = [];

  // Simple LCS-based word diff
  let i = 0;
  let j = 0;

  while (i < oldWords.length || j < newWords.length) {
    if (i >= oldWords.length) {
      changes.push({ type: "add", value: newWords[j] });
      j++;
    } else if (j >= newWords.length) {
      changes.push({ type: "delete", value: oldWords[i] });
      i++;
    } else if (oldWords[i] === newWords[j]) {
      changes.push({ type: "unchanged", value: oldWords[i] });
      i++;
      j++;
    } else {
      // Check if word exists later
      const oldInNew = newWords.indexOf(oldWords[i], j);
      const newInOld = oldWords.indexOf(newWords[j], i);

      if (oldInNew === -1 || (newInOld !== -1 && newInOld < oldInNew)) {
        changes.push({ type: "delete", value: oldWords[i] });
        i++;
      } else {
        changes.push({ type: "add", value: newWords[j] });
        j++;
      }
    }
  }

  return changes;
}

// =============================================================================
// Component
// =============================================================================

export function DiffViewer({
  diff,
  mode = "split",
  showLineNumbers = true,
  wordDiff = true,
  syntaxHighlight = true,
  collapseUnchanged = true,
  contextLines = 3,
  onLineClick,
  className,
}: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<DiffViewMode>(mode);
  const [collapsedHunks, setCollapsedHunks] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Process hunks with syntax highlighting
  const processedHunks = useMemo(() => {
    return diff.hunks.map((hunk) => ({
      ...hunk,
      lines: hunk.lines.map((line) => ({
        ...line,
        highlightedContent: syntaxHighlight
          ? highlightSyntax(line.content, diff.language)
          : escapeHtml(line.content),
      })),
    }));
  }, [diff, syntaxHighlight]);

  // Toggle hunk collapse
  const toggleHunk = useCallback((index: number) => {
    setCollapsedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  // Copy content
  const copyContent = useCallback((side: "old" | "new") => {
    const lines = diff.hunks.flatMap((h) =>
      h.lines
        .filter((l) =>
          side === "old"
            ? l.type !== "add"
            : l.type !== "delete"
        )
        .map((l) => l.content)
    );
    navigator.clipboard.writeText(lines.join("\n"));
  }, [diff]);

  return (
    <div
      className={cn(
        "flex flex-col bg-background border rounded-lg overflow-hidden",
        isFullscreen && "fixed inset-0 z-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <FileCode className="w-4 h-4 text-muted-foreground" />
          <div className="flex items-center gap-2 text-sm">
            {diff.isRenamed ? (
              <>
                <span className="text-muted-foreground">{diff.oldPath}</span>
                <ArrowLeftRight className="w-3 h-3" />
                <span>{diff.newPath}</span>
              </>
            ) : (
              <span>{diff.newPath || diff.oldPath}</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-green-500 flex items-center gap-0.5">
              <Plus className="w-3 h-3" />
              {diff.additions}
            </span>
            <span className="text-red-500 flex items-center gap-0.5">
              <Minus className="w-3 h-3" />
              {diff.deletions}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center bg-muted rounded-md p-0.5">
            {(["split", "unified"] as DiffViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  viewMode === m
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>

          {/* Copy buttons */}
          <button
            onClick={() => copyContent("old")}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
            title="Copy old version"
          >
            <Copy className="w-4 h-4" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className="flex-1 overflow-auto">
        {diff.isBinary ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Binary file not shown
          </div>
        ) : viewMode === "split" ? (
          <SplitView
            hunks={processedHunks}
            showLineNumbers={showLineNumbers}
            wordDiff={wordDiff}
            collapsedHunks={collapsedHunks}
            onToggleHunk={toggleHunk}
            onLineClick={onLineClick}
          />
        ) : (
          <UnifiedView
            hunks={processedHunks}
            showLineNumbers={showLineNumbers}
            wordDiff={wordDiff}
            collapsedHunks={collapsedHunks}
            onToggleHunk={toggleHunk}
            onLineClick={onLineClick}
          />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Split View
// =============================================================================

interface SplitViewProps {
  hunks: DiffHunk[];
  showLineNumbers: boolean;
  wordDiff: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  onLineClick?: (line: DiffLine, side: "old" | "new") => void;
}

function SplitView({
  hunks,
  showLineNumbers,
  wordDiff,
  collapsedHunks,
  onToggleHunk,
  onLineClick,
}: SplitViewProps) {
  return (
    <div className="flex">
      {/* Old side */}
      <div className="flex-1 border-r">
        <div className="sticky top-0 px-3 py-1 text-xs font-medium text-muted-foreground bg-red-500/10 border-b">
          Original
        </div>
        {hunks.map((hunk, hunkIndex) => (
          <HunkSection
            key={hunkIndex}
            hunk={hunk}
            hunkIndex={hunkIndex}
            side="old"
            showLineNumbers={showLineNumbers}
            wordDiff={wordDiff}
            isCollapsed={collapsedHunks.has(hunkIndex)}
            onToggle={() => onToggleHunk(hunkIndex)}
            onLineClick={onLineClick}
          />
        ))}
      </div>

      {/* New side */}
      <div className="flex-1">
        <div className="sticky top-0 px-3 py-1 text-xs font-medium text-muted-foreground bg-green-500/10 border-b">
          Modified
        </div>
        {hunks.map((hunk, hunkIndex) => (
          <HunkSection
            key={hunkIndex}
            hunk={hunk}
            hunkIndex={hunkIndex}
            side="new"
            showLineNumbers={showLineNumbers}
            wordDiff={wordDiff}
            isCollapsed={collapsedHunks.has(hunkIndex)}
            onToggle={() => onToggleHunk(hunkIndex)}
            onLineClick={onLineClick}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Unified View
// =============================================================================

interface UnifiedViewProps {
  hunks: DiffHunk[];
  showLineNumbers: boolean;
  wordDiff: boolean;
  collapsedHunks: Set<number>;
  onToggleHunk: (index: number) => void;
  onLineClick?: (line: DiffLine, side: "old" | "new") => void;
}

function UnifiedView({
  hunks,
  showLineNumbers,
  wordDiff,
  collapsedHunks,
  onToggleHunk,
  onLineClick,
}: UnifiedViewProps) {
  return (
    <div>
      {hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk header */}
          <button
            onClick={() => onToggleHunk(hunkIndex)}
            className="flex items-center gap-2 w-full px-3 py-1 text-xs font-mono text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border-y"
          >
            {collapsedHunks.has(hunkIndex) ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            {hunk.header}
          </button>

          {/* Hunk lines */}
          {!collapsedHunks.has(hunkIndex) && (
            <div className="font-mono text-sm">
              {hunk.lines.map((line, lineIndex) => (
                <UnifiedDiffLine
                  key={lineIndex}
                  line={line}
                  showLineNumbers={showLineNumbers}
                  wordDiff={wordDiff}
                  onClick={() => onLineClick?.(line, line.type === "delete" ? "old" : "new")}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// Hunk Section (Split view)
// =============================================================================

interface HunkSectionProps {
  hunk: DiffHunk;
  hunkIndex: number;
  side: "old" | "new";
  showLineNumbers: boolean;
  wordDiff: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  onLineClick?: (line: DiffLine, side: "old" | "new") => void;
}

function HunkSection({
  hunk,
  side,
  showLineNumbers,
  isCollapsed,
  onToggle,
  onLineClick,
}: HunkSectionProps) {
  const filteredLines = hunk.lines.filter((line) => {
    if (side === "old") {
      return line.type !== "add";
    } else {
      return line.type !== "delete";
    }
  });

  return (
    <div>
      {/* Hunk header */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-1 text-xs font-mono text-muted-foreground bg-muted/50 hover:bg-muted border-b"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
        {side === "old" ? `@@ -${hunk.oldStart},${hunk.oldLines}` : `@@ +${hunk.newStart},${hunk.newLines}`}
      </button>

      {/* Lines */}
      {!isCollapsed && (
        <div className="font-mono text-sm">
          {filteredLines.map((line, lineIndex) => (
            <SplitDiffLine
              key={lineIndex}
              line={line}
              side={side}
              showLineNumbers={showLineNumbers}
              onClick={() => onLineClick?.(line, side)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Diff Line Components
// =============================================================================

interface SplitDiffLineProps {
  line: DiffLine;
  side: "old" | "new";
  showLineNumbers: boolean;
  onClick?: () => void;
}

function SplitDiffLine({
  line,
  side,
  showLineNumbers,
  onClick,
}: SplitDiffLineProps) {
  const lineNumber = side === "old" ? line.oldLineNumber : line.newLineNumber;
  const bgClass = getLineBgClass(line.type, side);
  const gutterClass = getGutterClass(line.type, side);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex group hover:brightness-95 cursor-pointer",
        bgClass
      )}
    >
      {/* Line number */}
      {showLineNumbers && (
        <div
          className={cn(
            "w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs select-none",
            gutterClass
          )}
        >
          {lineNumber ?? ""}
        </div>
      )}

      {/* Change indicator */}
      <div
        className={cn(
          "w-5 flex-shrink-0 flex items-center justify-center text-xs select-none",
          gutterClass
        )}
      >
        {line.type === "add" && <Plus className="w-3 h-3 text-green-600" />}
        {line.type === "delete" && <Minus className="w-3 h-3 text-red-600" />}
        {line.type === "unchanged" && <Equal className="w-3 h-3 text-gray-400" />}
      </div>

      {/* Content */}
      <div className="flex-1 px-2 py-0.5 overflow-x-auto whitespace-pre">
        {line.highlightedContent ? (
          <span dangerouslySetInnerHTML={{ __html: line.highlightedContent }} />
        ) : (
          line.content
        )}
      </div>
    </div>
  );
}

interface UnifiedDiffLineProps {
  line: DiffLine;
  showLineNumbers: boolean;
  wordDiff: boolean;
  onClick?: () => void;
}

function UnifiedDiffLine({
  line,
  showLineNumbers,
  onClick,
}: UnifiedDiffLineProps) {
  const bgClass = getUnifiedLineBgClass(line.type);
  const gutterClass = getUnifiedGutterClass(line.type);

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex group hover:brightness-95 cursor-pointer",
        bgClass
      )}
    >
      {/* Old line number */}
      {showLineNumbers && (
        <div
          className={cn(
            "w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs select-none border-r",
            gutterClass
          )}
        >
          {line.oldLineNumber ?? ""}
        </div>
      )}

      {/* New line number */}
      {showLineNumbers && (
        <div
          className={cn(
            "w-12 flex-shrink-0 px-2 py-0.5 text-right text-xs select-none border-r",
            gutterClass
          )}
        >
          {line.newLineNumber ?? ""}
        </div>
      )}

      {/* Change indicator */}
      <div
        className={cn(
          "w-6 flex-shrink-0 flex items-center justify-center text-xs font-mono select-none",
          gutterClass
        )}
      >
        {line.type === "add" && "+"}
        {line.type === "delete" && "-"}
        {line.type === "unchanged" && " "}
      </div>

      {/* Content */}
      <div className="flex-1 px-2 py-0.5 overflow-x-auto whitespace-pre">
        {line.highlightedContent ? (
          <span dangerouslySetInnerHTML={{ __html: line.highlightedContent }} />
        ) : (
          line.content
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Style Helpers
// =============================================================================

function getLineBgClass(type: DiffLineType, _side: "old" | "new"): string {
  switch (type) {
    case "add":
      return "bg-green-500/10";
    case "delete":
      return "bg-red-500/10";
    case "modify":
      return "bg-yellow-500/10";
    default:
      return "";
  }
}

function getGutterClass(type: DiffLineType, _side: "old" | "new"): string {
  switch (type) {
    case "add":
      return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "delete":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
    default:
      return "bg-muted/50 text-muted-foreground";
  }
}

function getUnifiedLineBgClass(type: DiffLineType): string {
  switch (type) {
    case "add":
      return "bg-green-500/10";
    case "delete":
      return "bg-red-500/10";
    default:
      return "";
  }
}

function getUnifiedGutterClass(type: DiffLineType): string {
  switch (type) {
    case "add":
      return "bg-green-500/20 text-green-700 dark:text-green-400";
    case "delete":
      return "bg-red-500/20 text-red-700 dark:text-red-400";
    default:
      return "bg-muted/30 text-muted-foreground";
  }
}

// =============================================================================
// Diff Parser Utility
// =============================================================================

/**
 * Parse unified diff format into FileDiff structure
 */
export function parseUnifiedDiff(diffText: string, language: string = "javascript"): FileDiff {
  const lines = diffText.split("\n");
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let oldPath = "";
  let newPath = "";
  let additions = 0;
  let deletions = 0;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    // File headers
    if (line.startsWith("--- ")) {
      oldPath = line.slice(4).replace(/^a\//, "");
    } else if (line.startsWith("+++ ")) {
      newPath = line.slice(4).replace(/^b\//, "");
    }
    // Hunk header
    else if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[3], 10);
        currentHunk = {
          header: line,
          oldStart: oldLineNum,
          oldLines: parseInt(match[2] || "1", 10),
          newStart: newLineNum,
          newLines: parseInt(match[4] || "1", 10),
          lines: [],
        };
      }
    }
    // Diff lines
    else if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({
          type: "add",
          oldLineNumber: null,
          newLineNumber: newLineNum++,
          content: line.slice(1),
        });
        additions++;
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          type: "delete",
          oldLineNumber: oldLineNum++,
          newLineNumber: null,
          content: line.slice(1),
        });
        deletions++;
      } else if (line.startsWith(" ") || line === "") {
        currentHunk.lines.push({
          type: "unchanged",
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          content: line.slice(1) || "",
        });
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return {
    oldPath,
    newPath,
    language,
    hunks,
    additions,
    deletions,
    isBinary: false,
    isNew: oldPath === "/dev/null",
    isDeleted: newPath === "/dev/null",
    isRenamed: oldPath !== newPath && oldPath !== "/dev/null" && newPath !== "/dev/null",
  };
}

// =============================================================================
// Export
// =============================================================================

export default DiffViewer;
