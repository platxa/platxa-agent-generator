/**
 * Diff Visualizer
 *
 * Generates visual diffs for code changes, supporting unified diff,
 * side-by-side comparison, and various output formats.
 *
 * @module diff-visualizer
 */

import type { CodeChange, Language } from './types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Diff output format
 */
export type DiffFormat = 'unified' | 'side-by-side' | 'inline' | 'context';

/**
 * Diff output target
 */
export type DiffOutput = 'terminal' | 'markdown' | 'html' | 'plain';

/**
 * Line change type
 */
export type LineChangeType = 'add' | 'remove' | 'unchanged' | 'modify';

/**
 * Individual line in a diff
 */
export interface DiffLine {
  /** Line change type */
  type: LineChangeType;
  /** Original line number (for remove/unchanged) */
  oldLineNumber?: number;
  /** New line number (for add/unchanged) */
  newLineNumber?: number;
  /** Line content */
  content: string;
  /** Whether line has inline changes */
  hasInlineChanges?: boolean;
  /** Inline change markers (character positions) */
  inlineChanges?: Array<{ start: number; end: number; type: 'add' | 'remove' }>;
}

/**
 * Diff hunk (group of changes)
 */
export interface DiffHunk {
  /** Starting line in old file */
  oldStart: number;
  /** Number of lines in old file */
  oldCount: number;
  /** Starting line in new file */
  newStart: number;
  /** Number of lines in new file */
  newCount: number;
  /** Lines in this hunk */
  lines: DiffLine[];
  /** Hunk header (e.g., @@ -1,5 +1,6 @@) */
  header: string;
}

/**
 * Complete diff for a file
 */
export interface FileDiff {
  /** File path */
  filePath: string;
  /** Original file path (if renamed) */
  originalPath?: string;
  /** Language for syntax highlighting */
  language: Language;
  /** Change type */
  changeType: 'add' | 'modify' | 'delete' | 'rename';
  /** Diff hunks */
  hunks: DiffHunk[];
  /** Total lines added */
  additions: number;
  /** Total lines removed */
  deletions: number;
  /** Diff header */
  header: string;
}

/**
 * Side-by-side diff pair
 */
export interface SideBySideLine {
  /** Left side (old) */
  left?: {
    lineNumber: number;
    content: string;
    type: LineChangeType;
  };
  /** Right side (new) */
  right?: {
    lineNumber: number;
    content: string;
    type: LineChangeType;
  };
}

/**
 * Visualization result
 */
export interface DiffVisualization {
  /** File diffs */
  files: FileDiff[];
  /** Formatted output */
  output: string;
  /** Total additions across all files */
  totalAdditions: number;
  /** Total deletions across all files */
  totalDeletions: number;
  /** Summary line */
  summary: string;
}

/**
 * Diff visualizer configuration
 */
export interface DiffVisualizerConfig {
  /** Output format */
  format?: DiffFormat;
  /** Output target */
  output?: DiffOutput;
  /** Context lines around changes */
  contextLines?: number;
  /** Show line numbers */
  showLineNumbers?: boolean;
  /** Color output (for terminal) */
  colorize?: boolean;
  /** Word-level diff for modified lines */
  wordDiff?: boolean;
  /** Maximum line width */
  maxLineWidth?: number;
}

// =============================================================================
// Diff Visualizer Implementation
// =============================================================================

/**
 * Generates visual diffs for code changes.
 */
export class DiffVisualizer {
  private readonly config: Required<DiffVisualizerConfig>;

  constructor(config: Partial<DiffVisualizerConfig> = {}) {
    this.config = {
      format: config.format ?? 'unified',
      output: config.output ?? 'terminal',
      contextLines: config.contextLines ?? 3,
      showLineNumbers: config.showLineNumbers ?? true,
      colorize: config.colorize ?? true,
      wordDiff: config.wordDiff ?? false,
      maxLineWidth: config.maxLineWidth ?? 120,
    };
  }

