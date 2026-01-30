/**
 * VersionDiffView — Version diff view showing before/after changes.
 *
 * Feature #106: Implement version diff view showing before/after changes
 * Verification: Side-by-side or unified diff view of all changed files
 *
 * Provides diff computation and visualization for comparing file versions
 * with support for side-by-side and unified view modes.
 *
 * @module lib/preview/version-diff-view
 */

// =============================================================================
// Types
// =============================================================================

/** Diff view mode */
export type DiffViewMode = "side-by-side" | "unified" | "inline";

/** Change type for diff lines */
export type ChangeType = "unchanged" | "added" | "removed" | "modified";

/** Individual diff line */
export interface DiffLine {
  /** Line number in original (undefined if added) */
  oldLineNumber?: number;
  /** Line number in new version (undefined if removed) */
  newLineNumber?: number;
  /** Line content */
  content: string;
  /** Type of change */
  type: ChangeType;
  /** Whether line is part of a context block */
  isContext?: boolean;
}

/** Diff hunk (group of changes) */
export interface DiffHunk {
  /** Starting line in original */
  oldStart: number;
  /** Number of lines in original */
  oldLines: number;
  /** Starting line in new version */
  newStart: number;
  /** Number of lines in new version */
  newLines: number;
  /** Lines in this hunk */
  lines: DiffLine[];
  /** Hunk header (e.g., @@ -1,5 +1,6 @@) */
  header: string;
}

/** File diff result */
export interface FileDiff {
  /** File path */
  path: string;
  /** Original filename (if renamed) */
  oldPath?: string;
  /** Whether file is new */
  isNew: boolean;
  /** Whether file is deleted */
  isDeleted: boolean;
  /** Whether file is renamed */
  isRenamed: boolean;
  /** Whether file is binary */
  isBinary: boolean;
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Statistics */
  stats: DiffStats;
}

/** Diff statistics */
export interface DiffStats {
  /** Lines added */
  additions: number;
  /** Lines removed */
  deletions: number;
  /** Total changes */
  total: number;
}

/** Version info for diff */
export interface VersionInfo {
  /** Version ID */
  id: string;
  /** Version label */
  label: string;
  /** Version timestamp */
  timestamp: number;
  /** File contents by path */
  files: Map<string, string>;
}

/** Diff view state */
export interface DiffViewState {
  /** Current view mode */
  mode: DiffViewMode;
  /** Old version info */
  oldVersion: VersionInfo | null;
  /** New version info */
  newVersion: VersionInfo | null;
  /** Computed file diffs */
  fileDiffs: FileDiff[];
  /** Currently selected file */
  selectedFile: string | null;
  /** Number of context lines */
  contextLines: number;
  /** Whether diff is loading */
  loading: boolean;
  /** Total statistics */
  totalStats: DiffStats;
}

/** Diff view options */
export interface DiffViewOptions {
  /** Initial view mode (default: 'unified') */
  mode?: DiffViewMode;
  /** Number of context lines (default: 3) */
  contextLines?: number;
  /** Ignore whitespace changes (default: false) */
  ignoreWhitespace?: boolean;
  /** Word-level diff (default: true) */
  wordDiff?: boolean;
}

/** Style configuration for diff rendering */
export interface DiffStyles {
  /** Container classes */
  container: string;
  /** Header classes */
  header: string;
  /** Line number classes */
  lineNumber: string;
  /** Added line classes */
  added: string;
  /** Removed line classes */
  removed: string;
  /** Unchanged line classes */
  unchanged: string;
  /** Modified line classes */
  modified: string;
  /** Hunk header classes */
  hunkHeader: string;
}

/** State change callback */
export type StateChangeCallback = (state: DiffViewState) => void;

/** File select callback */
export type FileSelectCallback = (path: string) => void;

// =============================================================================
// Constants
// =============================================================================

