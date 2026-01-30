/**
 * File Diff Display for inline chat messages
 *
 * Feature #116: Add file diff inline display in chat messages
 * Verification: Diff blocks show added/removed lines with color coding
 */

// ============================================================================
// Types
// ============================================================================

/** Line change type */
export type LineChangeType = "added" | "removed" | "unchanged" | "context";

/** A single diff line */
export interface DiffLine {
  /** The line content (without prefix) */
  content: string;
  /** Change type */
  type: LineChangeType;
  /** Line number in old file (for removed/unchanged) */
  oldLineNumber?: number;
  /** Line number in new file (for added/unchanged) */
  newLineNumber?: number;
}

/** A hunk of changes */
export interface DiffHunk {
  /** Hunk header (e.g., @@ -1,5 +1,7 @@) */
  header: string;
  /** Lines in this hunk */
  lines: DiffLine[];
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldCount: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newCount: number;
}

/** File diff result */
export interface FileDiff {
  /** File path */
  filePath: string;
  /** Old file path (for renames) */
  oldFilePath?: string;
  /** Whether this is a new file */
  isNew: boolean;
  /** Whether this file was deleted */
  isDeleted: boolean;
  /** Whether this is a rename */
  isRename: boolean;
  /** Hunks of changes */
  hunks: DiffHunk[];
  /** Total lines added */
  additions: number;
  /** Total lines removed */
  deletions: number;
}

/** Color configuration */
export interface DiffColors {
  /** Color for added lines */
  added: string;
  /** Background for added lines */
  addedBackground: string;
  /** Color for removed lines */
  removed: string;
  /** Background for removed lines */
  removedBackground: string;
  /** Color for unchanged/context lines */
  unchanged: string;
  /** Background for unchanged lines */
  unchangedBackground: string;
  /** Line number color */
  lineNumber: string;
  /** Header color */
  header: string;
}

/** Display options */
export interface DiffDisplayOptions {
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Context lines to show around changes */
  contextLines?: number;
  /** Collapse unchanged sections */
  collapseUnchanged?: boolean;
  /** Custom colors */
  colors?: Partial<DiffColors>;
  /** Show file header */
  showFileHeader?: boolean;
  /** Syntax highlighting language */
  language?: string;
  /** Word-level diff */
  wordDiff?: boolean;
}

/** Rendered line */
export interface RenderedLine {
  /** The line content with prefix */
  text: string;
  /** HTML representation */
  html: string;
  /** CSS classes */
  classes: string[];
  /** Inline styles */
  styles: Record<string, string>;
  /** Line type */
  type: LineChangeType;
  /** Old line number */
  oldLineNumber?: number;
  /** New line number */
  newLineNumber?: number;
}

/** Rendered diff block */
export interface RenderedDiff {
  /** File path */
  filePath: string;
  /** Rendered lines */
  lines: RenderedLine[];
  /** Full HTML */
  html: string;
  /** Statistics */
  stats: {
    additions: number;
    deletions: number;
    unchanged: number;
  };
}

/** Change callback */
export type DiffChangeCallback = (diffs: FileDiff[]) => void;

/** Display state callback */
export type DisplayStateCallback = (state: FileDiffDisplayState) => void;

/** Display state */
export interface FileDiffDisplayState {
  /** All file diffs */
  diffs: FileDiff[];
  /** Currently expanded files */
  expandedFiles: Set<string>;
  /** Currently collapsed hunks */
  collapsedHunks: Set<string>;
}

// ============================================================================
// Constants
// ============================================================================

/** Default colors (dark theme) */
export const DEFAULT_COLORS: DiffColors = {
  added: "#22c55e",
  addedBackground: "rgba(34, 197, 94, 0.15)",
  removed: "#ef4444",
  removedBackground: "rgba(239, 68, 68, 0.15)",
  unchanged: "#a1a1aa",
  unchangedBackground: "transparent",
  lineNumber: "#71717a",
  header: "#60a5fa",
};

