/**
 * Error Injector - Feeds validation failures to LLM context for fix generation
 *
 * Transforms validation errors into structured context that helps LLM
 * generate targeted fixes with file paths, line numbers, and suggestions.
 *
 * @module agentic-core/error-injector
 */

import type { AgentError, AgentContext } from './agent-engine';
import type { ValidationError, ValidatorResult } from './validation-engine';

// ============================================================================
// Types
// ============================================================================

/** Structured error for LLM context injection */
export interface InjectedError {
  /** Unique error identifier */
  id: string;
  /** Error type/category */
  type: AgentError['type'];
  /** Human-readable error message */
  message: string;
  /** File path where error occurred */
  filePath: string | null;
  /** Line number in file */
  lineNumber: number | null;
  /** Column number in file */
  columnNumber: number | null;
  /** Severity level */
  severity: 'error' | 'warning' | 'critical';
  /** Suggested fix area or approach */
  suggestedFix: string | null;
  /** Code snippet around the error */
  codeSnippet: string | null;
  /** Related errors (for grouped fixes) */
  relatedErrorIds: string[];
  /** Iteration when error was captured */
  iteration: number;
}

/** Error context for LLM prompt */
export interface ErrorContext {
  /** Total number of errors */
  totalErrors: number;
  /** Errors by type */
  errorsByType: Record<string, number>;
  /** Critical errors requiring immediate fix */
  criticalErrors: InjectedError[];
  /** Regular errors */
  errors: InjectedError[];
  /** Warnings (lower priority) */
  warnings: InjectedError[];
  /** Formatted error summary for LLM */
  summary: string;
  /** Detailed error list for LLM */
  details: string;
  /** Files affected */
  affectedFiles: string[];
  /** Suggested fix priority order */
  fixPriority: string[];
}

/** Options for error injection */
export interface ErrorInjectorOptions {
  /** Include code snippets around errors */
  includeSnippets?: boolean;
  /** Number of context lines for snippets */
  snippetContextLines?: number;
  /** Group related errors */
  groupRelated?: boolean;
  /** Maximum errors to inject (prevents token overflow) */
  maxErrors?: number;
  /** Include warnings */
  includeWarnings?: boolean;
}

// ============================================================================
// Error Injector Class
// ============================================================================

/**
 * ErrorInjector - Transforms validation errors for LLM consumption
 *
 * Creates structured error context that helps LLM understand:
 * - What went wrong (error message)
 * - Where it went wrong (file, line, column)
 * - How to fix it (suggestions, code context)
 */
export class ErrorInjector {
  private options: Required<ErrorInjectorOptions>;

  constructor(options: ErrorInjectorOptions = {}) {
    this.options = {
      includeSnippets: options.includeSnippets ?? true,
      snippetContextLines: options.snippetContextLines ?? 3,
      groupRelated: options.groupRelated ?? true,
      maxErrors: options.maxErrors ?? 50,
      includeWarnings: options.includeWarnings ?? true,
    };
  }

  /**
   * Inject validation errors into context for LLM
   */
  injectErrors(
    validatorResults: ValidatorResult[],
    context: AgentContext,
    iteration: number
  ): ErrorContext {
    const injectedErrors: InjectedError[] = [];
    const injectedWarnings: InjectedError[] = [];

    // Process each validator result
    for (const result of validatorResults) {
      // Process errors
      for (const error of result.errors) {
        const injected = this.transformValidationError(error, result.name, context, iteration);

        if (error.severity === 'critical') {
          injectedErrors.unshift(injected); // Critical first
        } else {
          injectedErrors.push(injected);
        }
      }

      // Process warnings if enabled
      if (this.options.includeWarnings) {
        for (const warning of result.warnings) {
          const injected = this.transformWarning(warning, result.name, context, iteration);
          injectedWarnings.push(injected);
        }
      }
    }

    // Group related errors if enabled
    if (this.options.groupRelated) {
      this.groupRelatedErrors(injectedErrors);
    }

    // Apply max limit
    const limitedErrors = injectedErrors.slice(0, this.options.maxErrors);
    const limitedWarnings = injectedWarnings.slice(0, this.options.maxErrors);

    // Separate critical errors
    const criticalErrors = limitedErrors.filter(e => e.severity === 'critical');
    const regularErrors = limitedErrors.filter(e => e.severity !== 'critical');

    // Build error context
    return this.buildErrorContext(criticalErrors, regularErrors, limitedWarnings);
  }