/** Default options */
const DEFAULT_OPTIONS: Required<DiffViewOptions> = {
  mode: "unified",
  contextLines: 3,
  ignoreWhitespace: false,
  wordDiff: true,
};

/** Default diff styles (Tailwind classes) */
export const DIFF_STYLES: DiffStyles = {
  container: "font-mono text-sm overflow-auto",
  header: "bg-gray-100 dark:bg-gray-800 px-4 py-2 font-semibold border-b",
  lineNumber: "text-gray-400 select-none w-12 text-right pr-2",
  added: "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200",
  removed: "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200",
  unchanged: "text-gray-700 dark:text-gray-300",
  modified: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200",
  hunkHeader: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 px-4 py-1",
};

// =============================================================================
// Diff Algorithm (Myers' algorithm simplified)
// =============================================================================

/**
 * Computes the longest common subsequence between two arrays.
 */
function computeLCS<T>(a: T[], b: T[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp;
}

/**
 * Backtracks through LCS matrix to build diff.
 */
function backtrackDiff(
  dp: number[][],
  oldLines: string[],
  newLines: string[],
  i: number,
  j: number,
  result: DiffLine[]
): void {
  if (i === 0 && j === 0) {
    return;
  }

  if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
    backtrackDiff(dp, oldLines, newLines, i - 1, j - 1, result);
    result.push({
      oldLineNumber: i,
      newLineNumber: j,
      content: oldLines[i - 1],
      type: "unchanged",
    });
  } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
    backtrackDiff(dp, oldLines, newLines, i, j - 1, result);
    result.push({
      newLineNumber: j,
      content: newLines[j - 1],
      type: "added",
    });
  } else if (i > 0) {
    backtrackDiff(dp, oldLines, newLines, i - 1, j, result);
    result.push({
      oldLineNumber: i,
      content: oldLines[i - 1],
      type: "removed",
    });
  }
}

/**
 * Computes diff between two strings.
 */
export function computeDiff(
  oldContent: string,
  newContent: string,
  options: { ignoreWhitespace?: boolean } = {}
): DiffLine[] {
  // Handle empty strings - both empty means no diff
  if (oldContent === "" && newContent === "") {
    return [];
  }

  const normalizeWhitespace = (s: string) =>
    options.ignoreWhitespace ? s.replace(/\s+/g, " ").trim() : s;

  // Empty string = no lines, not one empty line
  const oldLines = oldContent === "" ? [] : oldContent.split("\n");
  const newLines = newContent === "" ? [] : newContent.split("\n");

  const normalizedOld = oldLines.map(normalizeWhitespace);
  const normalizedNew = newLines.map(normalizeWhitespace);

  // Use normalized versions for LCS computation
  const dp = computeLCS(normalizedOld, normalizedNew);
  const result: DiffLine[] = [];

  // Pass normalized versions for comparison but original for content
  backtrackDiffWithNormalized(
    dp,
    oldLines,
    newLines,
    normalizedOld,
    normalizedNew,
    oldLines.length,
    newLines.length,
    result
  );

  return result;
}

/**
 * Backtracks through LCS matrix using normalized comparison.
 */
function backtrackDiffWithNormalized(
  dp: number[][],
  oldLines: string[],
  newLines: string[],
  normalizedOld: string[],
  normalizedNew: string[],
  i: number,
  j: number,
  result: DiffLine[]
): void {
  if (i === 0 && j === 0) {
    return;
  }

  // Compare using normalized versions
  if (i > 0 && j > 0 && normalizedOld[i - 1] === normalizedNew[j - 1]) {
    backtrackDiffWithNormalized(
      dp, oldLines, newLines, normalizedOld, normalizedNew,
      i - 1, j - 1, result
    );
    result.push({
      oldLineNumber: i,
      newLineNumber: j,
      content: oldLines[i - 1], // Output original content
      type: "unchanged",
    });
  } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
    backtrackDiffWithNormalized(
      dp, oldLines, newLines, normalizedOld, normalizedNew,
      i, j - 1, result
    );
    result.push({
      newLineNumber: j,
      content: newLines[j - 1],
      type: "added",
    });
  } else if (i > 0) {
    backtrackDiffWithNormalized(
      dp, oldLines, newLines, normalizedOld, normalizedNew,
      i - 1, j, result
    );
    result.push({
      oldLineNumber: i,
      content: oldLines[i - 1],
      type: "removed",
    });
  }
}

