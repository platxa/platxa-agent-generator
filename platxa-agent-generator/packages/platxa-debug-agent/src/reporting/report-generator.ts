/**
 * Report Generator for CI/CD Integration
 *
 * Generates debugging reports in various formats for CI/CD pipelines:
 * - Checkstyle XML (for linting integration)
 * - JSON (structured data)
 * - PR Comments (GitHub/GitLab)
 *
 * Features #21-25: CI/CD pipeline integration
 *
 * @module reporting/report-generator
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Severity level for issues
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Source location in code
 */
export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

/**
 * A detected error/issue
 */
export interface DebugError {
  /** Unique error identifier */
  id: string;
  /** Error message */
  message: string;
  /** Error type/category */
  type: string;
  /** Severity level */
  severity: Severity;
  /** Source location */
  location: SourceLocation;
  /** Stack trace if available */
  stackTrace?: string;
  /** Related code snippet */
  codeSnippet?: string;
  /** Rule ID for linters */
  ruleId?: string;
}

/**
 * A hypothesis about error cause
 */
export interface Hypothesis {
  /** Hypothesis identifier */
  id: string;
  /** Related error ID */
  errorId: string;
  /** Description of probable cause */
  description: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Evidence supporting this hypothesis */
  evidence: string[];
  /** Suggested location to investigate */
  suggestedLocation?: SourceLocation;
}

/**
 * A suggested fix
 */
export interface SuggestedFix {
  /** Fix identifier */
  id: string;
  /** Related error ID */
  errorId: string;
  /** Fix description */
  description: string;
  /** Code change (before) */
  before?: string;
  /** Code change (after) */
  after?: string;
  /** File to modify */
  file?: string;
  /** Line range */
  lineRange?: { start: number; end: number };
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether this fix is auto-applicable */
  autoApplicable: boolean;
}

/**
 * Complete debug results
 */
export interface DebugResults {
  /** Session identifier */
  sessionId: string;
  /** Timestamp */
  timestamp: Date;
  /** Detected errors */
  errors: DebugError[];
  /** Generated hypotheses */
  hypotheses: Hypothesis[];
  /** Suggested fixes */
  fixes: SuggestedFix[];
  /** Analysis metadata */
  metadata?: {
    analysisTimeMs?: number;
    toolVersion?: string;
    projectName?: string;
    branch?: string;
    commit?: string;
  };
}

/**
 * Report format type
 */
export type ReportFormat = 'checkstyle' | 'json' | 'sarif' | 'markdown' | 'html';

/**
 * PR comment structure
 */
export interface PRComment {
  /** Comment body */
  body: string;
  /** File path (for inline comments) */
  path?: string;
  /** Line number (for inline comments) */
  line?: number;
  /** Side for diff comments */
  side?: 'LEFT' | 'RIGHT';
  /** Whether this is the main summary comment */
  isSummary: boolean;
}

/**
 * Report generator options
 */
export interface ReportGeneratorOptions {
  /** Include code snippets in reports */
  includeSnippets?: boolean;
  /** Include stack traces */
  includeStackTraces?: boolean;
  /** Maximum errors per file in checkstyle */
  maxErrorsPerFile?: number;
  /** Tool name for reports */
  toolName?: string;
  /** Tool version */
  toolVersion?: string;
  /** Base URL for documentation links */
  docsBaseUrl?: string;
}

// =============================================================================
// Default Options
// =============================================================================

const DEFAULT_OPTIONS: Required<ReportGeneratorOptions> = {
  includeSnippets: true,
  includeStackTraces: false,
  maxErrorsPerFile: 100,
  toolName: 'platxa-debug-agent',
  toolVersion: '0.1.0',
  docsBaseUrl: 'https://github.com/platxa/platxa-debug-agent',
};

// =============================================================================
// Report Generator Class
// =============================================================================

/**
 * Generates debugging reports in various formats for CI/CD integration
 */