  /**
   * Convert AgentError array to ErrorContext
   */
  fromAgentErrors(
    errors: AgentError[],
    context: AgentContext
  ): ErrorContext {
    const injectedErrors: InjectedError[] = errors.map(error => ({
      id: error.id,
      type: error.type,
      message: error.message,
      filePath: error.file || null,
      lineNumber: error.line || null,
      columnNumber: error.column || null,
      severity: error.severity === 'error' ? 'error' : 'warning',
      suggestedFix: error.suggestion || this.inferSuggestion(error),
      codeSnippet: this.extractSnippet(error.file, error.line, context),
      relatedErrorIds: [],
      iteration: error.iteration,
    }));

    const criticalErrors = injectedErrors.filter(e => e.severity === 'critical');
    const regularErrors = injectedErrors.filter(e => e.severity === 'error');
    const warnings = injectedErrors.filter(e => e.severity === 'warning');

    return this.buildErrorContext(criticalErrors, regularErrors, warnings);
  }

  /**
   * Format errors for LLM prompt injection
   */
  formatForPrompt(errorContext: ErrorContext): string {
    const parts: string[] = [];

    parts.push('## Validation Errors\n');
    parts.push(errorContext.summary);
    parts.push('\n### Error Details\n');
    parts.push(errorContext.details);

    if (errorContext.fixPriority.length > 0) {
      parts.push('\n### Suggested Fix Order\n');
      errorContext.fixPriority.forEach((file, i) => {
        parts.push(`${i + 1}. ${file}`);
      });
    }

    return parts.join('\n');
  }

  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------

  private transformValidationError(
    error: ValidationError,
    validatorName: string,
    context: AgentContext,
    iteration: number
  ): InjectedError {
    return {
      id: `${validatorName}-${error.code}-${Date.now()}`,
      type: this.mapValidatorToErrorType(validatorName),
      message: error.message,
      filePath: error.file || null,
      lineNumber: error.line || null,
      columnNumber: error.column || null,
      severity: error.severity,
      suggestedFix: error.suggestion || this.inferSuggestion({ type: this.mapValidatorToErrorType(validatorName), message: error.message } as AgentError),
      codeSnippet: this.extractSnippet(error.file, error.line, context),
      relatedErrorIds: [],
      iteration,
    };
  }

  private transformWarning(
    warning: { code: string; message: string; file?: string; line?: number; suggestion?: string },
    validatorName: string,
    context: AgentContext,
    iteration: number
  ): InjectedError {
    return {
      id: `${validatorName}-${warning.code}-${Date.now()}`,
      type: this.mapValidatorToErrorType(validatorName),
      message: warning.message,
      filePath: warning.file || null,
      lineNumber: warning.line || null,
      columnNumber: null,
      severity: 'warning',
      suggestedFix: warning.suggestion || null,
      codeSnippet: this.extractSnippet(warning.file, warning.line, context),
      relatedErrorIds: [],
      iteration,
    };
  }

  private mapValidatorToErrorType(validatorName: string): AgentError['type'] {
    const mapping: Record<string, AgentError['type']> = {
      qweb: 'qweb',
      scss: 'scss',
      accessibility: 'validation',
      odoo_structure: 'odoo',
    };
    return mapping[validatorName] || 'unknown';
  }

  private extractSnippet(
    file: string | undefined,
    line: number | undefined,
    context: AgentContext
  ): string | null {
    if (!file || !line || !this.options.includeSnippets) {
      return null;
    }

    const content = context.filesRead.get(file);
    if (!content) {
      return null;
    }

    const lines = content.split('\n');
    const startLine = Math.max(0, line - 1 - this.options.snippetContextLines);
    const endLine = Math.min(lines.length, line + this.options.snippetContextLines);

    const snippetLines = lines.slice(startLine, endLine).map((l, i) => {
      const lineNum = startLine + i + 1;
      const marker = lineNum === line ? '>' : ' ';
      return `${marker} ${lineNum.toString().padStart(4)} | ${l}`;
    });

    return snippetLines.join('\n');
  }

  private inferSuggestion(error: AgentError): string | null {
    const suggestions: Record<string, Record<string, string>> = {
      qweb: {
        't-name': 'Add t-name attribute to the template element',
        't-if': 'Check the t-if condition syntax and ensure variables exist',
        't-foreach': 'Verify t-foreach has matching t-as attribute',
        'template': 'Ensure template follows Odoo QWeb conventions',
      },
      scss: {
        'brace': 'Check for matching opening and closing braces',
        'import': 'Add required @import or @use statement',
        'variable': 'Define the variable or import it from Odoo variables',
        'syntax': 'Check SCSS syntax near the error location',
      },
      validation: {
        'alt': 'Add alt attribute to image for accessibility',
        'label': 'Associate input with a label using for/id',
        'contrast': 'Increase color contrast to meet WCAG guidelines',
        'landmark': 'Add ARIA landmarks or use semantic HTML elements',
      },
      odoo: {
        'manifest': 'Create __manifest__.py with required module metadata',
        'init': 'Create __init__.py to make directory a Python package',
        'structure': 'Follow Odoo module directory structure conventions',
        'filename': 'Use lowercase with underscores for file names',
      },
    };

    const typeSuggestions = suggestions[error.type] || {};
    const messageLower = error.message.toLowerCase();

    for (const [keyword, suggestion] of Object.entries(typeSuggestions)) {
      if (messageLower.includes(keyword)) {
        return suggestion;
      }
    }

    return null;
  }

