/**
 * Hypothetical Diff - Preview file changes without committing
 *
 * Feature #56: Create hypothetical file change preview (diff without commit)
 * Verification: Shows unified diff of proposed changes; clearly marked as preview
 *
 * Generates unified diff output showing what WOULD happen if changes
 * were applied, without modifying any files.
 *
 * @module agentic-core/hypothetical-diff
 */

// ============================================================================
// Types
// ============================================================================

/** Single proposed change to a file */
export interface ProposedChange {
  /** Search text to find */
  search: string;
  /** Replacement text */
  replace: string;
  /** Replace all occurrences (default: first only) */
  all?: boolean;
}

/** Options for generating hypothetical diff */
export interface HypotheticalDiffOptions {
  /** File path (for display in diff header) */
  filePath: string;
  /** Original content of the file */
  originalContent: string;
  /** Proposed changes to apply */
  changes: ProposedChange[];
  /** Number of context lines around changes (default: 3) */
  contextLines?: number;
  /** Include preview banner (default: true) */
  showPreviewBanner?: boolean;
  /** Include change summary (default: true) */
  showSummary?: boolean;
}

/** Result of hypothetical diff generation */
export interface HypotheticalDiffResult {
  /** Whether any changes would be made */
  hasChanges: boolean;
  /** Number of changes that would be applied */
  changesApplied: number;
  /** Total replacements that would occur */
  totalReplacements: number;
  /** The resulting content if changes were applied */
  proposedContent: string;
  /** Unified diff output */
  diff: string;
  /** Diff with preview markers */
  previewDiff: string;
  /** Plain text summary */
  summary: string;
  /** Lines added */
  linesAdded: number;
  /** Lines removed */
  linesRemoved: number;
}

/** Format options for preview output */
export type PreviewFormat = 'unified' | 'side-by-side' | 'inline' | 'minimal';

/** Configuration for HypotheticalDiffGenerator */
export interface HypotheticalDiffConfig {
  /** Default context lines */
  defaultContextLines?: number;
  /** Preview banner text */
  previewBannerText?: string;
  /** Warning text for uncommitted changes */
  warningText?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONTEXT_LINES = 3;

const DEFAULT_PREVIEW_BANNER = `
╔════════════════════════════════════════════════════════════════════════════╗
║  ⚠️  PREVIEW - PROPOSED CHANGES (NOT COMMITTED)                             ║
║  The following diff shows what WOULD happen if these changes were applied  ║
╚════════════════════════════════════════════════════════════════════════════╝
`.trim();

const DEFAULT_WARNING_TEXT = '⚠️ PREVIEW ONLY - No files have been modified';

// ============================================================================
// HypotheticalDiffGenerator Class
// ============================================================================

/**
 * HypotheticalDiffGenerator - Generate diffs for proposed changes
 *
 * Creates unified diff output showing proposed changes without
 * actually modifying any files.
 *
 * @example
 * ```typescript
 * const generator = new HypotheticalDiffGenerator();
 *
 * const result = generator.generate({
 *   filePath: 'src/config.ts',
 *   originalContent: 'const debug = false;',
 *   changes: [{ search: 'false', replace: 'true' }],
 * });
 *
 * console.log(result.previewDiff);
 * // Shows preview banner + unified diff
 * ```
 */
export class HypotheticalDiffGenerator {
  private config: Required<HypotheticalDiffConfig>;

  constructor(config: HypotheticalDiffConfig = {}) {
    this.config = {
      defaultContextLines: config.defaultContextLines ?? DEFAULT_CONTEXT_LINES,
      previewBannerText: config.previewBannerText ?? DEFAULT_PREVIEW_BANNER,
      warningText: config.warningText ?? DEFAULT_WARNING_TEXT,
    };
  }

  // ==========================================================================
  // Main Generation
  // ==========================================================================

  /**
   * Generate hypothetical diff for proposed changes
   */
  generate(options: HypotheticalDiffOptions): HypotheticalDiffResult {
    const contextLines = options.contextLines ?? this.config.defaultContextLines;
    const showBanner = options.showPreviewBanner ?? true;
    const showSummary = options.showSummary ?? true;

    // Apply changes to get proposed content
    const { result: proposedContent, replacements, appliedCount } =
      this.applyChanges(options.originalContent, options.changes);

    // Check if any changes would be made
    const hasChanges = proposedContent !== options.originalContent;

    if (!hasChanges) {
      return {
        hasChanges: false,
        changesApplied: 0,
        totalReplacements: 0,
        proposedContent: options.originalContent,
        diff: '# No changes would be made',
        previewDiff: this.formatNoChangesPreview(),
        summary: 'No changes would be made to the file.',
        linesAdded: 0,
        linesRemoved: 0,
      };
    }

    // Generate unified diff
    const diff = this.generateUnifiedDiff(
      options.filePath,
      options.originalContent,
      proposedContent,
      contextLines
    );

    // Count line changes
    const { added, removed } = this.countLineChanges(diff);

    // Generate summary
    const summary = this.generateSummary(
      options.filePath,
      appliedCount,
      replacements,
      added,
      removed
    );

    // Build preview diff with markers
    const previewDiff = this.formatPreviewDiff(diff, showBanner, showSummary ? summary : null);

    return {
      hasChanges: true,
      changesApplied: appliedCount,
      totalReplacements: replacements,
      proposedContent,
      diff,
      previewDiff,
      summary,
      linesAdded: added,
      linesRemoved: removed,
    };
  }