export class ReportGenerator {
  private options: Required<ReportGeneratorOptions>;

  constructor(options: ReportGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ===========================================================================
  // Main API
  // ===========================================================================

  /**
   * Generate a report in the specified format
   */
  generateReport(results: DebugResults, format: ReportFormat): string {
    switch (format) {
      case 'checkstyle':
        return this.generateCheckstyle(results);
      case 'json':
        return this.generateJSON(results);
      case 'sarif':
        return this.generateSARIF(results);
      case 'markdown':
        return this.generateMarkdown(results);
      case 'html':
        return this.generateHTML(results);
      default:
        throw new Error(`Unsupported report format: ${format}`);
    }
  }

  /**
   * Generate PR comments from debug results
   */
  generatePRComments(results: DebugResults): PRComment[] {
    const comments: PRComment[] = [];

    // Generate summary comment
    const summaryComment = this.generateSummaryComment(results);
    comments.push({
      body: summaryComment,
      isSummary: true,
    });

    // Generate inline comments for each error with a fix
    for (const error of results.errors) {
      const relatedFixes = results.fixes.filter((f) => f.errorId === error.id);
      const relatedHypotheses = results.hypotheses.filter((h) => h.errorId === error.id);

      if (relatedFixes.length > 0 || relatedHypotheses.length > 0) {
        const inlineComment = this.generateInlineComment(error, relatedHypotheses, relatedFixes);
        comments.push({
          body: inlineComment,
          path: error.location.file,
          line: error.location.line,
          side: 'RIGHT',
          isSummary: false,
        });
      }
    }

    return comments;
  }

  // ===========================================================================
  // Checkstyle Format (Features #21-23)
  // ===========================================================================

  /**
   * Generate Checkstyle XML format
   *
   * Feature #21: Valid Checkstyle XML structure with checkstyle root element
   * Feature #22: File elements with error children
   * Feature #23: Correct severity mapping
   */
  generateCheckstyle(results: DebugResults): string {
    const lines: string[] = [];

    // XML declaration and root element (Feature #21)
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<checkstyle version="8.0">');

    // Group errors by file (Feature #22)
    const errorsByFile = this.groupErrorsByFile(results.errors);

    for (const [filePath, errors] of errorsByFile) {
      // Limit errors per file
      const limitedErrors = errors.slice(0, this.options.maxErrorsPerFile);

      lines.push(`  <file name="${this.escapeXml(filePath)}">`);

      for (const error of limitedErrors) {
        // Map severity (Feature #23)
        const severity = this.mapCheckstyleSeverity(error.severity);
        const source = error.ruleId
          ? `${this.options.toolName}.${error.ruleId}`
          : `${this.options.toolName}.${error.type}`;

        lines.push(
          `    <error ` +
          `line="${error.location.line}" ` +
          (error.location.column !== undefined ? `column="${error.location.column}" ` : '') +
          `severity="${severity}" ` +
          `message="${this.escapeXml(error.message)}" ` +
          `source="${this.escapeXml(source)}"/>`
        );
      }

      lines.push('  </file>');
    }

    lines.push('</checkstyle>');

    return lines.join('\n');
  }

  /**
   * Map severity to Checkstyle severity values
   * Feature #23: Correct severity mapping
   */
  private mapCheckstyleSeverity(severity: Severity): string {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'warning';
    }
  }

  // ===========================================================================
  // JSON Format (Feature #24)
  // ===========================================================================