/** Light theme colors */
export const LIGHT_COLORS: DiffColors = {
  added: "#16a34a",
  addedBackground: "rgba(22, 163, 74, 0.1)",
  removed: "#dc2626",
  removedBackground: "rgba(220, 38, 38, 0.1)",
  unchanged: "#52525b",
  unchangedBackground: "transparent",
  lineNumber: "#a1a1aa",
  header: "#2563eb",
};

/** Line prefixes */
export const LINE_PREFIXES: Record<LineChangeType, string> = {
  added: "+",
  removed: "-",
  unchanged: " ",
  context: " ",
};

/** CSS class names */
export const CSS_CLASSES: Record<LineChangeType, string> = {
  added: "diff-line-added",
  removed: "diff-line-removed",
  unchanged: "diff-line-unchanged",
  context: "diff-line-context",
};

/** Default display options */
const DEFAULT_OPTIONS: Required<DiffDisplayOptions> = {
  showLineNumbers: true,
  contextLines: 3,
  collapseUnchanged: false,
  colors: DEFAULT_COLORS,
  showFileHeader: true,
  language: "",
  wordDiff: false,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse unified diff format
 */
export function parseUnifiedDiff(diffText: string): FileDiff[] {
  const diffs: FileDiff[] = [];
  const lines = diffText.split("\n");
  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File header: diff --git a/file b/file
    if (line.startsWith("diff --git")) {
      if (currentFile) {
        diffs.push(currentFile);
      }
      const match = line.match(/diff --git a\/(.+?) b\/(.+)/);
      const filePath = match ? match[2] : "";
      const oldPath = match ? match[1] : "";
      currentFile = {
        filePath,
        oldFilePath: oldPath !== filePath ? oldPath : undefined,
        isNew: false,
        isDeleted: false,
        isRename: oldPath !== filePath,
        hunks: [],
        additions: 0,
        deletions: 0,
      };
      currentHunk = null;
      continue;
    }

    // New file indicator
    if (line.startsWith("new file mode")) {
      if (currentFile) {
        currentFile.isNew = true;
      }
      continue;
    }

    // Deleted file indicator
    if (line.startsWith("deleted file mode")) {
      if (currentFile) {
        currentFile.isDeleted = true;
      }
      continue;
    }

    // Skip --- and +++ lines
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    // Hunk header: @@ -1,5 +1,7 @@
    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match && currentFile) {
        currentHunk = {
          header: line,
          lines: [],
          oldStart: parseInt(match[1], 10),
          oldCount: parseInt(match[2] ?? "1", 10),
          newStart: parseInt(match[3], 10),
          newCount: parseInt(match[4] ?? "1", 10),
        };
        oldLineNum = currentHunk.oldStart;
        newLineNum = currentHunk.newStart;
        currentFile.hunks.push(currentHunk);
      }
      continue;
    }

    // Diff lines
    if (currentHunk && currentFile) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({
          content: line.slice(1),
          type: "added",
          newLineNumber: newLineNum++,
        });
        currentFile.additions++;
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          content: line.slice(1),
          type: "removed",
          oldLineNumber: oldLineNum++,
        });
        currentFile.deletions++;
      } else if (line.startsWith(" ") || line === "") {
        currentHunk.lines.push({
          content: line.slice(1) || "",
          type: "unchanged",
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      }
    }
  }

  if (currentFile) {
    diffs.push(currentFile);
  }

  return diffs;
}

/**
 * Create a diff from old and new content
 */