  /**
   * Generate preview for multiple files
   */
  generateMultiple(
    files: Array<{
      filePath: string;
      originalContent: string;
      changes: ProposedChange[];
    }>
  ): {
    results: Map<string, HypotheticalDiffResult>;
    combinedPreview: string;
    totalChanges: number;
  } {
    const results = new Map<string, HypotheticalDiffResult>();
    let totalChanges = 0;

    for (const file of files) {
      const result = this.generate({
        filePath: file.filePath,
        originalContent: file.originalContent,
        changes: file.changes,
      });
      results.set(file.filePath, result);
      totalChanges += result.changesApplied;
    }

    const combinedPreview = this.formatCombinedPreview(results);

    return { results, combinedPreview, totalChanges };
  }

  // ==========================================================================
  // Change Application (In Memory)
  // ==========================================================================

  /**
   * Apply changes to content without writing to file
   */
  private applyChanges(
    content: string,
    changes: ProposedChange[]
  ): { result: string; replacements: number; appliedCount: number } {
    let result = content;
    let totalReplacements = 0;
    let appliedCount = 0;

    for (const change of changes) {
      if (!change.search) continue;

      const beforeCount = this.countOccurrences(result, change.search);
      if (beforeCount === 0) continue;

      if (change.all) {
        result = result.split(change.search).join(change.replace);
        totalReplacements += beforeCount;
      } else {
        result = result.replace(change.search, change.replace);
        totalReplacements += 1;
      }

      appliedCount++;
    }

    return { result, replacements: totalReplacements, appliedCount };
  }