  /**
   * Generate JSON report
   *
   * Feature #24: Valid JSON with errors, hypotheses, fixes arrays
   */
  generateJSON(results: DebugResults): string {
    const report = {
      version: '1.0',
      generator: {
        name: this.options.toolName,
        version: this.options.toolVersion,
      },
      timestamp: results.timestamp.toISOString(),
      sessionId: results.sessionId,
      summary: {
        totalErrors: results.errors.length,
        totalHypotheses: results.hypotheses.length,
        totalFixes: results.fixes.length,
        errorsBySeverity: this.countBySeverity(results.errors),
        autoApplicableFixes: results.fixes.filter((f) => f.autoApplicable).length,
      },
      errors: results.errors.map((error) => ({
        id: error.id,
        type: error.type,
        severity: error.severity,
        message: error.message,
        location: error.location,
        ruleId: error.ruleId,
        ...(this.options.includeSnippets && error.codeSnippet
          ? { codeSnippet: error.codeSnippet }
          : {}),
        ...(this.options.includeStackTraces && error.stackTrace
          ? { stackTrace: error.stackTrace }
          : {}),
      })),
      hypotheses: results.hypotheses.map((hypothesis) => ({
        id: hypothesis.id,
        errorId: hypothesis.errorId,
        description: hypothesis.description,
        confidence: hypothesis.confidence,
        evidence: hypothesis.evidence,
        suggestedLocation: hypothesis.suggestedLocation,
      })),
      fixes: results.fixes.map((fix) => ({
        id: fix.id,
        errorId: fix.errorId,
        description: fix.description,
        confidence: fix.confidence,
        autoApplicable: fix.autoApplicable,
        file: fix.file,
        lineRange: fix.lineRange,
        ...(this.options.includeSnippets && fix.before && fix.after
          ? { before: fix.before, after: fix.after }
          : {}),
      })),
      metadata: results.metadata,
    };

    return JSON.stringify(report, null, 2);
  }

  // ===========================================================================
  // SARIF Format
  // ===========================================================================

  /**
   * Generate SARIF 2.1.0 report
   */
  generateSARIF(results: DebugResults): string {
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0' as const,
      runs: [{
        tool: {
          driver: {
            name: this.options.toolName,
            version: this.options.toolVersion,
            informationUri: this.options.docsBaseUrl,
            rules: this.extractRules(results.errors),
          },
        },
        results: results.errors.map((error) => ({
          ruleId: error.ruleId ?? error.type,
          level: this.mapSARIFLevel(error.severity),
          message: {
            text: error.message,
          },
          locations: [{
            physicalLocation: {
              artifactLocation: {
                uri: error.location.file,
              },
              region: {
                startLine: error.location.line,
                startColumn: error.location.column,
                endLine: error.location.endLine,
                endColumn: error.location.endColumn,
              },
            },
          }],
          fixes: results.fixes
            .filter((f) => f.errorId === error.id && f.autoApplicable)
            .map((fix) => ({
              description: {
                text: fix.description,
              },
              artifactChanges: fix.file && fix.before && fix.after ? [{
                artifactLocation: {
                  uri: fix.file,
                },
                replacements: [{
                  deletedRegion: {
                    startLine: fix.lineRange?.start ?? error.location.line,
                    endLine: fix.lineRange?.end ?? error.location.line,
                  },
                  insertedContent: {
                    text: fix.after,
                  },
                }],
              }] : [],
            })),
        })),
      }],
    };