export function createDiff(
  filePath: string,
  oldContent: string,
  newContent: string
): FileDiff {
  const oldLines = oldContent === "" ? [] : oldContent.split("\n");
  const newLines = newContent === "" ? [] : newContent.split("\n");

  const diffLines: DiffLine[] = [];
  let additions = 0;
  let deletions = 0;

  // Simple line-by-line diff using LCS
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (const match of lcs) {
    // Add removed lines
    while (oldIdx < match.oldIndex) {
      diffLines.push({
        content: oldLines[oldIdx],
        type: "removed",
        oldLineNumber: oldLineNum++,
      });
      deletions++;
      oldIdx++;
    }

    // Add added lines
    while (newIdx < match.newIndex) {
      diffLines.push({
        content: newLines[newIdx],
        type: "added",
        newLineNumber: newLineNum++,
      });
      additions++;
      newIdx++;
    }

    // Add unchanged line
    diffLines.push({
      content: oldLines[oldIdx],
      type: "unchanged",
      oldLineNumber: oldLineNum++,
      newLineNumber: newLineNum++,
    });
    oldIdx++;
    newIdx++;
  }

  // Remaining removed lines
  while (oldIdx < oldLines.length) {
    diffLines.push({
      content: oldLines[oldIdx],
      type: "removed",
      oldLineNumber: oldLineNum++,
    });
    deletions++;
    oldIdx++;
  }

  // Remaining added lines
  while (newIdx < newLines.length) {
    diffLines.push({
      content: newLines[newIdx],
      type: "added",
      newLineNumber: newLineNum++,
    });
    additions++;
    newIdx++;
  }

  // Group into hunks
  const hunks = groupIntoHunks(diffLines);

  return {
    filePath,
    isNew: oldContent === "",
    isDeleted: newContent === "",
    isRename: false,
    hunks,
    additions,
    deletions,
  };
}

/** LCS match */
interface LCSMatch {
  oldIndex: number;
  newIndex: number;
}

/**
 * Compute Longest Common Subsequence
 */