/**
 * Groups diff lines into hunks with context.
 */
export function groupIntoHunks(
  lines: DiffLine[],
  contextLines: number = 3
): DiffHunk[] {
  if (lines.length === 0) return [];

  const hunks: DiffHunk[] = [];
  let currentHunk: DiffLine[] = [];
  let hunkOldStart = 0;
  let hunkNewStart = 0;
  let unchangedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isChange = line.type !== "unchanged";

    if (isChange) {
      // Include preceding context
      const contextStart = Math.max(0, currentHunk.length - contextLines);
      if (currentHunk.length === 0 && i > 0) {
        // Start new hunk with context
        const startIdx = Math.max(0, i - contextLines);
        for (let j = startIdx; j < i; j++) {
          const contextLine = { ...lines[j], isContext: true };
          currentHunk.push(contextLine);
        }
        hunkOldStart = lines[startIdx].oldLineNumber ?? 1;
        hunkNewStart = lines[startIdx].newLineNumber ?? 1;
      }

      currentHunk.push(line);
      unchangedCount = 0;
    } else {
      if (currentHunk.length > 0) {
        unchangedCount++;

        if (unchangedCount <= contextLines * 2) {
          currentHunk.push({ ...line, isContext: true });
        }

        // End hunk if too many unchanged lines
        if (unchangedCount > contextLines * 2) {
          // Trim trailing context
          while (
            currentHunk.length > 0 &&
            currentHunk[currentHunk.length - 1].type === "unchanged" &&
            currentHunk.filter((l) => l.type === "unchanged" && l.isContext).length >
              contextLines
          ) {
            currentHunk.pop();
          }

          if (currentHunk.some((l) => l.type !== "unchanged")) {
            hunks.push(createHunk(currentHunk, hunkOldStart, hunkNewStart));
          }
          currentHunk = [];
          unchangedCount = 0;
        }
      }
    }
  }

  // Final hunk
  if (currentHunk.some((l) => l.type !== "unchanged")) {
    // Trim trailing context
    while (
      currentHunk.length > 0 &&
      currentHunk[currentHunk.length - 1].type === "unchanged" &&
      currentHunk.filter((l) => l.type === "unchanged" && l.isContext).length >
        contextLines
    ) {
      currentHunk.pop();
    }
    hunks.push(createHunk(currentHunk, hunkOldStart, hunkNewStart));
  }

  return hunks;
}

/**
 * Creates a hunk from lines.
 */
function createHunk(
  lines: DiffLine[],
  oldStart: number,
  newStart: number
): DiffHunk {
  const oldLines = lines.filter(
    (l) => l.type === "removed" || l.type === "unchanged"
  ).length;
  const newLines = lines.filter(
    (l) => l.type === "added" || l.type === "unchanged"
  ).length;

  return {
    oldStart: oldStart || 1,
    oldLines,
    newStart: newStart || 1,
    newLines,
    lines,
    header: `@@ -${oldStart || 1},${oldLines} +${newStart || 1},${newLines} @@`,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculates diff statistics.
 */
export function calculateStats(lines: DiffLine[]): DiffStats {
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.type === "added") additions++;
    if (line.type === "removed") deletions++;
  }

  return { additions, deletions, total: additions + deletions };
}

/**
 * Formats line number for display.
 */
export function formatLineNumber(num: number | undefined): string {
  return num !== undefined ? String(num) : "";
}

/**
 * Gets CSS class for change type.
 */