  private groupRelatedErrors(errors: InjectedError[]): void {
    // Group errors by file
    const byFile = new Map<string, InjectedError[]>();

    for (const error of errors) {
      if (error.filePath) {
        const existing = byFile.get(error.filePath) || [];
        existing.push(error);
        byFile.set(error.filePath, existing);
      }
    }

    // Link related errors
    for (const fileErrors of byFile.values()) {
      if (fileErrors.length > 1) {
        const ids = fileErrors.map(e => e.id);
        for (const error of fileErrors) {
          error.relatedErrorIds = ids.filter(id => id !== error.id);
        }
      }
    }
  }

  private buildErrorContext(
    criticalErrors: InjectedError[],
    errors: InjectedError[],
    warnings: InjectedError[]
  ): ErrorContext {
    const allErrors = [...criticalErrors, ...errors];

    // Count by type
    const errorsByType: Record<string, number> = {};
    for (const error of allErrors) {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1;
    }

    // Get affected files
    const affectedFiles = [...new Set(
      allErrors
        .filter(e => e.filePath)
        .map(e => e.filePath as string)
    )];

    // Determine fix priority (critical first, then by error count per file)
    const fileErrorCounts = new Map<string, number>();
    for (const error of allErrors) {
      if (error.filePath) {
        fileErrorCounts.set(error.filePath, (fileErrorCounts.get(error.filePath) || 0) + 1);
      }
    }

    const fixPriority = Array.from(fileErrorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([file]) => file);

    // Build summary
    const summary = this.buildSummary(criticalErrors, errors, warnings, errorsByType);

    // Build details
    const details = this.buildDetails(criticalErrors, errors);

    return {
      totalErrors: allErrors.length,
      errorsByType,
      criticalErrors,
      errors,
      warnings,
      summary,
      details,
      affectedFiles,
      fixPriority,
    };
  }

  private buildSummary(
    criticalErrors: InjectedError[],
    errors: InjectedError[],
    warnings: InjectedError[],
    errorsByType: Record<string, number>
  ): string {
    const parts: string[] = [];

    if (criticalErrors.length > 0) {
      parts.push(`**CRITICAL:** ${criticalErrors.length} critical error(s) must be fixed immediately.`);
    }

    parts.push(`Found ${errors.length + criticalErrors.length} error(s) and ${warnings.length} warning(s).`);

    const typeBreakdown = Object.entries(errorsByType)
      .map(([type, count]) => `${type}: ${count}`)
      .join(', ');

    if (typeBreakdown) {
      parts.push(`By type: ${typeBreakdown}`);
    }

    return parts.join('\n');
  }

  private buildDetails(
    criticalErrors: InjectedError[],
    errors: InjectedError[]
  ): string {
    const parts: string[] = [];

    const formatError = (error: InjectedError, index: number): string => {
      const lines: string[] = [];
      const location = error.filePath
        ? `${error.filePath}${error.lineNumber ? `:${error.lineNumber}` : ''}${error.columnNumber ? `:${error.columnNumber}` : ''}`
        : 'unknown location';

      lines.push(`${index + 1}. [${error.type.toUpperCase()}] ${error.message}`);
      lines.push(`   Location: ${location}`);

      if (error.suggestedFix) {
        lines.push(`   Suggestion: ${error.suggestedFix}`);
      }

      if (error.codeSnippet) {
        lines.push('   Code:');
        lines.push(error.codeSnippet.split('\n').map(l => `   ${l}`).join('\n'));
      }

      return lines.join('\n');
    };

    if (criticalErrors.length > 0) {
      parts.push('#### Critical Errors (Fix First)');
      criticalErrors.forEach((e, i) => parts.push(formatError(e, i)));
    }

    if (errors.length > 0) {
      parts.push('\n#### Errors');
      errors.forEach((e, i) => parts.push(formatError(e, i)));
    }

    return parts.join('\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an error injector with default or custom options
 */
export function createErrorInjector(options?: ErrorInjectorOptions): ErrorInjector {
  return new ErrorInjector(options);
}

// ============================================================================
// Default Export
// ============================================================================

export default ErrorInjector;