function computeLCS(oldLines: string[], newLines: string[]): LCSMatch[] {
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matches
  const matches: LCSMatch[] = [];
  let i = m;
  let j = n;

  while (i > 0 && j > 0) {
    if (oldLines[i - 1] === newLines[j - 1]) {
      matches.unshift({ oldIndex: i - 1, newIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

/**
 * Group diff lines into hunks
 */
export function groupIntoHunks(
  lines: DiffLine[],
  contextLines: number = 3
): DiffHunk[] {
  if (lines.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;
  let unchangedBuffer: DiffLine[] = [];

  for (const line of lines) {
    if (line.type === "unchanged" || line.type === "context") {
      unchangedBuffer.push(line);

      // If buffer exceeds 2 * contextLines, we might split hunks
      if (unchangedBuffer.length > contextLines * 2 && currentHunk) {
        // Add trailing context to current hunk
        for (let i = 0; i < contextLines && i < unchangedBuffer.length; i++) {
          currentHunk.lines.push(unchangedBuffer[i]);
        }
        // Start new hunk later
        currentHunk = null;
        // Keep only leading context for next hunk
        unchangedBuffer = unchangedBuffer.slice(-contextLines);
      }
    } else {
      // Change line - start or continue hunk
      if (!currentHunk) {
        const firstOld = unchangedBuffer[0]?.oldLineNumber ?? line.oldLineNumber ?? 1;
        const firstNew = unchangedBuffer[0]?.newLineNumber ?? line.newLineNumber ?? 1;
        currentHunk = {
          header: `@@ -${firstOld},0 +${firstNew},0 @@`,
          lines: [...unchangedBuffer],
          oldStart: firstOld,
          oldCount: 0,
          newStart: firstNew,
          newCount: 0,
        };
        hunks.push(currentHunk);
      } else {
        // Add buffered unchanged lines
        currentHunk.lines.push(...unchangedBuffer);
      }
      unchangedBuffer = [];
      currentHunk.lines.push(line);
    }
  }

  // Add remaining buffer as trailing context
  if (currentHunk && unchangedBuffer.length > 0) {
    const trailing = unchangedBuffer.slice(0, contextLines);
    currentHunk.lines.push(...trailing);
  }

  // Update hunk headers with correct counts
  for (const hunk of hunks) {
    let oldCount = 0;
    let newCount = 0;
    for (const line of hunk.lines) {
      if (line.type === "removed" || line.type === "unchanged" || line.type === "context") {
        oldCount++;
      }
      if (line.type === "added" || line.type === "unchanged" || line.type === "context") {
        newCount++;
      }
    }
    hunk.oldCount = oldCount;
    hunk.newCount = newCount;
    hunk.header = `@@ -${hunk.oldStart},${oldCount} +${hunk.newStart},${newCount} @@`;
  }

  return hunks;
}

/**
 * Render a diff line to text
 */
export function renderLineText(line: DiffLine): string {
  const prefix = LINE_PREFIXES[line.type];
  return `${prefix}${line.content}`;
}

/**
 * Render a diff line to HTML
 */
export function renderLineHtml(
  line: DiffLine,
  colors: DiffColors = DEFAULT_COLORS,
  showLineNumbers: boolean = true
): string {
  const prefix = LINE_PREFIXES[line.type];
  const cssClass = CSS_CLASSES[line.type];

  let color: string;
  let bgColor: string;

  switch (line.type) {
    case "added":
      color = colors.added;
      bgColor = colors.addedBackground;
      break;
    case "removed":
      color = colors.removed;
      bgColor = colors.removedBackground;
      break;
    default:
      color = colors.unchanged;
      bgColor = colors.unchangedBackground;
  }

  const lineNumOld = line.oldLineNumber?.toString().padStart(4, " ") ?? "    ";
  const lineNumNew = line.newLineNumber?.toString().padStart(4, " ") ?? "    ";
  const lineNums = showLineNumbers
    ? `<span style="color:${colors.lineNumber}">${lineNumOld} ${lineNumNew}</span> `
    : "";

  const escapedContent = escapeHtml(line.content);

  return `<div class="${cssClass}" style="color:${color};background:${bgColor}">${lineNums}<span>${prefix}</span>${escapedContent}</div>`;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Get line color for type
 */
export function getLineColor(
  type: LineChangeType,
  colors: DiffColors = DEFAULT_COLORS
): { color: string; background: string } {
  switch (type) {
    case "added":
      return { color: colors.added, background: colors.addedBackground };
    case "removed":
      return { color: colors.removed, background: colors.removedBackground };
    default:
      return { color: colors.unchanged, background: colors.unchangedBackground };
  }
}

/**
 * Format diff statistics
 */
export function formatDiffStats(additions: number, deletions: number): string {
  const parts: string[] = [];
  if (additions > 0) {
    parts.push(`+${additions}`);
  }
  if (deletions > 0) {
    parts.push(`-${deletions}`);
  }
  return parts.join(" ") || "no changes";
}

// ============================================================================
// FileDiffDisplay Class
// ============================================================================

/**
 * File diff display manager for chat messages
 */
export class FileDiffDisplay {
  private diffs: Map<string, FileDiff> = new Map();
  private expandedFiles: Set<string> = new Set();
  private collapsedHunks: Set<string> = new Set();
  private options: Required<DiffDisplayOptions>;
  private colors: DiffColors;
  private callbacks: Set<DisplayStateCallback> = new Set();
  private disposed = false;

  constructor(options: DiffDisplayOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.colors = { ...DEFAULT_COLORS, ...options.colors };
  }

  /**
   * Add a file diff
   */
  addDiff(diff: FileDiff): void {
    if (this.disposed) {
      throw new Error("FileDiffDisplay is disposed");
    }

    this.diffs.set(diff.filePath, diff);
    this.expandedFiles.add(diff.filePath);
    this.notifyChange();
  }

  /**
   * Add multiple diffs
   */
  addDiffs(diffs: FileDiff[]): void {
    if (this.disposed) {
      throw new Error("FileDiffDisplay is disposed");
    }

    for (const diff of diffs) {
      this.diffs.set(diff.filePath, diff);
      this.expandedFiles.add(diff.filePath);
    }
    this.notifyChange();
  }

  /**
   * Create and add diff from content
   */
  createAndAddDiff(
    filePath: string,
    oldContent: string,
    newContent: string
  ): FileDiff {
    const diff = createDiff(filePath, oldContent, newContent);
    this.addDiff(diff);
    return diff;
  }

  /**
   * Parse and add diffs from unified diff text
   */
  parseAndAddDiffs(diffText: string): FileDiff[] {
    const diffs = parseUnifiedDiff(diffText);
    this.addDiffs(diffs);
    return diffs;
  }

  /**
   * Remove a diff
   */
  removeDiff(filePath: string): boolean {
    const removed = this.diffs.delete(filePath);
    if (removed) {
      this.expandedFiles.delete(filePath);
      this.notifyChange();
    }
    return removed;
  }

  /**
   * Clear all diffs
   */
  clearDiffs(): void {
    this.diffs.clear();
    this.expandedFiles.clear();
    this.collapsedHunks.clear();
    this.notifyChange();
  }

  /**
   * Get a diff by file path
   */
  getDiff(filePath: string): FileDiff | undefined {
    return this.diffs.get(filePath);
  }

  /**
   * Get all diffs
   */
  getAllDiffs(): FileDiff[] {
    return Array.from(this.diffs.values());
  }

  /**
   * Toggle file expansion
   */
  toggleFileExpanded(filePath: string): boolean {
    if (this.expandedFiles.has(filePath)) {
      this.expandedFiles.delete(filePath);
    } else {
      this.expandedFiles.add(filePath);
    }
    this.notifyChange();
    return this.expandedFiles.has(filePath);
  }

  /**
   * Check if file is expanded
   */
  isFileExpanded(filePath: string): boolean {
    return this.expandedFiles.has(filePath);
  }

  /**
   * Render a diff to structured output
   */
  renderDiff(filePath: string): RenderedDiff | null {
    const diff = this.diffs.get(filePath);
    if (!diff) return null;

    const lines: RenderedLine[] = [];
    let additions = 0;
    let deletions = 0;
    let unchanged = 0;

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        const { color, background } = getLineColor(line.type, this.colors);
        const prefix = LINE_PREFIXES[line.type];

        lines.push({
          text: `${prefix}${line.content}`,
          html: renderLineHtml(line, this.colors, this.options.showLineNumbers),
          classes: [CSS_CLASSES[line.type]],
          styles: { color, background },
          type: line.type,
          oldLineNumber: line.oldLineNumber,
          newLineNumber: line.newLineNumber,
        });

        switch (line.type) {
          case "added":
            additions++;
            break;
          case "removed":
            deletions++;
            break;
          default:
            unchanged++;
        }
      }
    }

    const html = lines.map((l) => l.html).join("\n");

    return {
      filePath,
      lines,
      html,
      stats: { additions, deletions, unchanged },
    };
  }

  /**
   * Render all diffs
   */
  renderAllDiffs(): RenderedDiff[] {
    const rendered: RenderedDiff[] = [];
    for (const filePath of this.diffs.keys()) {
      const diff = this.renderDiff(filePath);
      if (diff) {
        rendered.push(diff);
      }
    }
    return rendered;
  }

  /**
   * Get combined statistics
   */
  getStats(): { additions: number; deletions: number; files: number } {
    let additions = 0;
    let deletions = 0;
    for (const diff of this.diffs.values()) {
      additions += diff.additions;
      deletions += diff.deletions;
    }
    return { additions, deletions, files: this.diffs.size };
  }

  /**
   * Set colors
   */
  setColors(colors: Partial<DiffColors>): void {
    if (this.disposed) {
      throw new Error("FileDiffDisplay is disposed");
    }
    this.colors = { ...this.colors, ...colors };
    this.notifyChange();
  }

  /**
   * Get current colors
   */
  getColors(): DiffColors {
    return { ...this.colors };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: DisplayStateCallback): () => void {
    if (this.disposed) {
      throw new Error("FileDiffDisplay is disposed");
    }

    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify callbacks
   */
  private notifyChange(): void {
    const state: FileDiffDisplayState = {
      diffs: this.getAllDiffs(),
      expandedFiles: new Set(this.expandedFiles),
      collapsedHunks: new Set(this.collapsedHunks),
    };

    for (const callback of this.callbacks) {
      try {
        callback(state);
      } catch (err) {
        console.error("FileDiffDisplay callback error:", err);
      }
    }
  }

  /**
   * Check if disposed
   */
  isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Dispose
   */
  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.callbacks.clear();
    this.diffs.clear();
    this.expandedFiles.clear();
    this.collapsedHunks.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new FileDiffDisplay instance
 */
export function createFileDiffDisplay(
  options?: DiffDisplayOptions
): FileDiffDisplay {
  return new FileDiffDisplay(options);
}