export function getChangeTypeClass(type: ChangeType, styles: DiffStyles = DIFF_STYLES): string {
  switch (type) {
    case "added":
      return styles.added;
    case "removed":
      return styles.removed;
    case "modified":
      return styles.modified;
    case "unchanged":
    default:
      return styles.unchanged;
  }
}

/**
 * Gets prefix symbol for change type.
 */
export function getChangePrefix(type: ChangeType): string {
  switch (type) {
    case "added":
      return "+";
    case "removed":
      return "-";
    default:
      return " ";
  }
}

/**
 * Formats unified diff output.
 */
export function formatUnifiedDiff(diff: FileDiff): string {
  const lines: string[] = [];

  // File header
  lines.push(`--- a/${diff.oldPath ?? diff.path}`);
  lines.push(`+++ b/${diff.path}`);

  // Hunks
  for (const hunk of diff.hunks) {
    lines.push(hunk.header);
    for (const line of hunk.lines) {
      lines.push(`${getChangePrefix(line.type)}${line.content}`);
    }
  }

  return lines.join("\n");
}

/**
 * Parses unified diff format.
 */
export function parseUnifiedDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = diffText.split("\n");
  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of lines) {
    if (line.startsWith("--- ")) {
      if (currentFile) files.push(currentFile);
      currentFile = {
        path: line.slice(6),
        isNew: false,
        isDeleted: false,
        isRenamed: false,
        isBinary: false,
        hunks: [],
        stats: { additions: 0, deletions: 0, total: 0 },
      };
    } else if (line.startsWith("+++ ") && currentFile) {
      currentFile.path = line.slice(6);
    } else if (line.startsWith("@@ ") && currentFile) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[3], 10);
        currentHunk = {
          oldStart: oldLineNum,
          oldLines: parseInt(match[2] || "1", 10),
          newStart: newLineNum,
          newLines: parseInt(match[4] || "1", 10),
          lines: [],
          header: line,
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({
          newLineNumber: newLineNum++,
          content: line.slice(1),
          type: "added",
        });
        currentFile!.stats.additions++;
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({
          oldLineNumber: oldLineNum++,
          content: line.slice(1),
          type: "removed",
        });
        currentFile!.stats.deletions++;
      } else if (line.startsWith(" ") || line === "") {
        currentHunk.lines.push({
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
          content: line.slice(1) || "",
          type: "unchanged",
        });
      }
    }
  }

  if (currentFile) files.push(currentFile);

  // Calculate totals
  for (const file of files) {
    file.stats.total = file.stats.additions + file.stats.deletions;
  }

  return files;
}

// =============================================================================
// VersionDiffView Class
// =============================================================================

/**
 * VersionDiffView — Diff view for comparing file versions.
 *
 * @example
 * ```typescript
 * const diffView = new VersionDiffView({ mode: 'unified' });
 *
 * // Set versions to compare
 * diffView.setVersions(oldVersion, newVersion);
 *
 * // Get computed diffs
 * const state = diffView.getState();
 * console.log(state.fileDiffs);
 *
 * // Switch view mode
 * diffView.setMode('side-by-side');
 *
 * // Listen for changes
 * diffView.onStateChange((state) => {
 *   updateUI(state);
 * });
 * ```
 */
export class VersionDiffView {
  private options: Required<DiffViewOptions>;
  private state: DiffViewState;
  private stateCallbacks = new Set<StateChangeCallback>();
  private fileSelectCallbacks = new Set<FileSelectCallback>();
  private disposed = false;

  constructor(options: DiffViewOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.state = {
      mode: this.options.mode,
      oldVersion: null,
      newVersion: null,
      fileDiffs: [],
      selectedFile: null,
      contextLines: this.options.contextLines,
      loading: false,
      totalStats: { additions: 0, deletions: 0, total: 0 },
    };
  }

  // ---------------------------------------------------------------------------
  // Version Management
  // ---------------------------------------------------------------------------

