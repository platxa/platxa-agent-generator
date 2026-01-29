/**
 * Claude Adapter
 *
 * Formats debug analysis results into structured markdown that Claude can parse
 * for display and further processing.
 *
 * @module adapters/claude-adapter
 */

import type {
  CodeChange,
  Evidence,
  FixSuggestion,
  ModuleAnalysisResult,
  NormalizedError,
  RootCauseHypothesis,
  SourceLocation,
  ValidationStep,
} from '../core/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for formatting
 */
export interface ClaudeAdapterOptions {
  /** Include raw error text */
  includeRaw?: boolean;
  /** Maximum fixes to show */
  maxFixes?: number;
  /** Include evidence details */
  includeEvidence?: boolean;
  /** Include validation steps */
  includeValidation?: boolean;
  /** Include code change diffs */
  includeCodeChanges?: boolean;
  /** Compact output mode */
  compact?: boolean;
}

/**
 * Aggregated results for formatting
 */
export interface DebugResults {
  /** Errors analyzed */
  errors: NormalizedError[];
  /** Root cause hypotheses */
  hypotheses: RootCauseHypothesis[];
  /** Fix suggestions */
  fixes: FixSuggestion[];
  /** Analysis notes */
  notes?: string[];
  /** Analysis time in ms */
  analysisTimeMs?: number;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<ClaudeAdapterOptions> = {
  includeRaw: false,
  maxFixes: 5,
  includeEvidence: true,
  includeValidation: true,
  includeCodeChanges: true,
  compact: false,
};

// =============================================================================
// Claude Adapter Class
// =============================================================================

/**
 * Adapter for formatting debug results as Claude-consumable markdown
 */
export class ClaudeAdapter {
  private options: Required<ClaudeAdapterOptions>;