  /**
   * Generate diff visualization for code changes.
   */
  visualize(
    changes: CodeChange[],
    originalContents: Map<string, string>,
    language: Language
  ): DiffVisualization {
    const files: FileDiff[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;

    for (const change of changes) {
      const originalContent = originalContents.get(change.file) ?? '';
      const fileDiff = this.generateFileDiff(change, originalContent, language);
      files.push(fileDiff);
      totalAdditions += fileDiff.additions;
      totalDeletions += fileDiff.deletions;
    }

    const output = this.formatOutput(files);
    const summary = this.generateSummary(files, totalAdditions, totalDeletions);

    return {
      files,
      output,
      totalAdditions,
      totalDeletions,
      summary,
    };
  }

  /**
   * Generate unified diff string.
   */
  generateUnifiedDiff(
    oldContent: string,
    newContent: string,
    filePath: string,
    language: Language
  ): string {
    const change: CodeChange = {
      file: filePath,
      type: 'replace',
      start: { line: 1, column: 1 },
      newContent,
      originalContent: oldContent,
    };

    const fileDiff = this.generateFileDiff(change, oldContent, language);
    return this.formatUnified(fileDiff);
  }

  /**
   * Generate side-by-side diff.
   */
  generateSideBySide(
    oldContent: string,
    newContent: string,
    _filePath: string
  ): SideBySideLine[] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const result: SideBySideLine[] = [];

    const lcs = this.computeLCS(oldLines, newLines);
    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
        // Unchanged line
        result.push({
          left: {
            lineNumber: oldIdx + 1,
            content: oldLines[oldIdx]!,
            type: 'unchanged',
          },
          right: {
            lineNumber: newIdx + 1,
            content: newLines[newIdx]!,
            type: 'unchanged',
          },
        });
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else if (newIdx < newLines.length && (lcsIdx >= lcs.length || newLines[newIdx] !== lcs[lcsIdx])) {
        // Added line
        result.push({
          right: {
            lineNumber: newIdx + 1,
            content: newLines[newIdx]!,
            type: 'add',
          },
        });
        newIdx++;
      } else if (oldIdx < oldLines.length) {
        // Removed line
        result.push({
          left: {
            lineNumber: oldIdx + 1,
            content: oldLines[oldIdx]!,
            type: 'remove',
          },
        });
        oldIdx++;
      }
    }