  /**
   * Sets versions to compare.
   */
  setVersions(oldVersion: VersionInfo, newVersion: VersionInfo): void {
    if (this.disposed) return;

    this.state.oldVersion = oldVersion;
    this.state.newVersion = newVersion;
    this.state.loading = true;
    this.notifyStateChange();

    this.computeDiffs();

    this.state.loading = false;
    this.notifyStateChange();
  }

  /**
   * Computes diffs for all files.
   */
  private computeDiffs(): void {
    if (!this.state.oldVersion || !this.state.newVersion) return;

    const oldFiles = this.state.oldVersion.files;
    const newFiles = this.state.newVersion.files;

    // Collect all file paths
    const allPaths = new Set<string>([...oldFiles.keys(), ...newFiles.keys()]);

    const fileDiffs: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const path of allPaths) {
      const oldContent = oldFiles.get(path) ?? "";
      const newContent = newFiles.get(path) ?? "";

      const isNew = !oldFiles.has(path);
      const isDeleted = !newFiles.has(path);

      // Skip if no changes
      if (oldContent === newContent) continue;

      // Compute diff
      const diffLines = computeDiff(oldContent, newContent, {
        ignoreWhitespace: this.options.ignoreWhitespace,
      });

      const hunks = groupIntoHunks(diffLines, this.options.contextLines);
      const stats = calculateStats(diffLines);

      fileDiffs.push({
        path,
        isNew,
        isDeleted,
        isRenamed: false,
        isBinary: false,
        hunks,
        stats,
      });

      totalAdditions += stats.additions;
      totalDeletions += stats.deletions;
    }

    // Sort by path
    fileDiffs.sort((a, b) => a.path.localeCompare(b.path));

    this.state.fileDiffs = fileDiffs;
    this.state.totalStats = {
      additions: totalAdditions,
      deletions: totalDeletions,
      total: totalAdditions + totalDeletions,
    };