    return JSON.stringify(sarif, null, 2);
  }

  private mapSARIFLevel(severity: Severity): 'error' | 'warning' | 'note' {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'note';
      default:
        return 'warning';
    }
  }

  private extractRules(errors: DebugError[]): Array<{
    id: string;
    name: string;
    shortDescription: { text: string };
  }> {
    const ruleMap = new Map<string, { id: string; name: string; count: number }>();

    for (const error of errors) {
      const ruleId = error.ruleId ?? error.type;
      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, {
          id: ruleId,
          name: error.type,
          count: 1,
        });
      } else {
        const existing = ruleMap.get(ruleId);
        if (existing) {
          existing.count++;
        }
      }
    }

    return Array.from(ruleMap.values()).map((rule) => ({
      id: rule.id,
      name: rule.name,
      shortDescription: {
        text: `${rule.name} (${rule.count} occurrence${rule.count > 1 ? 's' : ''})`,
      },
    }));
  }

  // ===========================================================================
  // Markdown Format
  // ===========================================================================

  /**
   * Generate Markdown report
   */
  generateMarkdown(results: DebugResults): string {
    const lines: string[] = [];

    lines.push('# Debug Report');
    lines.push('');
    lines.push(`**Session:** ${results.sessionId}`);
    lines.push(`**Generated:** ${results.timestamp.toISOString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Errors | ${results.errors.length} |`);
    lines.push(`| Hypotheses | ${results.hypotheses.length} |`);
    lines.push(`| Suggested Fixes | ${results.fixes.length} |`);
    lines.push('');

    // Errors
    if (results.errors.length > 0) {
      lines.push('## Errors');
      lines.push('');

      for (const error of results.errors) {
        const severityEmoji = this.getSeverityEmoji(error.severity);
        lines.push(`### ${severityEmoji} ${error.type}`);
        lines.push('');
        lines.push(`**Location:** \`${error.location.file}:${error.location.line}\``);
        lines.push(`**Severity:** ${error.severity}`);
        lines.push('');
        lines.push(`> ${error.message}`);
        lines.push('');

        if (this.options.includeSnippets && error.codeSnippet) {
          lines.push('```');
          lines.push(error.codeSnippet);
          lines.push('```');
          lines.push('');
        }

        // Related hypotheses
        const relatedHypotheses = results.hypotheses.filter((h) => h.errorId === error.id);
        if (relatedHypotheses.length > 0) {
          lines.push('**Hypotheses:**');
          for (const hypothesis of relatedHypotheses) {
            lines.push(`- ${hypothesis.description} (confidence: ${(hypothesis.confidence * 100).toFixed(0)}%)`);
          }
          lines.push('');
        }

        // Related fixes
        const relatedFixes = results.fixes.filter((f) => f.errorId === error.id);
        if (relatedFixes.length > 0) {
          lines.push('**Suggested Fixes:**');
          for (const fix of relatedFixes) {
            const autoLabel = fix.autoApplicable ? ' [auto-applicable]' : '';
            lines.push(`- ${fix.description}${autoLabel}`);
          }
          lines.push('');
        }
      }
    }

    return lines.join('\n');
  }

  private getSeverityEmoji(severity: Severity): string {
    switch (severity) {
      case 'error':
        return '🔴';
      case 'warning':
        return '🟡';
      case 'info':
        return '🔵';
      default:
        return '⚪';
    }
  }

  // ===========================================================================
  // HTML Format
  // ===========================================================================

  /**
   * Generate HTML report
   */
  generateHTML(results: DebugResults): string {
    const markdown = this.generateMarkdown(results);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug Report - ${results.sessionId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      background: #f8f9fa;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 0.5rem; }
    h2 { color: #555; margin-top: 2rem; }
    h3 { color: #666; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.75rem; text-align: left; }
    th { background: #f1f3f4; }
    pre { background: #f5f5f5; padding: 1rem; overflow-x: auto; border-radius: 4px; }
    code { background: #f5f5f5; padding: 0.2rem 0.4rem; border-radius: 3px; }
    blockquote { border-left: 4px solid #007bff; margin: 1rem 0; padding-left: 1rem; color: #555; }
    .severity-error { color: #dc3545; }
    .severity-warning { color: #ffc107; }
    .severity-info { color: #17a2b8; }
  </style>
</head>
<body>
  <div class="container">
    <pre style="white-space: pre-wrap;">${this.escapeHtml(markdown)}</pre>
  </div>
</body>
</html>`;
  }

  // ===========================================================================
  // PR Comments (Feature #25)
  // ===========================================================================

  /**
   * Generate summary comment for PR
   * Feature #25: Summary comment with overview
   */
  private generateSummaryComment(results: DebugResults): string {
    const lines: string[] = [];

    lines.push('## 🔍 Debug Analysis Summary');
    lines.push('');

    // Stats table
    const errorCount = results.errors.length;
    const fixCount = results.fixes.length;
    const autoFixCount = results.fixes.filter((f) => f.autoApplicable).length;

    if (errorCount === 0) {
      lines.push('✅ **No issues detected!**');
    } else {
      lines.push('| Category | Count |');
      lines.push('|----------|-------|');
      lines.push(`| 🔴 Errors | ${results.errors.filter((e) => e.severity === 'error').length} |`);
      lines.push(`| 🟡 Warnings | ${results.errors.filter((e) => e.severity === 'warning').length} |`);
      lines.push(`| 🔵 Info | ${results.errors.filter((e) => e.severity === 'info').length} |`);
      lines.push(`| 💡 Suggested Fixes | ${fixCount} |`);
      lines.push(`| 🔧 Auto-applicable | ${autoFixCount} |`);
      lines.push('');

      // Top issues
      const topErrors = results.errors.slice(0, 3);
      if (topErrors.length > 0) {
        lines.push('### Top Issues');
        lines.push('');
        for (const error of topErrors) {
          const emoji = this.getSeverityEmoji(error.severity);
          lines.push(`- ${emoji} **${error.type}** at \`${error.location.file}:${error.location.line}\``);
          lines.push(`  > ${error.message}`);
        }
        lines.push('');
      }

      if (results.errors.length > 3) {
        lines.push(`*...and ${results.errors.length - 3} more issues*`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push(`*Generated by ${this.options.toolName} v${this.options.toolVersion}*`);

    return lines.join('\n');
  }

  /**
   * Generate inline comment for specific error
   */
  private generateInlineComment(
    error: DebugError,
    hypotheses: Hypothesis[],
    fixes: SuggestedFix[]
  ): string {
    const lines: string[] = [];

    const emoji = this.getSeverityEmoji(error.severity);
    lines.push(`${emoji} **${error.type}**: ${error.message}`);
    lines.push('');

    if (hypotheses.length > 0) {
      lines.push('**Probable cause:**');
      const topHypothesis = hypotheses.sort((a, b) => b.confidence - a.confidence)[0];
      if (topHypothesis) {
        lines.push(`- ${topHypothesis.description}`);
      }
      lines.push('');
    }

    if (fixes.length > 0) {
      lines.push('**Suggested fix:**');
      const topFix = fixes.sort((a, b) => b.confidence - a.confidence)[0];
      if (topFix) {
        lines.push(`- ${topFix.description}`);

        if (this.options.includeSnippets && topFix.before && topFix.after) {
          lines.push('');
          lines.push('<details>');
          lines.push('<summary>View suggested change</summary>');
          lines.push('');
          lines.push('```diff');
          lines.push(`- ${topFix.before}`);
          lines.push(`+ ${topFix.after}`);
          lines.push('```');
          lines.push('');
          lines.push('</details>');
        }
      }
    }

    return lines.join('\n');
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  private groupErrorsByFile(errors: DebugError[]): Map<string, DebugError[]> {
    const grouped = new Map<string, DebugError[]>();

    for (const error of errors) {
      const file = error.location.file;
      if (!grouped.has(file)) {
        grouped.set(file, []);
      }
      grouped.get(file)!.push(error);
    }

    return grouped;
  }

  private countBySeverity(errors: DebugError[]): Record<Severity, number> {
    const counts: Record<Severity, number> = {
      error: 0,
      warning: 0,
      info: 0,
    };

    for (const error of errors) {
      counts[error.severity]++;
    }

    return counts;
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new ReportGenerator instance
 */
export function createReportGenerator(
  options?: ReportGeneratorOptions
): ReportGenerator {
  return new ReportGenerator(options);
}

// =============================================================================
// Default Instance
// =============================================================================

/** Default report generator instance */
export const reportGenerator = new ReportGenerator();