    return result;
  }

  // ===========================================================================
  // Diff Generation
  // ===========================================================================

  /**
   * Generate diff for a single file change.
   */
  private generateFileDiff(
    change: CodeChange,
    originalContent: string,
    language: Language
  ): FileDiff {
    const oldLines = originalContent.split('\n');
    const newContent = this.applyChange(originalContent, change);
    const newLines = newContent.split('\n');

    const hunks = this.computeHunks(oldLines, newLines);

    let additions = 0;
    let deletions = 0;

    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'add') additions++;
        if (line.type === 'remove') deletions++;
      }
    }

    const changeType = this.determineChangeType(change, originalContent);
    const header = this.generateFileHeader(change.file, changeType);

    return {
      filePath: change.file,
      language,
      changeType,
      hunks,
      additions,
      deletions,
      header,
    };
  }

  /**
   * Apply a change to content.
   */
  private applyChange(content: string, change: CodeChange): string {
    const lines = content.split('\n');
    const startLine = change.start.line - 1;
    const endLine = change.end !== undefined ? change.end.line - 1 : startLine;

    switch (change.type) {
      case 'replace':
        if (change.newContent !== undefined) {
          const newLines = change.newContent.split('\n');
          lines.splice(startLine, endLine - startLine + 1, ...newLines);
        }
        break;

      case 'insert':
        if (change.newContent !== undefined) {
          const newLines = change.newContent.split('\n');
          lines.splice(startLine, 0, ...newLines);
        }
        break;

      case 'delete':
        lines.splice(startLine, endLine - startLine + 1);
        break;
    }

    return lines.join('\n');
  }

  /**
   * Compute diff hunks using Myers diff algorithm.
   */
  private computeHunks(oldLines: string[], newLines: string[]): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lcs = this.computeLCS(oldLines, newLines);

    let oldIdx = 0;
    let newIdx = 0;
    let lcsIdx = 0;
    let currentHunk: DiffHunk | null = null;
    let unchangedCount = 0;

    while (oldIdx < oldLines.length || newIdx < newLines.length) {
      const isOldMatch = lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx];
      const isNewMatch = lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx];

      if (isOldMatch && isNewMatch) {
        // Unchanged line
        if (currentHunk !== null) {
          unchangedCount++;
          if (unchangedCount <= this.config.contextLines) {
            currentHunk.lines.push({
              type: 'unchanged',
              oldLineNumber: oldIdx + 1,
              newLineNumber: newIdx + 1,
              content: oldLines[oldIdx]!,
            });
            currentHunk.oldCount++;
            currentHunk.newCount++;
          } else if (unchangedCount > this.config.contextLines * 2) {
            // Close current hunk
            hunks.push(currentHunk);
            currentHunk = null;
            unchangedCount = 0;
          }
        }
        oldIdx++;
        newIdx++;
        lcsIdx++;
      } else {
        // Start new hunk if needed
        if (currentHunk === null) {
          const contextStart = Math.max(0, oldIdx - this.config.contextLines);
          currentHunk = {
            oldStart: contextStart + 1,
            oldCount: 0,
            newStart: Math.max(0, newIdx - this.config.contextLines) + 1,
            newCount: 0,
            lines: [],
            header: '',
          };

          // Add leading context
          for (let i = contextStart; i < oldIdx; i++) {
            currentHunk.lines.push({
              type: 'unchanged',
              oldLineNumber: i + 1,
              newLineNumber: currentHunk.newStart + currentHunk.lines.length,
              content: oldLines[i]!,
            });
            currentHunk.oldCount++;
            currentHunk.newCount++;
          }
        }

        unchangedCount = 0;

        if (newIdx < newLines.length && (!isNewMatch || !isOldMatch)) {
          if (!isOldMatch && oldIdx < oldLines.length) {
            // Removed line
            currentHunk.lines.push({
              type: 'remove',
              oldLineNumber: oldIdx + 1,
              content: oldLines[oldIdx]!,
            });
            currentHunk.oldCount++;
            oldIdx++;
          }
          if (!isNewMatch && newIdx < newLines.length) {
            // Added line
            currentHunk.lines.push({
              type: 'add',
              newLineNumber: newIdx + 1,
              content: newLines[newIdx]!,
            });
            currentHunk.newCount++;
            newIdx++;
          }
        } else if (oldIdx < oldLines.length) {
          // Removed line
          currentHunk.lines.push({
            type: 'remove',
            oldLineNumber: oldIdx + 1,
            content: oldLines[oldIdx]!,
          });
          currentHunk.oldCount++;
          oldIdx++;
        } else if (newIdx < newLines.length) {
          // Added line
          currentHunk.lines.push({
            type: 'add',
            newLineNumber: newIdx + 1,
            content: newLines[newIdx]!,
          });
          currentHunk.newCount++;
          newIdx++;
        }
      }
    }

    // Close final hunk
    if (currentHunk !== null && currentHunk.lines.length > 0) {
      currentHunk.header = `@@ -${currentHunk.oldStart},${currentHunk.oldCount} +${currentHunk.newStart},${currentHunk.newCount} @@`;
      hunks.push(currentHunk);
    }

    // Generate headers for all hunks
    for (const hunk of hunks) {
      if (hunk.header === '') {
        hunk.header = `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`;
      }
    }

    return hunks;
  }

  /**
   * Compute Longest Common Subsequence.
   */
  private computeLCS(oldLines: string[], newLines: string[]): string[] {
    const m = oldLines.length;
    const n = newLines.length;

    // DP table
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array.from({ length: n + 1 }, () => 0)
    );

    // Fill DP table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (oldLines[i - 1] === newLines[j - 1]) {
          dp[i]![j] = dp[i - 1]![j - 1]! + 1;
        } else {
          dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
        }
      }
    }

    // Backtrack to find LCS
    const lcs: string[] = [];
    let i = m;
    let j = n;

    while (i > 0 && j > 0) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        lcs.unshift(oldLines[i - 1]!);
        i--;
        j--;
      } else if (dp[i - 1]![j]! > dp[i]![j - 1]!) {
        i--;
      } else {
        j--;
      }
    }

    return lcs;
  }

  // ===========================================================================
  // Output Formatting
  // ===========================================================================

  /**
   * Format output based on configuration.
   */
  private formatOutput(files: FileDiff[]): string {
    switch (this.config.format) {
      case 'unified':
        return files.map(f => this.formatUnified(f)).join('\n');

      case 'side-by-side':
        return files.map(f => this.formatSideBySide(f)).join('\n');

      case 'inline':
        return files.map(f => this.formatInline(f)).join('\n');

      case 'context':
        return files.map(f => this.formatContext(f)).join('\n');

      default:
        return files.map(f => this.formatUnified(f)).join('\n');
    }
  }

  /**
   * Format as unified diff.
   */
  private formatUnified(file: FileDiff): string {
    const lines: string[] = [];

    // File header
    lines.push(file.header);

    // Hunks
    for (const hunk of file.hunks) {
      lines.push(this.colorize(hunk.header, 'cyan'));

      for (const line of hunk.lines) {
        const prefix = this.getLinePrefix(line.type);
        const color = this.getLineColor(line.type);
        const lineNum = this.config.showLineNumbers
          ? this.formatLineNumbers(line)
          : '';

        lines.push(this.colorize(`${lineNum}${prefix}${line.content}`, color));
      }
    }

    return lines.join('\n');
  }

  /**
   * Format as side-by-side diff.
   */
  private formatSideBySide(file: FileDiff): string {
    const lines: string[] = [];
    const halfWidth = Math.floor((this.config.maxLineWidth - 3) / 2);

    lines.push(file.header);

    for (const hunk of file.hunks) {
      lines.push(this.colorize(hunk.header, 'cyan'));

      // Group lines into pairs
      const pairs = this.groupIntoPairs(hunk.lines);

      for (const pair of pairs) {
        const leftNum = pair.left?.oldLineNumber?.toString().padStart(4, ' ') ?? '    ';
        const rightNum = pair.right?.newLineNumber?.toString().padStart(4, ' ') ?? '    ';

        const leftContent = this.truncate(pair.left?.content ?? '', halfWidth - 6);
        const rightContent = this.truncate(pair.right?.content ?? '', halfWidth - 6);

        const leftColor = pair.left !== undefined ? this.getLineColor(pair.left.type) : 'default';
        const rightColor = pair.right !== undefined ? this.getLineColor(pair.right.type) : 'default';

        const leftFormatted = this.colorize(
          `${leftNum} ${this.getLinePrefix(pair.left?.type ?? 'unchanged')}${leftContent}`.padEnd(halfWidth),
          leftColor
        );
        const rightFormatted = this.colorize(
          `${rightNum} ${this.getLinePrefix(pair.right?.type ?? 'unchanged')}${rightContent}`,
          rightColor
        );

        lines.push(`${leftFormatted} | ${rightFormatted}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Group diff lines into pairs for side-by-side view.
   */
  private groupIntoPairs(lines: DiffLine[]): Array<{ left?: DiffLine; right?: DiffLine }> {
    const pairs: Array<{ left?: DiffLine; right?: DiffLine }> = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i]!;

      if (line.type === 'unchanged') {
        pairs.push({ left: line, right: line });
        i++;
      } else if (line.type === 'remove') {
        // Check if next line is add (modification)
        const next = lines[i + 1];
        if (next !== undefined && next.type === 'add') {
          pairs.push({ left: line, right: next });
          i += 2;
        } else {
          pairs.push({ left: line });
          i++;
        }
      } else if (line.type === 'add') {
        pairs.push({ right: line });
        i++;
      } else {
        i++;
      }
    }

    return pairs;
  }

  /**
   * Format as inline diff.
   */
  private formatInline(file: FileDiff): string {
    const lines: string[] = [];

    lines.push(file.header);

    for (const hunk of file.hunks) {
      lines.push(this.colorize(hunk.header, 'cyan'));

      for (const line of hunk.lines) {
        if (line.type === 'unchanged') {
          lines.push(`  ${line.content}`);
        } else if (line.type === 'remove') {
          lines.push(this.colorize(`[-${line.content}-]`, 'red'));
        } else if (line.type === 'add') {
          lines.push(this.colorize(`[+${line.content}+]`, 'green'));
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Format as context diff.
   */
  private formatContext(file: FileDiff): string {
    const lines: string[] = [];

    lines.push(`*** ${file.filePath}\t(original)`);
    lines.push(`--- ${file.filePath}\t(modified)`);

    for (const hunk of file.hunks) {
      // Old section
      lines.push(`***************`);
      lines.push(`*** ${hunk.oldStart},${hunk.oldStart + hunk.oldCount - 1} ****`);

      for (const line of hunk.lines) {
        if (line.type === 'remove' || line.type === 'unchanged') {
          const prefix = line.type === 'remove' ? '- ' : '  ';
          lines.push(`${prefix}${line.content}`);
        }
      }

      // New section
      lines.push(`--- ${hunk.newStart},${hunk.newStart + hunk.newCount - 1} ----`);

      for (const line of hunk.lines) {
        if (line.type === 'add' || line.type === 'unchanged') {
          const prefix = line.type === 'add' ? '+ ' : '  ';
          lines.push(`${prefix}${line.content}`);
        }
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Output Formatting (Markdown/HTML)
  // ===========================================================================

  /**
   * Format as markdown.
   */
  formatAsMarkdown(files: FileDiff[]): string {
    const lines: string[] = [];

    for (const file of files) {
      lines.push(`### ${file.filePath}`);
      lines.push('');
      lines.push('```diff');

      for (const hunk of file.hunks) {
        lines.push(hunk.header);

        for (const line of hunk.lines) {
          const prefix = this.getLinePrefix(line.type);
          lines.push(`${prefix}${line.content}`);
        }
      }

      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format as HTML.
   */
  formatAsHtml(files: FileDiff[]): string {
    const lines: string[] = [];

    lines.push('<div class="diff-container">');

    for (const file of files) {
      lines.push(`<div class="diff-file">`);
      lines.push(`<div class="diff-header">${this.escapeHtml(file.filePath)}</div>`);
      lines.push('<table class="diff-table">');

      for (const hunk of file.hunks) {
        lines.push(`<tr class="diff-hunk-header"><td colspan="3">${this.escapeHtml(hunk.header)}</td></tr>`);

        for (const line of hunk.lines) {
          const className = `diff-line diff-${line.type}`;
          const oldNum = line.oldLineNumber?.toString() ?? '';
          const newNum = line.newLineNumber?.toString() ?? '';

          lines.push(`<tr class="${className}">`);
          lines.push(`<td class="line-num">${oldNum}</td>`);
          lines.push(`<td class="line-num">${newNum}</td>`);
          lines.push(`<td class="line-content">${this.escapeHtml(line.content)}</td>`);
          lines.push('</tr>');
        }
      }

      lines.push('</table>');
      lines.push('</div>');
    }

    lines.push('</div>');

    return lines.join('\n');
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private determineChangeType(
    change: CodeChange,
    originalContent: string
  ): FileDiff['changeType'] {
    if (originalContent === '' && change.type === 'insert') {
      return 'add';
    }
    if (change.type === 'delete' && change.newContent === undefined) {
      return 'delete';
    }
    return 'modify';
  }

  private generateFileHeader(filePath: string, changeType: FileDiff['changeType']): string {
    switch (changeType) {
      case 'add':
        return `--- /dev/null\n+++ ${filePath}`;
      case 'delete':
        return `--- ${filePath}\n+++ /dev/null`;
      default:
        return `--- ${filePath}\n+++ ${filePath}`;
    }
  }

  private getLinePrefix(type: LineChangeType): string {
    switch (type) {
      case 'add':
        return '+';
      case 'remove':
        return '-';
      default:
        return ' ';
    }
  }

  private getLineColor(type: LineChangeType): string {
    switch (type) {
      case 'add':
        return 'green';
      case 'remove':
        return 'red';
      case 'modify':
        return 'yellow';
      default:
        return 'default';
    }
  }

  private formatLineNumbers(line: DiffLine): string {
    const old = line.oldLineNumber?.toString().padStart(4, ' ') ?? '    ';
    const neu = line.newLineNumber?.toString().padStart(4, ' ') ?? '    ';
    return `${old} ${neu} `;
  }

  private colorize(text: string, color: string): string {
    if (!this.config.colorize || this.config.output !== 'terminal') {
      return text;
    }

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
      default: '\x1b[0m',
    };

    const colorCode = colors[color] ?? colors['default'];
    return `${colorCode}${text}\x1b[0m`;
  }

  private truncate(str: string, maxLen: number): string {
    if (str.length <= maxLen) {
      return str;
    }
    return str.slice(0, maxLen - 3) + '...';
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private generateSummary(
    files: FileDiff[],
    totalAdditions: number,
    totalDeletions: number
  ): string {
    const fileCount = files.length;
    const fileWord = fileCount === 1 ? 'file' : 'files';

    return `${fileCount} ${fileWord} changed, ${totalAdditions} insertion(s)(+), ${totalDeletions} deletion(s)(-)`;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a diff visualizer with default configuration.
 */
export function createDiffVisualizer(
  config?: Partial<DiffVisualizerConfig>
): DiffVisualizer {
  return new DiffVisualizer(config);
}