  constructor(options: ClaudeAdapterOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Format analysis results as structured markdown
   */
  format(results: DebugResults | ModuleAnalysisResult): string {
    const normalized = this.normalizeResults(results);
    const sections: string[] = [];

    // Header
    sections.push(this.formatHeader(normalized));

    // Errors section
    if (normalized.errors.length > 0) {
      sections.push(this.formatErrors(normalized.errors));
    }

    // Root cause analysis section
    if (normalized.hypotheses.length > 0) {
      sections.push(this.formatHypotheses(normalized.hypotheses));
    }

    // Fix suggestions section
    if (normalized.fixes.length > 0) {
      sections.push(this.formatFixes(normalized.fixes));
    }

    // Notes section
    if (normalized.notes && normalized.notes.length > 0) {
      sections.push(this.formatNotes(normalized.notes));
    }

    // Footer with metadata
    sections.push(this.formatFooter(normalized));

    return sections.join('\n\n');
  }

  /**
   * Format a single error
   */
  formatError(error: NormalizedError): string {
    const lines: string[] = [];

    lines.push(`### ${error.type}`);
    lines.push('');
    lines.push(`**Message:** ${error.message}`);

    if (error.location) {
      lines.push(`**Location:** ${this.formatLocation(error.location)}`);
    }

    lines.push(`**Severity:** ${this.formatSeverity(error.severity)}`);
    lines.push(`**Language:** ${error.language}`);

    if (error.code) {
      lines.push(`**Code:** \`${error.code}\``);
    }

    if (error.stackTrace && error.stackTrace.length > 0) {
      lines.push('');
      lines.push('**Stack Trace:**');
      lines.push('```');
      for (const frame of error.stackTrace.slice(0, 10)) {
        const loc = this.formatLocation(frame.location);
        const fn = frame.functionName || '<anonymous>';
        lines.push(`  at ${fn} (${loc})`);
      }
      if (error.stackTrace.length > 10) {
        lines.push(`  ... ${error.stackTrace.length - 10} more frames`);
      }
      lines.push('```');
    }

    if (this.options.includeRaw && error.raw) {
      lines.push('');
      lines.push('<details>');
      lines.push('<summary>Raw Error</summary>');
      lines.push('');
      lines.push('```');
      lines.push(error.raw);
      lines.push('```');
      lines.push('</details>');
    }

    return lines.join('\n');
  }

  /**
   * Format a single hypothesis
   */
  formatHypothesis(hypothesis: RootCauseHypothesis, index: number): string {
    const lines: string[] = [];
    const confidence = this.formatConfidence(hypothesis.confidence);

    lines.push(`### Hypothesis ${index + 1}: ${hypothesis.description}`);
    lines.push('');
    lines.push(`**Confidence:** ${confidence}`);

    if (hypothesis.relatedLocations.length > 0) {
      lines.push('');
      lines.push('**Related Locations:**');
      for (const loc of hypothesis.relatedLocations) {
        lines.push(`- ${this.formatLocation(loc)}`);
      }
    }

    if (this.options.includeEvidence && hypothesis.evidence.length > 0) {
      lines.push('');
      lines.push('**Evidence:**');
      for (const evidence of hypothesis.evidence) {
        lines.push(`- ${this.formatEvidence(evidence)}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format a single fix suggestion
   */
  formatFix(fix: FixSuggestion, index: number): string {
    const lines: string[] = [];
    const confidence = this.formatConfidence(fix.confidence);

    lines.push(`### Fix ${index + 1}: ${fix.description}`);
    lines.push('');
    lines.push(`**Confidence:** ${confidence}`);
    lines.push(`**Type:** ${fix.type}`);

    if (this.options.includeCodeChanges && fix.changes.length > 0) {
      lines.push('');
      lines.push('**Changes:**');
      for (const change of fix.changes) {
        lines.push(this.formatCodeChange(change));
      }
    }

    if (this.options.includeValidation && fix.validationSteps.length > 0) {
      lines.push('');
      lines.push('**Validation:**');
      for (const step of fix.validationSteps) {
        lines.push(`- ${this.formatValidationStep(step)}`);
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Private Formatting Methods
  // ===========================================================================

  private normalizeResults(
    results: DebugResults | ModuleAnalysisResult
  ): DebugResults {
    if ('module' in results) {
      // ModuleAnalysisResult
      return {
        errors: results.errors,
        hypotheses: results.hypotheses,
        fixes: results.fixes,
        notes: results.notes,
        analysisTimeMs: results.analysisTimeMs,
      };
    }
    return results;
  }

  private formatHeader(results: DebugResults): string {
    const lines: string[] = [];

    lines.push('## 🔍 Debug Analysis Report');
    lines.push('');

    if (results.errors.length > 0) {
      const errorTypes = [...new Set(results.errors.map((e) => e.type))];
      const languages = [...new Set(results.errors.map((e) => e.language))];

      lines.push('| Property | Value |');
      lines.push('|----------|-------|');
      lines.push(`| Errors | ${results.errors.length} |`);
      lines.push(`| Types | ${errorTypes.join(', ')} |`);
      lines.push(`| Languages | ${languages.join(', ')} |`);
      lines.push(`| Hypotheses | ${results.hypotheses.length} |`);
      lines.push(`| Fixes | ${results.fixes.length} |`);
    }

    return lines.join('\n');
  }

  private formatErrors(errors: NormalizedError[]): string {
    const lines: string[] = [];

    lines.push('## Errors');
    lines.push('');

    for (const error of errors) {
      lines.push(this.formatError(error));
      lines.push('');
    }

    return lines.join('\n');
  }

  private formatHypotheses(hypotheses: RootCauseHypothesis[]): string {
    const lines: string[] = [];

    lines.push('## Root Cause Analysis');
    lines.push('');

    // Sort by confidence descending
    const sorted = [...hypotheses].sort((a, b) => b.confidence - a.confidence);

    for (let i = 0; i < sorted.length; i++) {
      const hypothesis = sorted[i];
      if (hypothesis) {
        lines.push(this.formatHypothesis(hypothesis, i));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private formatFixes(fixes: FixSuggestion[]): string {
    const lines: string[] = [];

    lines.push('## Suggested Fixes');
    lines.push('');

    // Sort by confidence descending and limit
    const sorted = [...fixes]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.options.maxFixes);

    for (let i = 0; i < sorted.length; i++) {
      const fix = sorted[i];
      if (fix) {
        lines.push(this.formatFix(fix, i));
        lines.push('');
      }
    }

    if (fixes.length > this.options.maxFixes) {
      lines.push(
        `*${fixes.length - this.options.maxFixes} additional fixes not shown*`
      );
    }

    return lines.join('\n');
  }

  private formatNotes(notes: string[]): string {
    const lines: string[] = [];

    lines.push('## Notes');
    lines.push('');

    for (const note of notes) {
      lines.push(`- ${note}`);
    }

    return lines.join('\n');
  }

  private formatFooter(results: DebugResults): string {
    const lines: string[] = [];

    lines.push('---');

    if (results.analysisTimeMs) {
      lines.push(`*Analysis completed in ${results.analysisTimeMs}ms*`);
    }

    return lines.join('\n');
  }

  private formatLocation(location: SourceLocation): string {
    let loc = `${location.file}:${location.line}`;
    if (location.column) {
      loc += `:${location.column}`;
    }
    return `\`${loc}\``;
  }

  private formatSeverity(severity: string): string {
    const icons: Record<string, string> = {
      error: '🔴 Error',
      warning: '🟡 Warning',
      info: '🔵 Info',
      hint: '💡 Hint',
    };
    return icons[severity] || severity;
  }

  private formatConfidence(confidence: number): string {
    const percentage = Math.round(confidence * 100);
    const bar = this.options.compact
      ? ''
      : ` ${'█'.repeat(Math.round(confidence * 10))}${'░'.repeat(10 - Math.round(confidence * 10))}`;
    return `${percentage}%${bar}`;
  }

  private formatEvidence(evidence: Evidence): string {
    let text = `[${evidence.type}] ${evidence.description}`;
    if (evidence.location) {
      text += ` at ${this.formatLocation(evidence.location)}`;
    }
    text += ` (strength: ${Math.round(evidence.strength * 100)}%)`;
    return text;
  }

  private formatCodeChange(change: CodeChange): string {
    const lines: string[] = [];

    const loc = `${change.file}:${change.start.line}`;
    lines.push(`\n**${change.type}** at \`${loc}\`:`);
    lines.push('');

    if (change.originalContent && change.type !== 'insert') {
      lines.push('```diff');
      lines.push(
        `- ${change.originalContent.split('\n').join('\n- ')}`
      );
      if (change.newContent) {
        lines.push(
          `+ ${change.newContent.split('\n').join('\n+ ')}`
        );
      }
      lines.push('```');
    } else if (change.newContent) {
      lines.push('```');
      lines.push(change.newContent);
      lines.push('```');
    }

    return lines.join('\n');
  }

  private formatValidationStep(step: ValidationStep): string {
    if (step.command) {
      return `[${step.type}] Run \`${step.command}\` → ${step.expectedOutcome}`;
    }
    return `[${step.type}] ${step.description} → ${step.expectedOutcome}`;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ClaudeAdapter instance
 */
export function createClaudeAdapter(
  options?: ClaudeAdapterOptions
): ClaudeAdapter {
  return new ClaudeAdapter(options);
}

// =============================================================================
// Convenience Export
// =============================================================================

/** Default adapter instance */
export const claudeAdapter = new ClaudeAdapter();