  /**
   * Count occurrences of search string
   */
  private countOccurrences(text: string, search: string): number {
    if (!search) return 0;
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(search, pos)) !== -1) {
      count++;
      pos += search.length;
    }
    return count;
  }

  // ==========================================================================
  // Diff Generation
  // ==========================================================================

  /**
   * Generate unified diff format
   */
  private generateUnifiedDiff(
    filePath: string,
    original: string,
    modified: string,
    contextLines: number
  ): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diff: string[] = [];

    // Diff header
    diff.push(`--- a/${filePath}`);
    diff.push(`+++ b/${filePath}`);

    // Find changed regions and format with context
    const hunks = this.findHunks(originalLines, modifiedLines, contextLines);

    for (const hunk of hunks) {
      diff.push(hunk.header);
      diff.push(...hunk.lines);
    }

    return diff.join('\n');
  }

  /**
   * Find diff hunks with context
   */
  private findHunks(
    originalLines: string[],
    modifiedLines: string[],
    contextLines: number
  ): Array<{ header: string; lines: string[] }> {
    const hunks: Array<{ header: string; lines: string[] }> = [];

    // Simple LCS-based diff
    const changes = this.computeChanges(originalLines, modifiedLines);

    if (changes.length === 0) {
      return hunks;
    }

    // Group changes into hunks
    let currentHunk: { startOrig: number; startMod: number; lines: string[] } | null = null;
    let lastChangeEnd = -1;

    for (const change of changes) {
      const gapFromLast = change.originalIndex - lastChangeEnd;

      // Start new hunk if gap is larger than 2x context
      if (!currentHunk || gapFromLast > contextLines * 2) {
        // Finalize previous hunk
        if (currentHunk) {
          // Add trailing context
          for (let i = 0; i < contextLines && lastChangeEnd + i < originalLines.length; i++) {
            const lineIdx = lastChangeEnd + i;
            if (originalLines[lineIdx] !== undefined) {
              currentHunk.lines.push(` ${originalLines[lineIdx]}`);
            }
          }
          hunks.push(this.formatHunk(currentHunk));
        }

        // Start new hunk with leading context
        const contextStart = Math.max(0, change.originalIndex - contextLines);
        currentHunk = {
          startOrig: contextStart,
          startMod: contextStart,
          lines: [],
        };

        // Add leading context
        for (let i = contextStart; i < change.originalIndex; i++) {
          if (originalLines[i] !== undefined) {
            currentHunk.lines.push(` ${originalLines[i]}`);
          }
        }
      } else if (currentHunk) {
        // Add context between changes
        for (let i = lastChangeEnd; i < change.originalIndex; i++) {
          if (originalLines[i] !== undefined) {
            currentHunk.lines.push(` ${originalLines[i]}`);
          }
        }
      }

      // Add the change
      if (currentHunk) {
        if (change.type === 'delete' || change.type === 'replace') {
          currentHunk.lines.push(`-${change.originalLine}`);
        }
        if (change.type === 'insert' || change.type === 'replace') {
          currentHunk.lines.push(`+${change.modifiedLine}`);
        }
      }

      lastChangeEnd = change.originalIndex + 1;
    }

    // Finalize last hunk
    if (currentHunk) {
      for (let i = 0; i < contextLines && lastChangeEnd + i < originalLines.length; i++) {
        const lineIdx = lastChangeEnd + i;
        if (originalLines[lineIdx] !== undefined) {
          currentHunk.lines.push(` ${originalLines[lineIdx]}`);
        }
      }
      hunks.push(this.formatHunk(currentHunk));
    }

    return hunks;
  }

  /**
   * Compute line-level changes between original and modified
   */
  private computeChanges(
    originalLines: string[],
    modifiedLines: string[]
  ): Array<{
    type: 'insert' | 'delete' | 'replace';
    originalIndex: number;
    modifiedIndex: number;
    originalLine: string;
    modifiedLine: string;
  }> {
    const changes: Array<{
      type: 'insert' | 'delete' | 'replace';
      originalIndex: number;
      modifiedIndex: number;
      originalLine: string;
      modifiedLine: string;
    }> = [];

    // Simple line-by-line comparison
    const maxLen = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLen; i++) {
      const origLine = originalLines[i];
      const modLine = modifiedLines[i];

      if (origLine === undefined && modLine !== undefined) {
        changes.push({
          type: 'insert',
          originalIndex: i,
          modifiedIndex: i,
          originalLine: '',
          modifiedLine: modLine,
        });
      } else if (origLine !== undefined && modLine === undefined) {
        changes.push({
          type: 'delete',
          originalIndex: i,
          modifiedIndex: i,
          originalLine: origLine,
          modifiedLine: '',
        });
      } else if (origLine !== modLine) {
        changes.push({
          type: 'replace',
          originalIndex: i,
          modifiedIndex: i,
          originalLine: origLine ?? '',
          modifiedLine: modLine ?? '',
        });
      }
    }

    return changes;
  }

  /**
   * Format a hunk with proper header
   */
  private formatHunk(hunk: { startOrig: number; startMod: number; lines: string[] }): {
    header: string;
    lines: string[];
  } {
    const origCount = hunk.lines.filter(l => l.startsWith(' ') || l.startsWith('-')).length;
    const modCount = hunk.lines.filter(l => l.startsWith(' ') || l.startsWith('+')).length;

    return {
      header: `@@ -${hunk.startOrig + 1},${origCount} +${hunk.startMod + 1},${modCount} @@`,
      lines: hunk.lines,
    };
  }

  // ==========================================================================
  // Preview Formatting
  // ==========================================================================

  /**
   * Format diff with preview markers
   */
  private formatPreviewDiff(
    diff: string,
    showBanner: boolean,
    summary: string | null
  ): string {
    const parts: string[] = [];

    if (showBanner) {
      parts.push(this.config.previewBannerText);
      parts.push('');
    }

    parts.push(diff);

    if (summary) {
      parts.push('');
      parts.push('─'.repeat(76));
      parts.push(summary);
    }

    parts.push('');
    parts.push(this.config.warningText);

    return parts.join('\n');
  }

  /**
   * Format preview for no changes case
   */
  private formatNoChangesPreview(): string {
    return [
      this.config.previewBannerText,
      '',
      '# No changes would be made',
      '',
      'The proposed changes do not match any content in the file.',
      '',
      this.config.warningText,
    ].join('\n');
  }

  /**
   * Format combined preview for multiple files
   */
  private formatCombinedPreview(results: Map<string, HypotheticalDiffResult>): string {
    const parts: string[] = [];

    parts.push(this.config.previewBannerText);
    parts.push('');

    let fileIndex = 0;
    let totalAdded = 0;
    let totalRemoved = 0;

    for (const [filePath, result] of results) {
      if (result.hasChanges) {
        fileIndex++;
        parts.push(`━━━ File ${fileIndex}: ${filePath} ━━━`);
        parts.push('');
        parts.push(result.diff);
        parts.push('');
        totalAdded += result.linesAdded;
        totalRemoved += result.linesRemoved;
      }
    }

    parts.push('═'.repeat(76));
    parts.push(`Total: ${results.size} file(s), +${totalAdded} -${totalRemoved} lines`);
    parts.push('');
    parts.push(this.config.warningText);

    return parts.join('\n');
  }

  // ==========================================================================
  // Summary Generation
  // ==========================================================================

  /**
   * Generate human-readable summary
   */
  private generateSummary(
    filePath: string,
    changesApplied: number,
    replacements: number,
    linesAdded: number,
    linesRemoved: number
  ): string {
    const parts: string[] = [];

    parts.push(`📄 ${filePath}`);
    parts.push(`   ${changesApplied} change(s) would be applied`);
    parts.push(`   ${replacements} replacement(s) total`);
    parts.push(`   +${linesAdded} / -${linesRemoved} lines`);

    return parts.join('\n');
  }

  /**
   * Count added and removed lines from diff
   */
  private countLineChanges(diff: string): { added: number; removed: number } {
    const lines = diff.split('\n');
    let added = 0;
    let removed = 0;

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }

    return { added, removed };
  }

  // ==========================================================================
  // Alternative Formats
  // ==========================================================================

  /**
   * Render preview in different formats
   */
  render(result: HypotheticalDiffResult, format: PreviewFormat = 'unified'): string {
    switch (format) {
      case 'unified':
        return result.previewDiff;

      case 'minimal':
        return this.renderMinimal(result);

      case 'inline':
        return this.renderInline(result);

      case 'side-by-side':
        return this.renderSideBySide(result);

      default:
        return result.previewDiff;
    }
  }

  /**
   * Render minimal format (summary only)
   */
  private renderMinimal(result: HypotheticalDiffResult): string {
    if (!result.hasChanges) {
      return '⚠️ PREVIEW: No changes would be made';
    }

    return [
      '⚠️ PREVIEW - PROPOSED CHANGES',
      result.summary,
      `Changes: +${result.linesAdded} / -${result.linesRemoved} lines`,
    ].join('\n');
  }

  /**
   * Render inline format (original with strikethrough + additions)
   */
  private renderInline(result: HypotheticalDiffResult): string {
    const lines = result.diff.split('\n');
    const output: string[] = ['⚠️ PREVIEW - INLINE VIEW', ''];

    for (const line of lines) {
      if (line.startsWith('@@')) {
        output.push(`\n${line}`);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        output.push(`~~${line.substring(1)}~~`);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        output.push(`**${line.substring(1)}**`);
      } else if (line.startsWith(' ')) {
        output.push(line.substring(1));
      }
    }

    output.push('', this.config.warningText);
    return output.join('\n');
  }

  /**
   * Render side-by-side format
   */
  private renderSideBySide(result: HypotheticalDiffResult): string {
    const lines: string[] = ['⚠️ PREVIEW - SIDE BY SIDE VIEW', ''];
    lines.push('│ ORIGINAL                        │ PROPOSED                        │');
    lines.push('├─────────────────────────────────┼─────────────────────────────────┤');

    const diffLines = result.diff.split('\n');
    let origLine = '';
    let modLine = '';

    for (const line of diffLines) {
      if (line.startsWith('-') && !line.startsWith('---')) {
        origLine = line.substring(1).padEnd(33).substring(0, 33);
        if (modLine) {
          lines.push(`│ ${origLine} │ ${modLine} │`);
          origLine = '';
          modLine = '';
        }
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        modLine = line.substring(1).padEnd(33).substring(0, 33);
        if (origLine || !diffLines.some(l => l.startsWith('-'))) {
          lines.push(`│ ${origLine.padEnd(33)} │ ${modLine} │`);
          origLine = '';
          modLine = '';
        }
      }
    }

    // Flush remaining
    if (origLine || modLine) {
      lines.push(`│ ${origLine.padEnd(33)} │ ${modLine.padEnd(33)} │`);
    }

    lines.push('└─────────────────────────────────┴─────────────────────────────────┘');
    lines.push('', this.config.warningText);

    return lines.join('\n');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get configuration
   */
  getConfig(): typeof this.config {
    return { ...this.config };
  }

  /**
   * Update preview banner text
   */
  setPreviewBanner(text: string): void {
    this.config.previewBannerText = text;
  }

  /**
   * Update warning text
   */
  setWarningText(text: string): void {
    this.config.warningText = text;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new HypotheticalDiffGenerator instance
 */
export function createHypotheticalDiffGenerator(
  config?: HypotheticalDiffConfig
): HypotheticalDiffGenerator {
  return new HypotheticalDiffGenerator(config);
}

/**
 * Quick generation utility
 */
export function generateHypotheticalDiff(
  options: HypotheticalDiffOptions
): HypotheticalDiffResult {
  return new HypotheticalDiffGenerator().generate(options);
}

/**
 * Preview changes to a file
 */
export function previewFileChanges(
  filePath: string,
  originalContent: string,
  changes: ProposedChange[]
): HypotheticalDiffResult {
  return generateHypotheticalDiff({
    filePath,
    originalContent,
    changes,
  });
}

// ============================================================================
// Exports
// ============================================================================

export default HypotheticalDiffGenerator;