    // Select first file if none selected
    if (!this.state.selectedFile && fileDiffs.length > 0) {
      this.state.selectedFile = fileDiffs[0].path;
    }
  }

  /**
   * Clears versions and diffs.
   */
  clear(): void {
    if (this.disposed) return;

    this.state.oldVersion = null;
    this.state.newVersion = null;
    this.state.fileDiffs = [];
    this.state.selectedFile = null;
    this.state.totalStats = { additions: 0, deletions: 0, total: 0 };

    this.notifyStateChange();
  }

  // ---------------------------------------------------------------------------
  // View Mode
  // ---------------------------------------------------------------------------

  /**
   * Sets the diff view mode.
   */
  setMode(mode: DiffViewMode): void {
    if (this.disposed) return;

    this.state.mode = mode;
    this.notifyStateChange();
  }

  /**
   * Gets the current view mode.
   */
  getMode(): DiffViewMode {
    return this.state.mode;
  }

  /**
   * Sets number of context lines.
   */
  setContextLines(lines: number): void {
    if (this.disposed) return;

    this.state.contextLines = Math.max(0, lines);
    this.options.contextLines = this.state.contextLines;

    // Recompute diffs with new context
    this.computeDiffs();
    this.notifyStateChange();
  }

  // ---------------------------------------------------------------------------
  // File Selection
  // ---------------------------------------------------------------------------

  /**
   * Selects a file to view.
   */
  selectFile(path: string): void {
    if (this.disposed) return;

    const exists = this.state.fileDiffs.some((f) => f.path === path);
    if (!exists) return;

    this.state.selectedFile = path;
    this.notifyStateChange();
    this.notifyFileSelect(path);
  }

  /**
   * Gets the currently selected file diff.
   */
  getSelectedFileDiff(): FileDiff | undefined {
    if (!this.state.selectedFile) return undefined;
    return this.state.fileDiffs.find((f) => f.path === this.state.selectedFile);
  }

  /**
   * Navigates to next file.
   */
  nextFile(): void {
    if (this.disposed || this.state.fileDiffs.length === 0) return;

    const currentIndex = this.state.fileDiffs.findIndex(
      (f) => f.path === this.state.selectedFile
    );
    const nextIndex = (currentIndex + 1) % this.state.fileDiffs.length;
    this.selectFile(this.state.fileDiffs[nextIndex].path);
  }

  /**
   * Navigates to previous file.
   */
  previousFile(): void {
    if (this.disposed || this.state.fileDiffs.length === 0) return;

    const currentIndex = this.state.fileDiffs.findIndex(
      (f) => f.path === this.state.selectedFile
    );
    const prevIndex =
      currentIndex <= 0
        ? this.state.fileDiffs.length - 1
        : currentIndex - 1;
    this.selectFile(this.state.fileDiffs[prevIndex].path);
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Gets current state.
   */
  getState(): DiffViewState {
    return { ...this.state };
  }

  /**
   * Gets all file diffs.
   */
  getFileDiffs(): FileDiff[] {
    return [...this.state.fileDiffs];
  }

  /**
   * Gets total statistics.
   */
  getTotalStats(): DiffStats {
    return { ...this.state.totalStats };
  }

  /**
   * Checks if loading.
   */
  isLoading(): boolean {
    return this.state.loading;
  }

  /**
   * Checks if there are any changes.
   */
  hasChanges(): boolean {
    return this.state.fileDiffs.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Rendering Helpers
  // ---------------------------------------------------------------------------

  /**
   * Gets side-by-side view data for selected file.
   */
  getSideBySideData(): { left: DiffLine[]; right: DiffLine[] } | undefined {
    const diff = this.getSelectedFileDiff();
    if (!diff) return undefined;

    const left: DiffLine[] = [];
    const right: DiffLine[] = [];

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "unchanged") {
          left.push(line);
          right.push(line);
        } else if (line.type === "removed") {
          left.push(line);
          right.push({
            content: "",
            type: "unchanged",
            isContext: true,
          });
        } else if (line.type === "added") {
          left.push({
            content: "",
            type: "unchanged",
            isContext: true,
          });
          right.push(line);
        }
      }
    }

    return { left, right };
  }

  /**
   * Gets unified view data for selected file.
   */
  getUnifiedData(): DiffLine[] {
    const diff = this.getSelectedFileDiff();
    if (!diff) return [];

    const lines: DiffLine[] = [];
    for (const hunk of diff.hunks) {
      lines.push(...hunk.lines);
    }
    return lines;
  }

  /**
   * Gets styles for rendering.
   */
  getStyles(): DiffStyles {
    return { ...DIFF_STYLES };
  }

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /**
   * Registers a state change callback.
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateCallbacks.add(callback);
    return () => this.stateCallbacks.delete(callback);
  }

  /**
   * Registers a file select callback.
   */
  onFileSelect(callback: FileSelectCallback): () => void {
    this.fileSelectCallbacks.add(callback);
    return () => this.fileSelectCallbacks.delete(callback);
  }

  private notifyStateChange(): void {
    if (this.disposed) return;

    const state = this.getState();
    for (const callback of this.stateCallbacks) {
      try {
        callback(state);
      } catch (e) {
        console.error("VersionDiffView state callback error:", e);
      }
    }
  }

  private notifyFileSelect(path: string): void {
    if (this.disposed) return;

    for (const callback of this.fileSelectCallbacks) {
      try {
        callback(path);
      } catch (e) {
        console.error("VersionDiffView file select callback error:", e);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Disposes the diff view.
   */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.stateCallbacks.clear();
    this.fileSelectCallbacks.clear();
    this.state.fileDiffs = [];
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a VersionDiffView instance.
 */
export function createVersionDiffView(
  options?: DiffViewOptions
): VersionDiffView {
  return new VersionDiffView(options);
}

// =============================================================================
// Export
// =============================================================================

export default VersionDiffView;
